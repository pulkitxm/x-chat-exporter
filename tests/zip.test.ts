import { describe, expect, test } from "bun:test";
import { buildZip, crc32 } from "../src/lib/zip";

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function readU16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

describe("crc32", () => {
  test("matches the reference value for a known vector", () => {
    const bytes = new TextEncoder().encode("123456789");
    expect(crc32(bytes)).toBe(0xcbf43926);
  });

  test("empty input yields zero", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("buildZip", () => {
  const encoder = new TextEncoder();
  const entries = [
    { name: "index.html", data: encoder.encode("<html>hello</html>") },
    { name: "assets/pic.jpg", data: new Uint8Array([1, 2, 3, 4, 5]) },
  ];

  test("starts with a local file header signature", () => {
    const zip = buildZip(entries);
    expect(readU32(zip, 0)).toBe(0x04034b50);
  });

  test("ends with an end-of-central-directory record naming every entry", () => {
    const zip = buildZip(entries);
    const eocd = zip.length - 22;
    expect(readU32(zip, eocd)).toBe(0x06054b50);
    expect(readU16(zip, eocd + 10)).toBe(entries.length);
  });

  test("stores entry data verbatim with a valid crc", () => {
    const zip = buildZip(entries);
    let offset = 0;
    for (const entry of entries) {
      expect(readU32(zip, offset)).toBe(0x04034b50);
      const crc = readU32(zip, offset + 14);
      const size = readU32(zip, offset + 18);
      const nameLength = readU16(zip, offset + 26);
      const name = new TextDecoder().decode(zip.subarray(offset + 30, offset + 30 + nameLength));
      expect(name).toBe(entry.name);
      expect(size).toBe(entry.data.length);
      const data = zip.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
      expect([...data]).toEqual([...entry.data]);
      expect(crc).toBe(crc32(entry.data));
      offset += 30 + nameLength + size;
    }
  });

  test("central directory offsets point at local headers", () => {
    const zip = buildZip(entries);
    const eocd = zip.length - 22;
    const centralStart = readU32(zip, eocd + 16);
    expect(readU32(zip, centralStart)).toBe(0x02014b50);
    const firstOffset = readU32(zip, centralStart + 42);
    expect(readU32(zip, firstOffset)).toBe(0x04034b50);
  });
});
