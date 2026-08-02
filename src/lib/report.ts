import type { Capture } from "./types";

export interface ReportInputs {
  capture: Capture;
  exportedAt: string;
  trustedScrollUsed: boolean;
  remoteAssetCount: number;
  fontCount: number;
}

export interface ExportReport {
  exportedAt: string;
  conversation: { title: string; url: string; id: string };
  capture: {
    items: number;
    messages: number;
    separators: number;
    reachedStart: boolean;
    trustedScrollUsed: boolean;
  };
  media: { remoteAssets: number; inChatMedia: number; fonts: number };
}

export function buildExportReport(inputs: ReportInputs): ExportReport {
  const { capture } = inputs;
  const messages = capture.order.filter((key) => key.startsWith("message-")).length;
  return {
    exportedAt: inputs.exportedAt,
    conversation: { title: capture.title, url: capture.url, id: capture.conversationId },
    capture: {
      items: capture.order.length,
      messages,
      separators: capture.order.length - messages,
      reachedStart: capture.reachedStart,
      trustedScrollUsed: inputs.trustedScrollUsed,
    },
    media: {
      remoteAssets: inputs.remoteAssetCount,
      inChatMedia: capture.blobMedia.length,
      fonts: inputs.fontCount,
    },
  };
}
