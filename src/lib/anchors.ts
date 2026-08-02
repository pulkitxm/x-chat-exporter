interface OpenTag {
  pos: number;
  end: number;
  hasChildAnchor: boolean;
}

interface Edit {
  pos: number;
  end: number;
  text: string;
}

export function fixNestedAnchors(html: string): string {
  const tokenPattern = /<a[\s>]|<\/a>/g;
  const stack: OpenTag[] = [];
  const edits: Edit[] = [];
  let match = tokenPattern.exec(html);
  while (match !== null) {
    if (match[0] === "</a>") {
      const open = stack.pop();
      if (open?.hasChildAnchor) {
        let tag = html.slice(open.pos, open.end);
        tag = tag.replace(/^<a/, '<span data-card-link="1"').replace(/ href="/, ' data-href="');
        edits.push({ pos: open.pos, end: open.end, text: tag });
        edits.push({ pos: match.index, end: match.index + 4, text: "</span>" });
      }
    } else {
      for (const entry of stack) entry.hasChildAnchor = true;
      const tagEnd = html.indexOf(">", match.index);
      stack.push({ pos: match.index, end: tagEnd + 1, hasChildAnchor: false });
    }
    match = tokenPattern.exec(html);
  }
  edits.sort((a, b) => b.pos - a.pos);
  let out = html;
  for (const edit of edits) {
    out = out.slice(0, edit.pos) + edit.text + out.slice(edit.end);
  }
  return out;
}
