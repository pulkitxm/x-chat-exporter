import { describe, expect, test } from "bun:test";
import { mergeWindow } from "../src/lib/merge";

describe("mergeWindow", () => {
  test("starts from an empty order", () => {
    expect(mergeWindow([], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  test("prepends a disjoint window seen while scrolling up", () => {
    expect(mergeWindow(["d", "e"], ["a", "b", "c"])).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("merges an overlapping window without duplicates", () => {
    expect(mergeWindow(["c", "d", "e"], ["a", "b", "c", "d"])).toEqual(["a", "b", "c", "d", "e"]);
  });

  test("inserts newly mounted items between known neighbours", () => {
    expect(mergeWindow(["a", "d"], ["a", "b", "c", "d"])).toEqual(["a", "b", "c", "d"]);
  });

  test("is stable when the window repeats", () => {
    const once = mergeWindow(["a", "b", "c"], ["b", "c"]);
    expect(mergeWindow(once, ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  test("reconstructs a full history from sliding windows", () => {
    const truth = Array.from({ length: 40 }, (_, i) => `m${i}`);
    let order: string[] = [];
    for (let start = 36; start >= 0; start -= 2) {
      order = mergeWindow(order, truth.slice(start, start + 6));
    }
    expect(order).toEqual(truth.slice(0, 42));
  });
});
