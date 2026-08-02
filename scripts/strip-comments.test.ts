import { describe, expect, it } from "bun:test";
import { findRemovableComments } from "./strip-comments";

function removedTexts(source: string, fileName = "sample.ts"): string[] {
  return findRemovableComments(source, fileName).map((range) => source.slice(range.pos, range.end));
}

describe("findRemovableComments", () => {
  it("removes line and block comments", () => {
    const source = ["// leading", "const a = 1;", "/* block */", "const b = 2;"].join("\n");
    expect(removedTexts(source)).toEqual(["// leading", "/* block */"]);
  });

  it("removes trailing comments", () => {
    expect(removedTexts("const a = 1; // trailing")).toEqual(["// trailing"]);
  });

  it("removes jsdoc blocks", () => {
    const source = "/**\n * docs\n */\nexport const a = 1;";
    expect(removedTexts(source)).toEqual(["/**\n * docs\n */"]);
  });

  it("never touches // inside a string literal", () => {
    expect(removedTexts('const url = "https://example.com//path";')).toEqual([]);
  });

  it("never touches // inside a template literal", () => {
    const source = "const t = `${x} // not a comment`;";
    expect(removedTexts(source)).toEqual([]);
  });

  it("never touches // inside a multi-line template literal", () => {
    const source = "const t = `line1\n// still inside the template\nline3`;";
    expect(removedTexts(source)).toEqual([]);
  });

  it("never touches // inside a regex literal", () => {
    expect(removedTexts("const re = /\\/\\/ not a comment/g;")).toEqual([]);
  });

  it("preserves biome-ignore directives", () => {
    const source = "// biome-ignore lint/suspicious/noExplicitAny: needed\nconst a: any = 1;";
    expect(removedTexts(source)).toEqual([]);
  });

  it("preserves ts directives", () => {
    expect(removedTexts("// @ts-expect-error legacy\nconst a = b;")).toEqual([]);
    expect(removedTexts("// @ts-ignore legacy\nconst a = b;")).toEqual([]);
  });

  it("preserves license blocks", () => {
    expect(removedTexts("/*! (c) someone */\nconst a = 1;")).toEqual([]);
  });

  it("preserves a deliberate line comment", () => {
    expect(removedTexts("//! kept on purpose\nconst a = 1;")).toEqual([]);
  });

  it("preserves a deliberate trailing comment", () => {
    expect(removedTexts("const a = 1; //! kept on purpose")).toEqual([]);
  });

  it("preserves a deliberate block comment", () => {
    const source = "/*!\n  kept on purpose\n*/\nconst a = 1;";
    expect(removedTexts(source)).toEqual([]);
  });

  it("preserves a deliberate comment inside jsx", () => {
    const source = "export const C = () => (\n  <div>{/*! kept */}</div>\n);";
    expect(removedTexts(source, "sample.tsx")).toEqual([]);
  });

  it("removes an ordinary comment that merely contains an exclamation", () => {
    expect(removedTexts("// wow! important\nconst a = 1;")).toEqual(["// wow! important"]);
  });

  it("removes a comment whose exclamation is not the first character", () => {
    expect(removedTexts("// ! not a marker\nconst a = 1;")).toEqual(["// ! not a marker"]);
  });

  it("preserves triple-slash references", () => {
    expect(removedTexts('/// <reference types="node" />\nconst a = 1;')).toEqual([]);
  });

  it("preserves a shebang", () => {
    expect(removedTexts("#!/usr/bin/env bun\nconst a = 1;")).toEqual([]);
  });

  it("handles tsx", () => {
    const source = "export const C = () => (\n  <div>{/* jsx comment */}</div>\n);";
    expect(removedTexts(source, "sample.tsx")).toEqual(["/* jsx comment */"]);
  });

  it("does not report the same comment twice", () => {
    const source = "// one\nconst a = 1;\n// two\nconst b = 2;";
    expect(removedTexts(source)).toHaveLength(2);
  });
});

describe("comments after punctuation", () => {
  it("removes a trailing comment after a comma in an object literal", () => {
    const source = "const o = {\n\ta: 1, // why\n\tb: 2,\n};";
    expect(removedTexts(source)).toEqual(["// why"]);
  });

  it("removes a trailing comment after a comma in an array", () => {
    const source = "const a = [\n\t1, // one\n\t2,\n];";
    expect(removedTexts(source)).toEqual(["// one"]);
  });

  it("removes a comment after a closing brace", () => {
    const source = "function f() {\n\treturn 1;\n} // done";
    expect(removedTexts(source)).toEqual(["// done"]);
  });
});
