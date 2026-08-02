export function mergeWindow(order: string[], windowKeys: string[]): string[] {
  const merged = [...order];
  const common = windowKeys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => merged.includes(key));
  const first = common[0];
  if (first === undefined) {
    return [...windowKeys, ...merged];
  }
  const firstPos = merged.indexOf(first.key);
  const before = windowKeys.slice(0, first.index).filter((key) => !merged.includes(key));
  merged.splice(firstPos, 0, ...before);
  let anchor = firstPos + before.length;
  for (let i = first.index + 1; i < windowKeys.length; i++) {
    const key = windowKeys[i];
    if (key === undefined) continue;
    const pos = merged.indexOf(key);
    if (pos === -1) {
      merged.splice(anchor + 1, 0, key);
      anchor += 1;
    } else {
      anchor = pos;
    }
  }
  return merged;
}
