import {
  blobAssetName,
  buildAssetManifest,
  extractAssetUrls,
  extractChirpFontUrls,
  fontFileName,
} from "../lib/assets";
import { base64ToBytes } from "../lib/base64";
import { buildPage } from "../lib/page";
import type { Capture, ContentMessage, ZipEntry } from "../lib/types";
import { buildZip } from "../lib/zip";

const STEP_IDS = ["connect", "capture", "assets", "build", "download"] as const;
type StepId = (typeof STEP_IDS)[number];

const STEP_LABELS: Record<StepId, string> = {
  connect: "Connect to the chat tab",
  capture: "Capture the conversation",
  assets: "Download media and fonts",
  build: "Build the offline page",
  download: "Save the zip archive",
};

class Ui {
  private steps = new Map<StepId, HTMLElement>();
  private barFill: HTMLElement;
  private note: HTMLElement;

  constructor() {
    const container = document.getElementById("steps");
    const barFill = document.querySelector<HTMLElement>("#bar > div");
    const note = document.getElementById("note");
    if (container === null || barFill === null || note === null) {
      throw new Error("exporter page markup is incomplete");
    }
    this.barFill = barFill;
    this.note = note;
    for (const id of STEP_IDS) {
      const row = document.createElement("div");
      row.className = "step";
      const dot = document.createElement("div");
      dot.className = "dot";
      const label = document.createElement("span");
      label.textContent = STEP_LABELS[id];
      const detail = document.createElement("span");
      detail.className = "detail";
      row.append(dot, label, detail);
      container.appendChild(row);
      this.steps.set(id, row);
    }
  }

  setState(id: StepId, state: "active" | "done" | "error", detail = ""): void {
    const row = this.steps.get(id);
    if (row === undefined) return;
    row.className = `step ${state}`;
    const detailNode = row.querySelector<HTMLElement>(".detail");
    if (detailNode !== null) detailNode.textContent = detail;
  }

  progress(fraction: number): void {
    this.barFill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
  }

  setNote(text: string): void {
    this.note.textContent = text;
  }
}

class TrustedScroller {
  private attached = false;

  constructor(private tabId: number) {}

  async attach(): Promise<void> {
    try {
      await chrome.debugger.attach({ tabId: this.tabId }, "1.3");
      this.attached = true;
    } catch {
      this.attached = false;
    }
  }

  get isAttached(): boolean {
    return this.attached;
  }

  scroll(x: number, y: number, deltaY: number): void {
    if (!this.attached) return;
    void chrome.debugger
      .sendCommand({ tabId: this.tabId }, "Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x,
        y,
        deltaX: 0,
        deltaY,
        pointerType: "mouse",
      })
      .catch(() => {
        this.attached = false;
      });
  }

  async detach(): Promise<void> {
    if (!this.attached) return;
    this.attached = false;
    try {
      await chrome.debugger.detach({ tabId: this.tabId });
    } catch {
      return;
    }
  }
}

function injectAndConnect(tabId: number): Promise<chrome.runtime.Port> {
  return chrome.scripting
    .executeScript({ target: { tabId }, files: ["content.js"] })
    .then(() => chrome.tabs.connect(tabId, { name: "x-chat-exporter" }));
}

function showCaptureStatus(
  ui: Ui,
  message: Extract<ContentMessage, { kind: "status" }>,
  trustedScrollAvailable: boolean,
): void {
  const status = message.status;
  if (status.phase !== "scrolling-up" && status.phase !== "hydrating") return;
  const direction = status.phase === "scrolling-up" ? "reading history" : "loading media";
  ui.setState("capture", "active", `${status.itemCount} items, ${direction}`);
  if (!status.manualHint) {
    ui.setNote("");
    return;
  }
  ui.setNote(
    trustedScrollAvailable
      ? "Scrolling has stalled. Switch to the chat tab and scroll through the conversation yourself; capture keeps recording while you scroll."
      : "Auto-scroll is unavailable in this browser. Switch to the chat tab and scroll to the very start of the conversation, then back down; capture keeps recording while you scroll.",
  );
}

function collectChunk(
  chunks: string[],
  message: Extract<ContentMessage, { kind: "capture-chunk" }>,
  ui: Ui,
): Capture | null {
  chunks[message.index] = message.payload;
  const received = chunks.filter((chunk) => chunk !== undefined).length;
  ui.setState("capture", "active", `receiving ${received}/${message.total}`);
  if (received < message.total) return null;
  return JSON.parse(chunks.join("")) as Capture;
}

function runCapture(
  port: chrome.runtime.Port,
  ui: Ui,
  scroller: TrustedScroller,
): Promise<Capture> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const handle = (message: ContentMessage): void => {
      if (message.kind === "error") {
        reject(new Error(message.message));
        return;
      }
      if (message.kind === "status") {
        showCaptureStatus(ui, message, scroller.isAttached);
        return;
      }
      if (message.kind === "scroll-request") {
        scroller.scroll(message.x, message.y, message.deltaY);
        return;
      }
      const capture = collectChunk(chunks, message, ui);
      if (capture !== null) resolve(capture);
    };
    port.onMessage.addListener((raw) => {
      try {
        handle(raw as ContentMessage);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    port.onDisconnect.addListener(() => {
      reject(new Error("The chat tab closed or navigated away during capture."));
    });
    port.postMessage({ kind: "start" });
  });
}

async function fetchBinary(url: string): Promise<Uint8Array | null> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

interface FetchedAssets {
  entries: ZipEntry[];
  assetManifest: Record<string, string>;
  fontFiles: string[];
}

async function fetchAssets(capture: Capture, ui: Ui): Promise<FetchedAssets> {
  const htmlBlobs = [
    capture.headerHtml,
    capture.composerHtml,
    ...Object.values(capture.items).map((item) => item.html),
  ];
  const urls = extractAssetUrls(htmlBlobs);
  const manifest = buildAssetManifest(urls);
  const fontUrls = extractChirpFontUrls(capture.css);
  const total = urls.length + fontUrls.length;
  const entries: ZipEntry[] = [];
  const fontFiles: string[] = [];
  let completed = 0;
  const tick = () => {
    completed += 1;
    ui.setState("assets", "active", `${completed}/${total}`);
    ui.progress(0.3 + 0.5 * (completed / Math.max(1, total)));
  };

  const queue = [...urls];
  const workers = Array.from({ length: 6 }, async () => {
    let url = queue.shift();
    while (url !== undefined) {
      const name = manifest[url];
      if (name !== undefined) {
        const bytes = await fetchBinary(url);
        if (bytes === null) {
          delete manifest[url];
        } else {
          entries.push({ name: `assets/${name}`, data: bytes });
        }
      }
      tick();
      url = queue.shift();
    }
  });
  await Promise.all(workers);

  for (const url of fontUrls) {
    const bytes = await fetchBinary(url);
    if (bytes !== null) {
      const name = fontFileName(url);
      fontFiles.push(name);
      entries.push({ name: `fonts/${name}`, data: bytes });
    }
    tick();
  }

  return { entries, assetManifest: manifest, fontFiles };
}

function blobEntries(capture: Capture): { entries: ZipEntry[]; names: Record<string, string> } {
  const entries: ZipEntry[] = [];
  const names: Record<string, string> = {};
  for (const media of capture.blobMedia) {
    const name = blobAssetName(media.url, media.mimeType);
    names[media.url] = name;
    entries.push({ name: `assets/${name}`, data: base64ToBytes(media.base64) });
  }
  return { entries, names };
}

async function run(): Promise<void> {
  const ui = new Ui();
  const params = new URLSearchParams(location.search);
  const tabId = Number.parseInt(params.get("tabId") ?? "", 10);
  if (Number.isNaN(tabId)) {
    ui.setState("connect", "error", "missing tab");
    ui.setNote("Open an X chat tab and click the extension icon there.");
    return;
  }
  const trustedScroller = new TrustedScroller(tabId);
  try {
    ui.setState("connect", "active");
    ui.progress(0.05);
    const port = await injectAndConnect(tabId);
    await trustedScroller.attach();
    ui.setState(
      "connect",
      "done",
      trustedScroller.isAttached ? "auto-scroll ready" : "manual mode",
    );
    ui.setState("capture", "active");
    ui.progress(0.1);
    const capture = await runCapture(port, ui, trustedScroller);
    await trustedScroller.detach();
    ui.setState("capture", "done", `${capture.order.length} items`);
    ui.setNote("");
    ui.progress(0.3);

    ui.setState("assets", "active");
    const media = blobEntries(capture);
    const fetched = await fetchAssets(capture, ui);
    ui.setState("assets", "done", `${fetched.entries.length + media.entries.length} files`);
    ui.progress(0.85);

    ui.setState("build", "active");
    const page = buildPage({
      capture,
      assetManifest: fetched.assetManifest,
      blobFileNames: media.names,
      fontFiles: fetched.fontFiles,
    });
    const zip = buildZip([
      { name: "index.html", data: new TextEncoder().encode(page) },
      ...fetched.entries,
      ...media.entries,
    ]);
    ui.setState("build", "done", `${(zip.length / 1024 / 1024).toFixed(1)} MB`);
    ui.progress(0.95);

    ui.setState("download", "active");
    const blobUrl = URL.createObjectURL(
      new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }),
    );
    const filename = `x-chat-${capture.conversationId}.zip`;
    await chrome.downloads.download({ url: blobUrl, filename });
    ui.setState("download", "done", filename);
    ui.progress(1);
    ui.setNote("Unzip the archive and open index.html. The page works fully offline.");
  } catch (error) {
    await trustedScroller.detach();
    const message = error instanceof Error ? error.message : String(error);
    const active = document.querySelector(".step.active");
    if (active !== null) active.className = "step error";
    ui.setNote(message);
  }
}

void run();
