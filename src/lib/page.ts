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
.xc-zoomable { cursor: zoom-in; }
.xc-lightbox { position: fixed; inset: 0; z-index: 9999; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,0.93); }
.xc-lightbox.xc-open { display: flex; }
.xc-lightbox-stage { display: flex; align-items: center; justify-content: center; max-width: 94vw; max-height: 94vh; }
.xc-lightbox-stage img, .xc-lightbox-stage video { max-width: 94vw; max-height: 94vh; width: auto; height: auto; object-fit: contain; border-radius: 8px; background: #000; }
.xc-lightbox-close { position: absolute; top: 16px; right: 20px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 9999px; background: rgba(32,35,39,0.92); color: rgb(231,233,234); font: 400 26px/1 system-ui, sans-serif; cursor: pointer; }
.xc-lightbox-close:hover { background: rgb(47,51,54); }
`;

export const PAGE_SCRIPT_SOURCE = `(function () {
  var MIN_ZOOMABLE_WIDTH = 80;
  var overlay = document.createElement('div');
  overlay.className = 'xc-lightbox';
  var closeButton = document.createElement('button');
  closeButton.className = 'xc-lightbox-close';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.textContent = '\\u00d7';
  var stage = document.createElement('div');
  stage.className = 'xc-lightbox-stage';
  overlay.appendChild(closeButton);
  overlay.appendChild(stage);
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove('xc-open');
    stage.textContent = '';
  }

  function open(media) {
    stage.textContent = '';
    var source = media.currentSrc || media.src;
    var node;
    if (media.tagName === 'VIDEO') {
      node = document.createElement('video');
      node.src = source;
      node.controls = true;
      node.autoplay = true;
      node.loop = true;
      node.playsInline = true;
    } else {
      node = document.createElement('img');
      node.src = source;
      node.alt = media.alt || '';
    }
    stage.appendChild(node);
    overlay.classList.add('xc-open');
  }

  function zoomableMedia(target) {
    var media = target.closest('.xc-messages img, .xc-messages video');
    if (media === null) return null;
    if (!(media.currentSrc || media.src)) return null;
    if (media.getBoundingClientRect().width < MIN_ZOOMABLE_WIDTH) return null;
    return media;
  }

  function markZoomable() {
    var candidates = document.querySelectorAll('.xc-messages img, .xc-messages video');
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].getBoundingClientRect().width >= MIN_ZOOMABLE_WIDTH) {
        candidates[i].classList.add('xc-zoomable');
      }
    }
  }

  document.addEventListener('click', function (e) {
    if (overlay.contains(e.target)) {
      if (e.target.closest('.xc-lightbox-stage') === null) close();
      return;
    }
    var media = zoomableMedia(e.target);
    if (media !== null) {
      e.preventDefault();
      e.stopPropagation();
      open(media);
      return;
    }
    if (e.target.closest('a')) return;
    var card = e.target.closest('[data-card-link]');
    if (card && card.dataset.href) window.open(card.dataset.href, '_blank', 'noopener');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });

  window.addEventListener('load', markZoomable);
  markZoomable();
})();`;

const CLICK_SCRIPT = `<script>
${PAGE_SCRIPT_SOURCE}
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
