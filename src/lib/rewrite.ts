import { fixNestedAnchors } from "./anchors";

export interface RewriteOptions {
  assetManifest: Record<string, string>;
  blobFileNames: Record<string, string>;
}

const MISSING_MEDIA_PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="#202327"/><text x="50%" y="50%" fill="#71767b" font-family="sans-serif" font-size="13" text-anchor="middle">media unavailable</text></svg>',
  );

export function rewriteItemHtml(html: string, options: RewriteOptions): string {
  let out = fixNestedAnchors(html);
  for (const [url, name] of Object.entries(options.assetManifest)) {
    out = out.split(url).join(`assets/${name}`);
  }
  for (const [url, name] of Object.entries(options.blobFileNames)) {
    out = out.split(`src="${url}"`).join(`src="assets/${name}"`);
  }
  out = out.replace(/src="blob:[^"]+"/g, `src="${MISSING_MEDIA_PLACEHOLDER}"`);
  out = out.replace(/\s+srcset="[^"]*"/g, "");
  out = out.replace(/<video /g, "<video muted ");
  out = out.replace(/(href|data-href)="\//g, '$1="https://x.com/');
  out = out.replace(/<a /g, '<a target="_blank" rel="noopener" ');
  return out;
}

export function rewriteFontUrls(css: string, availableFiles: string[]): string {
  const available = new Set(availableFiles);
  return css.replace(/https:\/\/abs\.twimg\.com\/[^")]+\.woff2?/g, (url) => {
    const base = url.split("/").pop() ?? "";
    return available.has(base) ? `fonts/${base}` : url;
  });
}
