import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";
import ts from "typescript";

const PRESERVE = [
  /^\/\/\/\s*<reference/,
  /^\/\*!/,
  /^\/\/!/,
  /biome-ignore/,
  /@ts-expect-error/,
  /@ts-ignore/,
  /@ts-nocheck/,
  /eslint-disable/,
  /eslint-enable/,
  /prettier-ignore/,
  /^\/\/\s*#region/,
  /^\/\/\s*#endregion/,
  /@jsxImportSource/,
  /webpackIgnore/,
  /@vitest-environment/,
  /v8 ignore/,
  /c8 ignore/,
  /istanbul ignore/,
];

const SCANNABLE = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

interface Range {
  pos: number;
  end: number;
}

function shouldPreserve(text: string): boolean {
  return PRESERVE.some((pattern) => pattern.test(text));
}

export function findRemovableComments(source: string, fileName: string): Range[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const seen = new Set<number>();
  const removable: Range[] = [];

  const consider = (ranges: ts.CommentRange[] | undefined) => {
    if (!ranges) return;
    for (const range of ranges) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      const text = source.slice(range.pos, range.end);
      const isShebang = range.pos === 0 && source.startsWith("#!");
      if (isShebang || shouldPreserve(text)) continue;
      removable.push({ pos: range.pos, end: range.end });
    }
  };

  const considerJsxExpression = (node: ts.JsxExpression) => {
    if (node.expression) return;
    const inner = source.slice(node.getStart(sourceFile) + 1, node.getEnd() - 1);
    const offset = node.getStart(sourceFile) + 1;
    const pattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
    let match = pattern.exec(inner);
    while (match !== null) {
      const pos = offset + match.index;
      if (!(seen.has(pos) || shouldPreserve(match[0]))) {
        seen.add(pos);
        removable.push({ pos, end: pos + match[0].length });
      }
      match = pattern.exec(inner);
    }
  };

  const visit = (node: ts.Node) => {
    if (node.getFullStart() !== node.getStart(sourceFile, true)) {
      consider(ts.getLeadingCommentRanges(source, node.getFullStart()));
    }
    consider(ts.getTrailingCommentRanges(source, node.getEnd()));
    if (ts.isJsxExpression(node)) considerJsxExpression(node);
    for (const child of node.getChildren(sourceFile)) visit(child);
  };

  visit(sourceFile);
  consider(ts.getLeadingCommentRanges(source, sourceFile.endOfFileToken.getFullStart()));

  return removable.sort((a, b) => a.pos - b.pos);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ported verbatim from shared tooling
function stripRanges(source: string, ranges: Range[]): string {
  let result = source;
  for (let i = ranges.length - 1; i >= 0; i--) {
    const range = ranges[i];
    if (range === undefined) continue;
    const { pos, end } = range;
    let start = pos;
    let stop = end;

    let lineStart = start;
    while (lineStart > 0 && source[lineStart - 1] !== "\n") lineStart--;
    const beforeOnLine = source.slice(lineStart, start);

    if (beforeOnLine.trim().length === 0) {
      start = lineStart;
      while (stop < source.length && source.charAt(stop) !== "\n") {
        if (source.charAt(stop).trim().length !== 0) break;
        stop++;
      }
      if (source.charAt(stop) === "\n") stop++;
    } else {
      while (start > 0 && (source[start - 1] === " " || source[start - 1] === "\t")) start--;
    }

    result = result.slice(0, start) + result.slice(stop);
  }
  return result.replace(/\n{3,}/g, "\n\n");
}

function trackedFiles(): string[] {
  const listed = Bun.spawnSync(["git", "ls-files"], { cwd: process.cwd() });
  return new TextDecoder()
    .decode(listed.stdout)
    .split("\n")
    .filter((file) => file.length > 0 && SCANNABLE.has(extname(file)))
    .filter(
      (file) =>
        !(
          file.includes("/generated/") ||
          file.includes("/src/zod/") ||
          file.endsWith("next-env.d.ts")
        ),
    );
}

function run(): never {
  const checkOnly = Bun.argv.includes("--check");
  const files = trackedFiles();

  let offendingFiles = 0;
  let offendingComments = 0;
  const offenders: string[] = [];

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const removable = findRemovableComments(source, file);
    if (removable.length === 0) continue;

    offendingFiles += 1;
    offendingComments += removable.length;
    offenders.push(`${file}: ${removable.length}`);

    if (!checkOnly) {
      writeFileSync(file, stripRanges(source, removable));
    }
  }

  if (checkOnly) {
    if (offendingFiles === 0) {
      console.info(`no comments found in ${files.length} tracked source files`);
      process.exit(0);
    }
    console.error(`${offendingComments} comments across ${offendingFiles} files:\n`);
    for (const entry of offenders.slice(0, 50)) console.error(`  ${entry}`);
    if (offenders.length > 50) console.error(`  ... and ${offenders.length - 50} more`);
    console.error("\nRun: bun run strip-comments");
    process.exit(1);
  }

  console.info(`removed ${offendingComments} comments from ${offendingFiles} files`);
  process.exit(0);
}

if (import.meta.main) run();
