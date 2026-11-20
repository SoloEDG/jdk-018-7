import type { Rotation } from "../types";
import { applyMatrix, invertMatrix, solveAffine, type Mat6 } from "./affine";

export interface Pt {
  x: number;
  y: number;
}

/** 自然方向（未旋转）归一化坐标 → 旋转后展示方向的归一化坐标 */
export function naturalToDisplayed(r: Rotation, p: Pt): Pt {
  switch (r) {
    case 90:
      return { x: 1 - p.y, y: p.x };
    case 180:
      return { x: 1 - p.x, y: 1 - p.y };
    case 270:
      return { x: p.y, y: 1 - p.x };
    default:
      return { ...p };
  }
}

/** 展示方向 → 自然方向（上一函数的逆） */
export function displayedToNatural(r: Rotation, p: Pt): Pt {
  switch (r) {
    case 90:
      return { x: p.y, y: 1 - p.x };
    case 180:
      return { x: 1 - p.x, y: 1 - p.y };
    case 270:
      return { x: 1 - p.y, y: p.x };
    default:
      return { ...p };
  }
}

/** 把三个点映射写成齐次仿射矩阵（列序 p1,p2,p3 → q1,q2,q3），奇异返回 null */
export function matrixFromTriples(
  from: [Pt, Pt, Pt],
  to: [Pt, Pt, Pt],
): Mat6 | null {
  const pairs = from.map((p, i) => ({ from: p, to: to[i]! }));
  return solveAffine(pairs);
}

/** 单位正方形四个角（顺时针） */
export function unitQuad(): Pt[] {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
}

export function transformQuad(m: Mat6, quad: Pt[]): Pt[] {
  return quad.map((p) => applyMatrix(m, p));
}

/**
 * 版本网格局部坐标（单元格归一化 [0,1]²）→ 自然来源归一化坐标 的仿射矩阵。
 * 局部 → 展示图：平移到裁剪框；展示 → 自然：反向旋转。
 */
export function gridLocalToNatural(
  rotation: Rotation,
  crop: { x: number; y: number; width: number; height: number },
): Mat6 | null {
  const localToDisplayed: Mat6 = [
    crop.width, 0, crop.x,
    0, crop.height, crop.y,
  ];
  const corners = unitQuad();
  const nat = corners.map((p) =>
    displayedToNatural(rotation, applyMatrix(localToDisplayed, p)),
  );
  return matrixFromTriples(
    [corners[0]!, corners[1]!, corners[3]!],
    [nat[0]!, nat[1]!, nat[3]!],
  );
}

/** 自然来源坐标 → 网格局部坐标（逆矩阵），用于判定来源点落在哪个单元格 */
export function naturalToGridLocal(
  rotation: Rotation,
  crop: { x: number; y: number; width: number; height: number },
): Mat6 | null {
  const m = gridLocalToNatural(rotation, crop);
  return m ? invertMatrix(m) : null;
}

/** Sutherland–Hodgman 多边形裁剪，保留 subject 在 clip 凸多边形内的部分 */
export function clipPolygon(subject: Pt[], clip: Pt[]): Pt[] {
  let out = subject.slice();
  for (let i = 0; i < clip.length; i++) {
    if (out.length === 0) break;
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const input = out;
    out = [];
    const inside = (p: Pt) =>
      (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= -1e-12;
    for (let j = 0; j < input.length; j++) {
      const cur = input[j]!;
      const prev = input[(j + input.length - 1) % input.length]!;
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) out.push(intersect(prev, cur, a, b));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect(prev, cur, a, b));
      }
    }
  }
  return out;
}

function intersect(p1: Pt, p2: Pt, a: Pt, b: Pt): Pt {
  const x1 = p1.x,
    y1 = p1.y,
    x2 = p2.x,
    y2 = p2.y;
  const x3 = a.x,
    y3 = a.y,
    x4 = b.x,
    y4 = b.y;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  const t =
    ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / (den || 1e-12);
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

/**
 * 凸多边形差集 A \\ B（B 须为凸）。
 * 沿 B 的每条边把当前多边形分裂为边外侧/内侧两部分：
 * 外侧碎片直接收集为结果，内侧部分继续处理后续边。
 */
export function polygonDifference(a: Pt[], b: Pt[]): Pt[][] {
  const shared = clipPolygon(a, b);
  if (shared.length === 0) return [a.slice()];
  const pieces: Pt[][] = [];
  let inside: Pt[] = a.slice();
  for (let i = 0; i < b.length && inside.length >= 3; i++) {
    const p = b[i]!;
    const q = b[(i + 1) % b.length]!;
    const insideOf = (pt: Pt) =>
      (q.x - p.x) * (pt.y - p.y) - (q.y - p.y) * (pt.x - p.x) >= -1e-12;
    const outPart: Pt[] = [];
    const inPart: Pt[] = [];
    for (let j = 0; j < inside.length; j++) {
      const cur = inside[j]!;
      const prev = inside[(j + inside.length - 1) % inside.length]!;
      const curIn = insideOf(cur);
      const prevIn = insideOf(prev);
      if (curIn) {
        if (!prevIn) {
          const hit = intersect(prev, cur, p, q);
          outPart.push(hit);
          inPart.push(hit);
        }
        inPart.push(cur);
      } else {
        if (prevIn) {
          const hit = intersect(prev, cur, p, q);
          outPart.push(hit);
          inPart.push(hit);
        }
        outPart.push(cur);
      }
    }
    if (outPart.length >= 3) pieces.push(outPart);
    inside = inPart;
  }
  return pieces;
}

export function polygonArea(poly: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
