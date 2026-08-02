import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { PAGE_SCRIPT_SOURCE } from "../src/lib/page";

type HappyElement = ReturnType<Window["document"]["querySelector"]> & object;

const MARKUP = `
<div class="xc-messages">
  <div data-testid="message-1"><img id="photo" src="assets/a.jpg" alt="attachment"></div>
  <div data-testid="message-2"><video id="clip" src="assets/b.mp4"></video></div>
  <div data-testid="message-3">
    <img id="avatar" src="assets/tiny.jpg" alt="user avatar">
    <span data-card-link="1" data-href="https://x.com/u/status/9"><span id="cardtext">quoted</span></span>
    <a id="profile" href="https://x.com/u">u</a>
  </div>
</div>`;

interface Harness {
  window: Window;
  overlay: HappyElement;
  stage: HappyElement;
  click: (id: string) => void;
  press: (key: string) => void;
  opened: () => string | null;
}

function mount(widths: Record<string, number>): Harness {
  const window = new Window({ url: "https://localhost/" });
  const document = window.document;
  document.body.innerHTML = MARKUP;

  const proto = window.Element.prototype as unknown as { getBoundingClientRect: () => unknown };
  proto.getBoundingClientRect = function boundingRect(this: { id: string }) {
    return { width: widths[this.id] ?? 0 };
  };

  let opened: string | null = null;
  const scriptWindow = {
    addEventListener: () => undefined,
    open: (url: string) => {
      opened = url;
    },
  };
  new Function("window", "document", PAGE_SCRIPT_SOURCE)(scriptWindow, document);

  const overlay = document.querySelector(".xc-lightbox");
  const stage = document.querySelector(".xc-lightbox-stage");
  if (overlay === null || stage === null) throw new Error("lightbox was not installed");

  return {
    window,
    overlay,
    stage,
    click: (id: string) => {
      const target = id === "overlay" ? overlay : document.getElementById(id);
      if (target === null) throw new Error(`missing element ${id}`);
      target.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    },
    press: (key: string) => {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
    },
    opened: () => opened,
  };
}

describe("exported page lightbox", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = mount({ photo: 300, clip: 300, avatar: 40 });
  });

  test("installs itself closed and empty", () => {
    expect(harness.overlay.classList.contains("xc-open")).toBe(false);
    expect(harness.stage.children.length).toBe(0);
  });

  test("clicking a photo opens it at full size", () => {
    harness.click("photo");
    expect(harness.overlay.classList.contains("xc-open")).toBe(true);
    const shown = harness.stage.firstElementChild;
    expect(shown?.tagName).toBe("IMG");
    expect(shown?.getAttribute("src")?.endsWith("assets/a.jpg")).toBe(true);
  });

  test("clicking a video opens it with controls", () => {
    harness.click("clip");
    const shown = harness.stage.firstElementChild as unknown as HTMLVideoElement | null;
    expect(shown?.tagName).toBe("VIDEO");
    expect(shown?.getAttribute("src")?.endsWith("assets/b.mp4")).toBe(true);
    expect(shown?.controls).toBe(true);
  });

  test("clicking the backdrop closes it and clears the stage", () => {
    harness.click("photo");
    harness.click("overlay");
    expect(harness.overlay.classList.contains("xc-open")).toBe(false);
    expect(harness.stage.children.length).toBe(0);
  });

  test("escape closes it", () => {
    harness.click("photo");
    harness.press("Escape");
    expect(harness.overlay.classList.contains("xc-open")).toBe(false);
  });

  test("other keys leave it open", () => {
    harness.click("photo");
    harness.press("a");
    expect(harness.overlay.classList.contains("xc-open")).toBe(true);
  });

  test("avatars are too small to zoom", () => {
    harness.click("avatar");
    expect(harness.overlay.classList.contains("xc-open")).toBe(false);
  });

  test("card links still open when the click misses media", () => {
    harness.click("cardtext");
    expect(harness.opened()).toBe("https://x.com/u/status/9");
    expect(harness.overlay.classList.contains("xc-open")).toBe(false);
  });

  test("real anchors are left alone", () => {
    harness.click("profile");
    expect(harness.opened()).toBe(null);
  });

  test("marks large media as zoomable and leaves avatars unmarked", () => {
    const photo = harness.window.document.getElementById("photo");
    const avatar = harness.window.document.getElementById("avatar");
    expect(photo?.classList.contains("xc-zoomable")).toBe(true);
    expect(avatar?.classList.contains("xc-zoomable")).toBe(false);
  });
});
