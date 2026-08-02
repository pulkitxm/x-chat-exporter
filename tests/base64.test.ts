import { describe, expect, test } from "bun:test";
import { base64ToBytes, bytesToBase64 } from "../src/lib/base64";

describe("base64 round trip", () => {
  test("encodes and decodes arbitrary bytes", () => {
    const bytes = new Uint8Array(70000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    const decoded = base64ToBytes(bytesToBase64(bytes));
    expect(decoded.length).toBe(bytes.length);
    expect([...decoded.subarray(0, 300)]).toEqual([...bytes.subarray(0, 300)]);
    expect([...decoded.subarray(-300)]).toEqual([...bytes.subarray(-300)]);
  });

  test("handles empty input", () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe("");
    expect(base64ToBytes("").length).toBe(0);
  });
});
