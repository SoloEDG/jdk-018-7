import type {
  Alignment,
  AlignmentFailure,
  Anchor,
} from "../types";

export type Mat6 = [number, number, number, number, number, number];

export interface PointPair {
  from: Anchor;
  to: Anchor;
}

/** 最少需要的锚点对数（2 对定相似/仿射退化，3 对才能定一般仿射） */
export const MIN_ANCHOR_PAIRS = 3;
/** 近共线判定：有向面积中位数低于该值视为共线（归一化坐标） */
export const COLLINEAR_EPS = 0.002;
/** 默认 RMSE 上限（归一化坐标，约等于原图 3% 的边长误差） */
export const DEFAULT_RMSE_LIMIT = 0.03;

export function applyMatrix(m: Mat6, p: Anchor): Anchor {
  return {
    x: m[0] * p.x + m[1] * p.y + m[2],
    y: m[3] * p.x + m[4] * p.y + m[5],
  };
}

export function invertMatrix(m: Mat6): Mat6 | null {
  const [a, b, c, d, e, f] = m;
  const det = a * e - b * d;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [
    e * inv,
    -b * inv,
    (b * f - c * e) * inv,
    -d * inv,
    a * inv,
    (c * d - a * f) * inv,
  ];
}

/** 两个仿射矩阵复合：先做 inner 再做 outer */
export function composeMatrix(outer: Mat6, inner: Mat6): Mat6 {
  const [a, b, c, d, e, f] = outer;
  const [g, h, i, j, k, l] = inner;
  return [
    a * g + b * j,
    a * h + b * k,
    a * i + b * l + c,
    d * g + e * j,
    d * h + e * k,
    d * i + e * l + f,
  ];
}

/** 三角形有向面积（归一化坐标的两倍面积） */
function triArea2(p1: Anchor, p2: Anchor, p3: Anchor): number {
  return (
    (p2.x - p1.x) * (p3.y - p1.y) -
    (p2.y - p1.y) * (p3.x - p1.x)
  );
}

/** 近共线检测：所有三点组合面积的中位数过小 */
export function isNearCollinear(points: Anchor[]): boolean {
  if (points.length < 3) return true;
  const areas: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      for (let k = j + 1; k < points.length; k++) {
        areas.push(
          Math.abs(triArea2(points[i]!, points[j]!, points[k]!)) / 2,
        );
      }
    }
  }
  areas.sort((x, y) => x - y);
  const median = areas[Math.floor(areas.length / 2)]!;
  return median < COLLINEAR_EPS;
}

/**
 * 由锚点对求解 from → to 的最小二乘仿射变换。
 * 分别对 x、y 解两个 3 元正规方程，奇异（行列式≈0）时返回 null。
 */
export function solveAffine(pairs: PointPair[]): Mat6 | null {
  // S = Σ [x², xy, x; xy, y², y; x, y, 1]
  const s = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const bx = [0, 0, 0];
  const by = [0, 0, 0];
  for (const { from, to } of pairs) {
    const { x, y } = from;
    const xx = x * x,
      xy = x * y,
      yy = y * y;
    s[0] += xx; s[1] += xy; s[2] += x;
    s[3] += xy; s[4] += yy; s[5] += y;
    s[6] += x;  s[7] += y;  s[8] += 1;
    bx[0] += to.x * x; bx[1] += to.x * y; bx[2] += to.x;
    by[0] += to.y * x; by[1] += to.y * y; by[2] += to.y;
  }
  const det =
    s[0] * (s[4] * s[8] - s[5] * s[7]) -
    s[1] * (s[3] * s[8] - s[5] * s[6]) +
    s[2] * (s[3] * s[7] - s[4] * s[6]);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;

  function solve(rhs: number[]): [number, number, number] | null {
    // 克莱姆法则（3 阶）
    const d0 =
      rhs[0] * (s[4] * s[8] - s[5] * s[7]) -
      s[1] * (rhs[1] * s[8] - s[5] * rhs[2]) +
      s[2] * (rhs[1] * s[7] - s[4] * rhs[2]);
    const d1 =
      s[0] * (rhs[1] * s[8] - s[5] * rhs[2]) -
      rhs[0] * (s[3] * s[8] - s[5] * s[6]) +
      s[2] * (s[3] * rhs[2] - rhs[1] * s[6]);
    const d2 =
      s[0] * (s[4] * rhs[2] - rhs[1] * s[7]) -
      s[1] * (s[3] * rhs[2] - rhs[1] * s[6]) +
      rhs[0] * (s[3] * s[7] - s[4] * s[6]);
    const vals = [d0 / det, d1 / det, d2 / det];
    if (vals.some((v) => !Number.isFinite(v))) return null;
    return [vals[0]!, vals[1]!, vals[2]!];
  }

  const xPart = solve(bx);
  const yPart = solve(by);
  if (!xPart || !yPart) return null;
  return [xPart[0], xPart[1], xPart[2], yPart[0], yPart[1], yPart[2]];
}

export function rmseOf(m: Mat6, pairs: PointPair[]): number {
  let sum = 0;
  for (const { from, to } of pairs) {
    const p = applyMatrix(m, from);
    sum += (p.x - to.x) ** 2 + (p.y - to.y) ** 2;
  }
  return Math.sqrt(sum / pairs.length);
}

export function anchorSignature(pairs: PointPair[]): string {
  return pairs
    .map(
      (p) =>
        `${p.from.x.toFixed(5)},${p.from.y.toFixed(5)}>` +
        `${p.to.x.toFixed(5)},${p.to.y.toFixed(5)}`,
    )
    .join("|");
}

export interface SolveResult {
  alignment?: Alignment;
  failure?: AlignmentFailure;
}

/**
 * 尝试一次完整配准：
 * 1. 锚点对不足 → too-few
 * 2. 任一侧近共线 → near-collinear
 * 3. 方程奇异 → singular
 * 4. RMSE 超阈值 → high-error
 * 失败时不产出新对齐，由调用方保留上次有效结果。
 */
export function tryAlign(
  fromId: string,
  toId: string,
  pairs: PointPair[],
  rmseLimit = DEFAULT_RMSE_LIMIT,
): SolveResult {
  if (pairs.length < MIN_ANCHOR_PAIRS) {
    return {
      failure: {
        issue: "too-few",
        message: `锚点对不足：至少需要 ${MIN_ANCHOR_PAIRS} 对对应锚点，当前 ${pairs.length} 对，已保留上次有效对齐`,
      },
    };
  }
  const fromPts = pairs.map((p) => p.from);
  const toPts = pairs.map((p) => p.to);
  if (isNearCollinear(fromPts) || isNearCollinear(toPts)) {
    return {
      failure: {
        issue: "near-collinear",
        message:
          "锚点近似共线，无法稳定求解仿射变换，请增加偏离锚点所在直线的锚点；已保留上次有效对齐",
      },
    };
  }
  const matrix = solveAffine(pairs);
  if (!matrix) {
    return {
      failure: {
        issue: "singular",
        message:
          "锚点构型退化导致变换矩阵奇异，请调整锚点分布；已保留上次有效对齐",
      },
    };
  }
  const rmse = rmseOf(matrix, pairs);
  if (rmse > rmseLimit) {
    return {
      failure: {
        issue: "high-error",
        rmse,
        message: `配准误差过大：RMSE=${(rmse * 100).toFixed(2)}%（上限 ${(rmseLimit * 100).toFixed(0)}%），请核对锚点对应关系；已保留上次有效对齐`,
      },
    };
  }
  return {
    alignment: {
      fromId,
      toId,
      matrix,
      rmse,
      pointCount: pairs.length,
      anchorSignature: anchorSignature(pairs),
      createdAt: Date.now(),
    },
  };
}
