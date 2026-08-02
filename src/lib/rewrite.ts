import { fixNestedAnchors } from "./anchors";

export interface RewriteOptions {
  assetManifest: Record<string, string>;
  blobFileNames: Record<string, string>;
}

export function rewriteItemHtml(html: string, options: RewriteOptions): string {
  let out = fixNestedAnchors(html);
  for (const [url, name] of Object.entries(options.assetManifest)) {
    out = out.split(url).join(`assets/${name}`);
  }
  out = out.replace(/\s+srcset="[^"]*"/g, "");
  out = out.replace(/<video /g, "<video muted ");
  out = out.replace(/(href|data-href)="\//g, '$1="https://x.com/');
  out = out.replace(/<a /g, '<a target="_blank" rel="noopener" ');
  return out;
}

export function replaceBlobSources(html: string, messageKey: string, fileName: string): string {
  if (!html.includes(`data-testid="${messageKey}"`)) return html;
  return html.replace(/src="blob:[^"]+"/g, `src="assets/${fileName}"`);
}

export function rewriteFontUrls(css: string, availableFiles: string[]): string {
  const available = new Set(availableFiles);
  return css.replace(/https:\/\/abs\.twimg\.com\/[^")]+\.woff2?/g, (url) => {
    const base = url.split("/").pop() ?? "";
    return available.has(base) ? `fonts/${base}` : url;
  });
}
