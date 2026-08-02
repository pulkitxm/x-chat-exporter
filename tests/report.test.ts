import { describe, expect, test } from "bun:test";
import { buildExportReport } from "../src/lib/report";
import type { Capture } from "../src/lib/types";

function capture(overrides: Partial<Capture> = {}): Capture {
  return {
    url: "https://x.com/i/chat/1-2",
    conversationId: "1-2",
    title: "Hood",
    reachedStart: true,
    headerHtml: "",
    composerHtml: "",
    htmlStyleAttr: "",
    theme: "dark",
    css: "",
    order: ["sep:Today", "message-a", "message-b"],
    items: {},
    blobMedia: [{ url: "blob:x", mimeType: "image/jpeg", base64: "" }],
    ...overrides,
  };
}

describe("buildExportReport", () => {
  test("separates message counts from date separators", () => {
    const report = buildExportReport({
      capture: capture(),
      exportedAt: "2026-08-03T00:00:00.000Z",
      trustedScrollUsed: true,
      remoteAssetCount: 12,
      fontCount: 47,
    });
    expect(report.capture.items).toBe(3);
    expect(report.capture.messages).toBe(2);
    expect(report.capture.separators).toBe(1);
  });

  test("records how the capture was driven and whether it completed", () => {
    const report = buildExportReport({
      capture: capture({ reachedStart: false }),
      exportedAt: "2026-08-03T00:00:00.000Z",
      trustedScrollUsed: false,
      remoteAssetCount: 0,
      fontCount: 0,
    });
    expect(report.capture.reachedStart).toBe(false);
    expect(report.capture.trustedScrollUsed).toBe(false);
  });

  test("summarises media by origin", () => {
    const report = buildExportReport({
      capture: capture(),
      exportedAt: "2026-08-03T00:00:00.000Z",
      trustedScrollUsed: true,
      remoteAssetCount: 12,
      fontCount: 47,
    });
    expect(report.media).toEqual({ remoteAssets: 12, inChatMedia: 1, fonts: 47 });
  });

  test("carries the conversation identity for auditing", () => {
    const report = buildExportReport({
      capture: capture(),
      exportedAt: "2026-08-03T00:00:00.000Z",
      trustedScrollUsed: true,
      remoteAssetCount: 0,
      fontCount: 0,
    });
    expect(report.conversation).toEqual({
      title: "Hood",
      url: "https://x.com/i/chat/1-2",
      id: "1-2",
    });
  });
});
