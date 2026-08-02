import { describe, expect, test } from "bun:test";
import {
  blobAssetName,
  buildAssetManifest,
  extractAssetUrls,
  extractChirpFontUrls,
  fontFileName,
  localAssetName,
} from "../src/lib/assets";

describe("extractAssetUrls", () => {
  test("finds img, video and background-image urls", () => {
    const html = [
      '<img src="https://pbs.twimg.com/media/abc.jpg" alt="">',
      '<video src="https://video.twimg.com/amplify_video/1/vid/avc1/720x1280/x.mp4?tag=21"></video>',
      '<div style="background-image: url(&quot;https://pbs.twimg.com/profile_images/1/y_normal.jpg&quot;);"></div>',
    ].join("");
    const urls = extractAssetUrls([html]);
    expect(urls).toHaveLength(3);
    expect(urls.some((u) => u.endsWith("abc.jpg"))).toBe(true);
    expect(urls.some((u) => u.includes("amplify_video"))).toBe(true);
    expect(urls.some((u) => u.includes("profile_images"))).toBe(true);
  });

  test("deduplicates urls across blobs", () => {
    const html = '<img src="https://pbs.twimg.com/media/same.jpg">';
    expect(extractAssetUrls([html, html])).toHaveLength(1);
  });

  test("ignores blob and relative sources", () => {
    const html = '<video src="blob:https://x.com/uuid"></video><img src="/local.png">';
    expect(extractAssetUrls([html])).toHaveLength(0);
  });
});

describe("localAssetName", () => {
  test("keeps the basename and extension", () => {
    const name = localAssetName("https://pbs.twimg.com/media/abc.jpg");
    expect(name.startsWith("abc_")).toBe(true);
    expect(name.endsWith(".jpg")).toBe(true);
  });

  test("derives the extension from a format query param", () => {
    const name = localAssetName("https://pbs.twimg.com/media/abc?format=png&name=small");
    expect(name.endsWith(".png")).toBe(true);
  });

  test("is deterministic and collision-resistant per url", () => {
    const a = localAssetName("https://pbs.twimg.com/media/abc.jpg?name=small");
    const b = localAssetName("https://pbs.twimg.com/media/abc.jpg?name=large");
    expect(a).toBe(localAssetName("https://pbs.twimg.com/media/abc.jpg?name=small"));
    expect(a).not.toBe(b);
  });
});

describe("buildAssetManifest", () => {
  test("maps every url to a local name", () => {
    const urls = ["https://pbs.twimg.com/media/a.jpg", "https://pbs.twimg.com/media/b.jpg"];
    const manifest = buildAssetManifest(urls);
    expect(Object.keys(manifest)).toEqual(urls);
    expect(new Set(Object.values(manifest)).size).toBe(2);
  });
});

describe("extractChirpFontUrls", () => {
  test("selects only chirp woff2 urls", () => {
    const css = [
      '@font-face { font-family: TwitterChirp; src: url("https://abs.twimg.com/fonts/subset/Chirp-Regular.aa.latin.woff2") format("woff2"); }',
      '@font-face { font-family: Vazirmatn; src: url("https://abs.twimg.com/responsive-web/client-web/Vazirmatn-Bold.bb.woff2") format("woff2"); }',
    ].join("\n");
    const urls = extractChirpFontUrls(css);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("Chirp-Regular");
  });
});

describe("blobAssetName", () => {
  test("derives extension from the mime type", () => {
    expect(blobAssetName("blob:https://x.com/aaa", "image/jpeg").endsWith(".jpg")).toBe(true);
    expect(blobAssetName("blob:https://x.com/aaa", "video/mp4").endsWith(".mp4")).toBe(true);
    expect(
      blobAssetName("blob:https://x.com/aaa", "application/octet-stream").endsWith(".bin"),
    ).toBe(true);
  });

  test("distinct urls get distinct names", () => {
    expect(blobAssetName("blob:https://x.com/aaa", "image/jpeg")).not.toBe(
      blobAssetName("blob:https://x.com/bbb", "image/jpeg"),
    );
  });
});

describe("fontFileName", () => {
  test("returns the basename", () => {
    expect(fontFileName("https://abs.twimg.com/fonts/subset/Chirp-Bold.cc.latin.woff2")).toBe(
      "Chirp-Bold.cc.latin.woff2",
    );
  });
});
