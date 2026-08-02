import { describe, expect, test } from "bun:test";
import { buildPage } from "../src/lib/page";
import type { Capture } from "../src/lib/types";

function sampleCapture(): Capture {
  return {
    url: "https://x.com/i/chat/1-2",
    conversationId: "1-2",
    title: "Ayush",
    headerHtml: '<div data-testid="dm-conversation-header">Ayush</div>',
    composerHtml: "",
    htmlStyleAttr: "",
    theme: "dark",
    css: 'body { color: red; } src: url("https://abs.twimg.com/fonts/Chirp-Regular.aa.woff2");',
    order: ["sep:Today", "message-1"],
    items: {
      "sep:Today": { html: "<div>Today</div>", text: "Today" },
      "message-1": {
        html: '<div data-testid="message-1"><img src="https://pbs.twimg.com/media/abc.jpg"><video src="blob:https://x.com/uuid"></video></div>',
        text: "hello",
      },
    },
    blobMedia: [],
  };
}

describe("buildPage", () => {
  const page = buildPage({
    capture: sampleCapture(),
    assetManifest: { "https://pbs.twimg.com/media/abc.jpg": "abc_1.jpg" },
    blobFileNames: { "message-1": "dm_video_message-1.mp4" },
    fontFiles: ["Chirp-Regular.aa.woff2"],
  });

  test("produces a complete standalone document", () => {
    expect(page.startsWith("<!doctype html>")).toBe(true);
    expect(page).toContain('data-theme="dark"');
    expect(page).toContain("</html>");
  });

  test("renders items in order inside the message list", () => {
    const todayIndex = page.indexOf("Today");
    const messageIndex = page.indexOf('data-testid="message-1"');
    expect(todayIndex).toBeGreaterThan(-1);
    expect(messageIndex).toBeGreaterThan(todayIndex);
  });

  test("rewrites remote and blob media to local assets", () => {
    expect(page).toContain('src="assets/abc_1.jpg"');
    expect(page).toContain('src="assets/dm_video_message-1.mp4"');
    expect(page).not.toContain("blob:https://x.com");
  });

  test("rewrites downloaded fonts and keeps the fallback composer", () => {
    expect(page).toContain('url("fonts/Chirp-Regular.aa.woff2")');
    expect(page).toContain("Message");
  });

  test("falls back to the default html style attribute", () => {
    expect(page).toContain("color-scheme: dark");
  });
});
