import { rewriteFontUrls, rewriteItemHtml } from "./rewrite";
import type { Capture } from "./types";

const DEFAULT_HTML_STYLE =
  "overflow-y: scroll; overscroll-behavior-y: none; font-size: 15px; color-scheme: dark; " +
  "--chat-accent: var(--color-blue-500); --color-brand: var(--color-blue-500); " +
  "--accent: var(--color-blue-200); --accent-foreground: var(--color-blue-700); " +
  "--ring: var(--color-blue-500);";

const OVERRIDES = `
html, body { margin: 0; padding: 0; background: #000; }
body { color: rgb(231,233,234); font-family: TwitterChirp, -apple-system, "system-ui", "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
.xc-page { max-width: 770px; margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column; border-left: 1px solid rgb(47,51,54); border-right: 1px solid rgb(47,51,54); }
.xc-header-wrap { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(12px); background: rgba(0,0,0,0.65); }
.xc-header-wrap [data-testid="dm-conversation-header"] { position: static; }
.xc-messages { flex: 1; padding-bottom: 8px; }
.xc-composer-wrap { position: sticky; bottom: 0; z-index: 20; background: #000; pointer-events: none; }
video { background: #000; }
[data-card-link] { cursor: pointer; }
`;

const CLICK_SCRIPT = `<script>
document.addEventListener('click', function (e) {
  if (e.target.closest('a')) return;
  var card = e.target.closest('[data-card-link]');
  if (card && card.dataset.href) window.open(card.dataset.href, '_blank', 'noopener');
});
</${"script"}>`;

const FALLBACK_COMPOSER = `
<div style="display:flex;align-items:center;gap:10px;padding:10px 16px 14px;">
  <div style="flex:1;display:flex;align-items:center;background:rgb(32,35,39);border-radius:9999px;padding:10px 16px;color:rgb(113,118,123);">Message</div>
</div>`;

export interface PageInputs {
  capture: Capture;
  assetManifest: Record<string, string>;
  blobFileNames: Record<string, string>;
  fontFiles: string[];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPage(inputs: PageInputs): string {
  const { capture, assetManifest, blobFileNames, fontFiles } = inputs;
  const css = rewriteFontUrls(capture.css, fontFiles);
  const options = { assetManifest, blobFileNames };

  const itemsHtml = capture.order
    .map((key) => {
      const item = capture.items[key];
      if (item === undefined) return "";
      return `<div class="w-full">${rewriteItemHtml(item.html, options)}</div>`;
    })
    .join("\n");

  const headerHtml = rewriteItemHtml(capture.headerHtml, options);
  const composerHtml =
    capture.composerHtml.length > 0
      ? rewriteItemHtml(capture.composerHtml, options)
      : FALLBACK_COMPOSER;
  const htmlStyle = capture.htmlStyleAttr.length > 0 ? capture.htmlStyleAttr : DEFAULT_HTML_STYLE;
  const theme = capture.theme.length > 0 ? capture.theme : "dark";

  return `<!doctype html>
<html lang="en" data-theme="${escapeHtml(theme)}" style='${htmlStyle.replace(/'/g, "&#39;")}'>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(capture.title)} - X chat export</title>
<style>${css}</style>
<style>${OVERRIDES}</style>
</head>
<body>
<div class="xc-page">
  <div class="xc-header-wrap">${headerHtml}</div>
  <div class="xc-messages">
${itemsHtml}
  </div>
  <div class="xc-composer-wrap">${composerHtml}</div>
</div>
${CLICK_SCRIPT}
</body>
</html>`;
}
