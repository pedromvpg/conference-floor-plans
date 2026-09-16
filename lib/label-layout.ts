const LINE_EM = 1.12;

export const LABEL_LINE_EM = LINE_EM;

export function wrapLabelLines(text: string, maxChars: number): string[] {
  const limit = Math.max(1, Math.floor(maxChars));
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const pieces = splitLongToken(word, limit);
    for (const piece of pieces) {
      const next = cur ? `${cur} ${piece}` : piece;
      if (next.length <= limit) {
        cur = next;
      } else {
        if (cur) lines.push(cur);
        cur = piece;
      }
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function splitLongToken(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  const out: string[] = [];
  for (let i = 0; i < word.length; i += maxChars) out.push(word.slice(i, i + maxChars));
  return out;
}

export function fitLabelInBox(
  text: string,
  boxW: number,
  boxH: number,
  preferredFont: number,
  opts?: { minFont?: number; charWidthEm?: number; lineEm?: number },
): { fontSize: number; lines: string[] } {
  const trimmed = text.trim();
  if (!trimmed) return { fontSize: preferredFont, lines: [] };
  const charWidthEm = opts?.charWidthEm ?? 0.62;
  const lineEm = opts?.lineEm ?? LINE_EM;
  const minFont = Math.max(1e-4, opts?.minFont ?? preferredFont * 0.32);
  let fontSize = Math.max(minFont, preferredFont);
  let lines = wrapLabelLines(trimmed, charsFor(boxW, fontSize, charWidthEm));
  for (let i = 0; i < 20; i++) {
    const height = lines.length * fontSize * lineEm;
    if (height <= boxH || fontSize <= minFont + 1e-9) break;
    fontSize = Math.max(minFont, fontSize * 0.88);
    lines = wrapLabelLines(trimmed, charsFor(boxW, fontSize, charWidthEm));
  }
  return { fontSize, lines };
}

function charsFor(boxW: number, fontSize: number, charWidthEm: number): number {
  return Math.max(1, Math.floor(boxW / (fontSize * charWidthEm)));
}

export function worldTopLeftOfLocalBox(
  cx: number,
  cy: number,
  facingDeg: number,
  local: { minX: number; minY: number; maxX: number; maxY: number },
  inset = 0,
): { x: number; y: number } {
  const rad = (facingDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  };
  const corners = [
    rot(local.minX, local.minY),
    rot(local.maxX, local.minY),
    rot(local.maxX, local.maxY),
    rot(local.minX, local.maxY),
  ];
  corners.sort((a, b) => a.y - b.y || a.x - b.x);
  const corner = corners[0];
  if (!(inset > 0)) return corner;
  const dx = cx - corner.x;
  const dy = cy - corner.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(inset, len * 0.45);
  return { x: corner.x + (dx / len) * t, y: corner.y + (dy / len) * t };
}

export function svgCenteredTspans(
  x: string,
  y: string,
  fontSize: number,
  lines: string[],
  escape: (s: string) => string,
  lineEm = LINE_EM,
): string {
  if (!lines.length) return "";
  const cy = Number(y);
  const fs = fontSize;
  const lineH = fs * lineEm;
  return lines
    .map((line, i) => {
      const ly = cy + (i - (lines.length - 1) / 2) * lineH;
      return `<tspan x="${x}" y="${ly}">${escape(line)}</tspan>`;
    })
    .join("");
}
