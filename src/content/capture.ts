import { bytesToBase64 } from "../lib/base64";
import { mergeWindow } from "../lib/merge";
import type { BlobMedia, Capture, CapturedItem, CaptureStatus, ContentMessage } from "../lib/types";

const CHUNK_SIZE = 4 * 1024 * 1024;
const SETTLE_MS = 750;
const MAX_UP_ROUNDS = 600;
const MAX_DOWN_ROUNDS = 600;
const STAGNANT_ROUNDS_BEFORE_MANUAL = 6;
const STAGNANT_ROUNDS_AT_END = 8;

interface CaptureState {
  order: string[];
  items: Map<string, CapturedItem>;
  blobMedia: Map<string, BlobMedia>;
  pendingBlobFetches: Set<string>;
  manualHint: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="dm-message-scroller"]');
}

function findColumn(scroller: HTMLElement): HTMLElement | null {
  for (const child of scroller.children) {
    if (child instanceof HTMLElement && child.className.includes("relative")) return child;
  }
  return null;
}

function keyForItem(element: Element): string {
  const message = element.querySelector('[data-testid^="message-"]');
  const testId = message?.getAttribute("data-testid");
  if (testId !== null && testId !== undefined) return testId;
  return `sep:${element.textContent?.trim() ?? ""}`;
}

function captureTick(state: CaptureState): void {
  const scroller = findScroller();
  if (scroller === null) return;
  const column = findColumn(scroller);
  if (column === null) return;
  const snapshot: { key: string; top: number; element: HTMLElement }[] = [];
  for (const child of column.children) {
    if (!(child instanceof HTMLElement)) continue;
    snapshot.push({
      key: keyForItem(child),
      top: child.getBoundingClientRect().top,
      element: child,
    });
  }
  snapshot.sort((a, b) => a.top - b.top);
  for (const entry of snapshot) {
    state.items.set(entry.key, {
      html: entry.element.innerHTML,
      text: entry.element.textContent ?? "",
    });
  }
  state.order = mergeWindow(
    state.order,
    snapshot.map((entry) => entry.key),
  );
  collectBlobMedia(state);
}

function collectBlobMedia(state: CaptureState): void {
  const videos = document.querySelectorAll<HTMLVideoElement>(
    '[data-testid^="message-"] video[src^="blob:"]',
  );
  for (const video of videos) {
    const message = video.closest('[data-testid^="message-"]');
    const key = message?.getAttribute("data-testid");
    if (key === null || key === undefined) continue;
    if (state.blobMedia.has(key) || state.pendingBlobFetches.has(key)) continue;
    state.pendingBlobFetches.add(key);
    void fetchBlob(state, key, video.src);
  }
}

async function fetchBlob(state: CaptureState, key: string, src: string): Promise<void> {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    state.blobMedia.set(key, {
      messageKey: key,
      mimeType: blob.type.length > 0 ? blob.type : "video/mp4",
      base64: bytesToBase64(bytes),
    });
  } catch {
    return;
  } finally {
    state.pendingBlobFetches.delete(key);
  }
}

function dispatchWheel(scroller: HTMLElement, deltaY: number): void {
  const rect = scroller.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;
  const target = document.elementFromPoint(clientX, clientY) ?? scroller;
  target.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    }),
  );
}

function columnTop(): number | null {
  const scroller = findScroller();
  if (scroller === null) return null;
  const column = findColumn(scroller);
  if (column === null) return null;
  return column.getBoundingClientRect().top;
}

function tryScroll(deltaY: number): void {
  const scroller = findScroller();
  if (scroller === null) return;
  scroller.scrollTop += deltaY;
  for (let i = 0; i < 4; i++) dispatchWheel(scroller, deltaY / 4);
}

function startCardCaptured(state: CaptureState): boolean {
  for (const item of state.items.values()) {
    if (item.text.includes("View Profile") && item.text.includes("Joined")) return true;
  }
  return false;
}

function atBottom(): boolean {
  const scroller = findScroller();
  if (scroller === null) return false;
  const column = findColumn(scroller);
  if (column === null) return false;
  return column.getBoundingClientRect().bottom <= scroller.getBoundingClientRect().bottom + 60;
}

interface Overlay {
  element: HTMLDivElement;
  label: HTMLSpanElement;
}

function createOverlay(): Overlay {
  const element = document.createElement("div");
  element.setAttribute(
    "style",
    "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:99999;" +
      "background:#1d9bf0;color:#fff;padding:10px 18px;border-radius:9999px;" +
      "font:600 14px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.4);" +
      "pointer-events:none;max-width:80vw;text-align:center;",
  );
  const label = document.createElement("span");
  element.appendChild(label);
  document.body.appendChild(element);
  return { element, label };
}

function overlayText(status: CaptureStatus): string {
  switch (status.phase) {
    case "starting":
      return "Export starting";
    case "scrolling-up":
      return status.manualHint
        ? `Auto-scroll is blocked. Please scroll UP until the start of the conversation (${status.itemCount} items captured)`
        : `Capturing history: ${status.itemCount} items`;
    case "hydrating":
      return status.manualHint
        ? `Please scroll DOWN slowly to the end of the conversation (${status.itemCount} items captured)`
        : `Loading media: ${status.itemCount} items`;
    case "collecting-media":
      return `Saving in-chat media: ${status.pending} pending`;
    case "done":
      return `Captured ${status.itemCount} items. Building export...`;
  }
}

class Session {
  private state: CaptureState = {
    order: [],
    items: new Map(),
    blobMedia: new Map(),
    pendingBlobFetches: new Set(),
    manualHint: false,
  };
  private observer: MutationObserver | null = null;
  private overlay: Overlay | null = null;

  constructor(private port: chrome.runtime.Port) {}

  private post(message: ContentMessage): void {
    try {
      this.port.postMessage(message);
    } catch {
      this.cleanup();
    }
  }

  private status(status: CaptureStatus): void {
    if (this.overlay !== null) this.overlay.label.textContent = overlayText(status);
    this.post({ kind: "status", status });
  }

  async run(): Promise<void> {
    const scroller = findScroller();
    if (scroller === null) {
      this.post({
        kind: "error",
        message: "No conversation found. Open a chat at x.com/i/chat first.",
      });
      return;
    }
    this.overlay = createOverlay();
    this.status({ phase: "starting" });
    const column = findColumn(scroller);
    if (column !== null) {
      this.observer = new MutationObserver(() => captureTick(this.state));
      this.observer.observe(column, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }
    captureTick(this.state);
    await this.scrollPhase("up");
    await this.scrollPhase("down");
    await this.drainBlobFetches();
    this.status({ phase: "done", itemCount: this.state.order.length });
    this.sendCapture();
    this.cleanup();
  }

  private async scrollPhase(direction: "up" | "down"): Promise<void> {
    const maxRounds = direction === "up" ? MAX_UP_ROUNDS : MAX_DOWN_ROUNDS;
    const delta = direction === "up" ? -1200 : 900;
    let stagnantRounds = 0;
    let lastTop: number | null = null;
    let lastCount = -1;
    for (let round = 0; round < maxRounds; round++) {
      tryScroll(delta);
      await sleep(SETTLE_MS);
      captureTick(this.state);
      const top = columnTop();
      const count = this.state.order.length;
      const moved = lastTop === null || top === null || Math.abs(top - lastTop) > 2;
      const grew = count > lastCount;
      if (moved || grew) {
        stagnantRounds = 0;
      } else {
        stagnantRounds += 1;
      }
      lastTop = top;
      lastCount = count;
      if (stagnantRounds >= STAGNANT_ROUNDS_BEFORE_MANUAL) this.state.manualHint = true;
      const finished =
        direction === "up"
          ? startCardCaptured(this.state) && stagnantRounds >= 2
          : atBottom() && stagnantRounds >= 3;
      this.status({
        phase: direction === "up" ? "scrolling-up" : "hydrating",
        itemCount: count,
        rounds: round,
        manualHint: this.state.manualHint,
      });
      if (finished) return;
      if (stagnantRounds >= STAGNANT_ROUNDS_AT_END + STAGNANT_ROUNDS_BEFORE_MANUAL) return;
    }
  }

  private async drainBlobFetches(): Promise<void> {
    while (this.state.pendingBlobFetches.size > 0) {
      this.status({ phase: "collecting-media", pending: this.state.pendingBlobFetches.size });
      await sleep(300);
    }
  }

  private sendCapture(): void {
    const capture = this.buildCapture();
    const payload = JSON.stringify(capture);
    const total = Math.ceil(payload.length / CHUNK_SIZE);
    for (let index = 0; index < total; index++) {
      this.post({
        kind: "capture-chunk",
        index,
        total,
        payload: payload.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
      });
    }
  }

  private buildCapture(): Capture {
    let css = "";
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) css += `${rule.cssText}\n`;
      } catch {}
    }
    const items: Record<string, CapturedItem> = {};
    for (const [key, value] of this.state.items) items[key] = value;
    const header = document.querySelector('[data-testid="dm-conversation-header"]');
    const composer = document.querySelector('[data-testid="dm-composer-container"]');
    const themed = document.querySelector("[data-theme]");
    const conversationId = location.pathname.split("/").pop() ?? "conversation";
    return {
      url: location.href,
      conversationId,
      title: header?.textContent?.trim().slice(0, 80) ?? "X chat",
      headerHtml: header?.outerHTML ?? "",
      composerHtml: composer?.outerHTML ?? "",
      htmlStyleAttr: document.documentElement.getAttribute("style") ?? "",
      theme: themed?.getAttribute("data-theme") ?? "dark",
      css,
      order: this.state.order,
      items,
      blobMedia: [...this.state.blobMedia.values()],
    };
  }

  cleanup(): void {
    this.observer?.disconnect();
    this.overlay?.element.remove();
    this.overlay = null;
  }
}

declare global {
  interface Window {
    __xchatExporterLoaded?: boolean;
  }
}

if (window.__xchatExporterLoaded !== true) {
  window.__xchatExporterLoaded = true;
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "x-chat-exporter") return;
    port.onMessage.addListener((message: { kind?: string }) => {
      if (message.kind !== "start") return;
      const session = new Session(port);
      port.onDisconnect.addListener(() => session.cleanup());
      void session.run();
    });
  });
}
