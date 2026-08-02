import { describe, expect, test } from "bun:test";
import { replaceBlobSources, rewriteFontUrls, rewriteItemHtml } from "../src/lib/rewrite";

const options = {
  assetManifest: {
    "https://pbs.twimg.com/media/abc.jpg": "abc_12345678.jpg",
  },
  blobFileNames: {},
};

describe("rewriteItemHtml", () => {
  test("points sources at local assets", () => {
    const out = rewriteItemHtml('<img src="https://pbs.twimg.com/media/abc.jpg">', options);
    expect(out).toContain('src="assets/abc_12345678.jpg"');
  });

  test("strips srcset attributes", () => {
    const out = rewriteItemHtml(
      '<img src="https://pbs.twimg.com/media/abc.jpg" srcset="https://pbs.twimg.com/media/abc.jpg 1x">',
      options,
    );
    expect(out).not.toContain("srcset");
  });

  test("mutes videos so autoplay keeps working offline", () => {
    const out = rewriteItemHtml('<video src="https://pbs.twimg.com/media/abc.jpg" autoplay>', {
      assetManifest: {},
      blobFileNames: {},
    });
    expect(out).toContain("<video muted ");
  });

  test("absolutizes relative profile links and opens them in a new tab", () => {
    const out = rewriteItemHtml('<a href="/someuser">user</a>', options);
    expect(out).toBe(
      '<a target="_blank" rel="noopener" href="https://x.com/someuser">user</a>',
    );
  });

  test("converts nested card anchors before adding targets", () => {
    const html = '<a href="/u/status/1"><a href="/u">u</a></a>';
    const out = rewriteItemHtml(html, options);
    expect(out).toContain('data-card-link="1"');
    expect(out).toContain('data-href="https://x.com/u/status/1"');
  });
});

describe("replaceBlobSources", () => {
  test("replaces blob sources only inside the matching message", () => {
    const html =
      '<div data-testid="message-1"><video src="blob:https://x.com/uuid"></video></div>';
    const out = replaceBlobSources(html, "message-1", "dm_video_message-1.mp4");
    expect(out).toContain('src="assets/dm_video_message-1.mp4"');
    expect(replaceBlobSources(html, "message-2", "x.mp4")).toBe(html);
  });
});

describe("rewriteFontUrls", () => {
  test("rewrites only fonts that were downloaded", () => {
    const css =
      'src: url("https://abs.twimg.com/fonts/a.woff2"); src: url("https://abs.twimg.com/fonts/b.woff2");';
    const out = rewriteFontUrls(css, ["a.woff2"]);
    expect(out).toContain('url("fonts/a.woff2")');
    expect(out).toContain('url("https://abs.twimg.com/fonts/b.woff2")');
  });
});
