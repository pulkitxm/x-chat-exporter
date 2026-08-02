export interface CapturedItem {
  html: string;
  text: string;
}

export interface BlobMedia {
  messageKey: string;
  mimeType: string;
  base64: string;
}

export interface Capture {
  url: string;
  conversationId: string;
  title: string;
  headerHtml: string;
  composerHtml: string;
  htmlStyleAttr: string;
  theme: string;
  css: string;
  order: string[];
  items: Record<string, CapturedItem>;
  blobMedia: BlobMedia[];
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

export type CaptureStatus =
  | { phase: "starting" }
  | { phase: "scrolling-up"; itemCount: number; rounds: number; manualHint: boolean }
  | { phase: "hydrating"; itemCount: number; rounds: number; manualHint: boolean }
  | { phase: "collecting-media"; pending: number }
  | { phase: "done"; itemCount: number };

export type ContentMessage =
  | { kind: "status"; status: CaptureStatus }
  | { kind: "capture-chunk"; index: number; total: number; payload: string }
  | { kind: "error"; message: string };

export type ExporterCommand = { kind: "start" };
