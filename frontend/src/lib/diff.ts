export type DiffLine = { kind: "same" | "add" | "del"; text: string; oldNo?: number; newNo?: number };

const MAX_CELLS = 4_000_000; // LCS table limit (~16 MB); beyond it the changed middle is shown as replaced

const lines = (s: string) => {
  const out = s.split(/\r?\n/);
  if (out.length && out[out.length - 1] === "") out.pop();
  return out;
};

/** Line diff: common prefix and suffix are matched directly, the middle with a longest-common-subsequence table. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = lines(before), b = lines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }

  const out: DiffLine[] = [];
  for (let i = 0; i < start; i++) out.push({ kind: "same", text: a[i], oldNo: i + 1, newNo: i + 1 });
  const midA = a.slice(start, endA), midB = b.slice(start, endB);
  const n = midA.length, m = midB.length;
  if (n * m > MAX_CELLS) {
    midA.forEach((t, i) => out.push({ kind: "del", text: t, oldNo: start + i + 1 }));
    midB.forEach((t, j) => out.push({ kind: "add", text: t, newNo: start + j + 1 }));
  } else {
    const w = m + 1;
    const lcs = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        lcs[i * w + j] = midA[i] === midB[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && midA[i] === midB[j]) { out.push({ kind: "same", text: midA[i], oldNo: start + i + 1, newNo: start + j + 1 }); i++; j++; }
      else if (i < n && (j === m || lcs[(i + 1) * w + j] >= lcs[i * w + j + 1])) { out.push({ kind: "del", text: midA[i], oldNo: start + i + 1 }); i++; } // removals first
      else { out.push({ kind: "add", text: midB[j], newNo: start + j + 1 }); j++; }
    }
  }
  for (let k = 0; k < a.length - endA; k++) out.push({ kind: "same", text: a[endA + k], oldNo: endA + k + 1, newNo: endB + k + 1 });
  return out;
}

export const diffStats = (d: DiffLine[]) => ({ added: d.filter((l) => l.kind === "add").length, removed: d.filter((l) => l.kind === "del").length });
