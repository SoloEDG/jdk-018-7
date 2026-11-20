import type {
  Alignment,
  Anchor,
  CompareMode,
  FrozenVersion,
} from "../types";
import {
  applyMatrix,
  composeMatrix,
  invertMatrix,
  type Mat6,
} from "./affine";
import {
  displayedToNatural,
  gridLocalToNatural,
  naturalToDisplayed,
  polygonDifference,
  transformQuad,
  unitQuad,
  type Pt,
} from "./geometry";

export interface CompareRenderOptions {
  base: FrozenVersion;
  target: FrozenVersion;
  alignment: Alignment | undefined;
  mode: CompareMode;
  showNonOverlap: boolean;
  showRuler: boolean;
  includeThumb: boolean;
  /** 可选：来源模式下另一版的问题提示，绘制到角注 */
  failureNote?: string;
}

const PLANE = 440;
const PAD = 64;
const COLOR_BASE = "#d5e99f";
const COLOR_TARGET = "#8fb4e8";
const COLOR_NONOVERLAP_BASE = "rgba(213,233,159,0.20)";
const COLOR_NONOVERLAP_TARGET = "rgba(143,180,232,0.22)";
const COLOR_HATCH = "rgba(255,255,255,0.28)";
const COLOR_ANCHOR = "#f2c14e";
const COLOR_TEXT_DIM = "#9aa0a6";

/** 屏幕模式：局部网格坐标 → 基准版展示归一化平面 */
function screenMatrix(v: FrozenVersion): Mat6 {
  return [v.crop.width, 0, v.crop.x, 0, v.crop.height, v.crop.y];
}

/** 来源模式：局部网格坐标 → 自然来源归一化平面 */
function sourceMatrix(v: FrozenVersion): Mat6 {
  return (
    gridLocalToNatural(v.rotation, v.crop) ?? [1, 0, 0, 0, 1, 0]
  );
}

function planeMatrix(
  v: FrozenVersion,
  mode: CompareMode,
): Mat6 {
  return mode === "screen" ? screenMatrix(v) : sourceMatrix(v);
}

interface Placement {
  version: FrozenVersion;
  /** 网格局部 → 平面归一化坐标 */
  toPlane: Mat6;
  quad: Pt[];
}

function placement(
  v: FrozenVersion,
  mode: CompareMode,
  alignment: Alignment | undefined,
  isTarget: boolean,
): Placement {
  const own = planeMatrix(v, mode);
  if (!isTarget || !alignment) {
    return { version: v, toPlane: own, quad: transformQuad(own, unitQuad()) };
  }
  // 目标版：先到它自己的平面，再经锚点仿射变换到基准版平面
  const toPlane = composeMatrix(alignment.matrix, own);
  return {
    version: v,
    toPlane,
    quad: transformQuad(toPlane, unitQuad()),
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** 把缩略图按版本自身的旋转关系贴到自然来源平面（来源模式用） */
function drawThumbSource(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  v: FrozenVersion,
  toPx: (p: Pt) => Pt,
) {
  const cornersDisplayed: Pt[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const natural = cornersDisplayed.map((p) =>
    displayedToNatural(v.rotation, p),
  );
  const px = natural.map(toPx);
  g.save();
  g.globalAlpha = 0.22;
  g.beginPath();
  g.moveTo(px[0]!.x, px[0]!.y);
  for (let i = 1; i < 4; i++) g.lineTo(px[i]!.x, px[i]!.y);
  g.closePath();
  g.clip();
  // 用三角形仿射贴图（四点拆两个三角形，兼容旋转/翻转）
  drawTexturedQuad(g, img, cornersDisplayed, px);
  g.restore();
}

function drawTexturedQuad(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  src: Pt[],
  dst: Pt[],
) {
  const tris: [number, number, number][] = [
    [0, 1, 2],
    [0, 2, 3],
  ];
  for (const [i, j, k] of tris) {
    drawTexturedTri(g, img, src[i]!, src[j]!, src[k]!, dst[i]!, dst[j]!, dst[k]!);
  }
}

function drawTexturedTri(
  g: CanvasRenderingContext2D,
  img: HTMLImageElement,
  s0: Pt,
  s1: Pt,
  s2: Pt,
  d0: Pt,
  d1: Pt,
  d2: Pt,
) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const den =
    (s1.y - s2.y) * (s0.x - s2.x) + (s2.x - s1.x) * (s0.y - s2.y);
  if (Math.abs(den) < 1e-12) return;
  // 仿射映射 M：源归一化坐标 → 目标像素坐标，令 M(si)=di
  const a =
    ((s1.y - s2.y) * (d0.x - d2.x) + (s2.x - s1.x) * (d0.y - d2.y)) / den;
  const b =
    ((s1.y - s2.y) * (d0.y - d2.y) - (s2.y - s1.y) * (d0.x - d2.x)) / den;
  const c =
    ((s2.y - s0.y) * (d0.x - d2.x) + (s0.x - s2.x) * (d0.y - d2.y)) / den;
  const d =
    ((s2.y - s0.y) * (d0.y - d2.y) - (s0.x - s2.y) * (d0.x - d2.x)) / den;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;
  // 源坐标乘以图像尺寸后再经 M，复合进 setTransform
  g.save();
  g.setTransform(a * w, b * w, c * h, d * h, e, f);
  g.beginPath();
  g.moveTo(s0.x, s0.y);
  g.lineTo(s1.x, s1.y);
  g.lineTo(s2.x, s2.y);
  g.closePath();
  g.clip();
  g.drawImage(img, 0, 0);
  g.restore();
}

function drawHatch(g: CanvasRenderingContext2D, poly: Pt[]) {
  if (poly.length < 3) return;
  g.save();
  g.beginPath();
  g.moveTo(poly[0]!.x, poly[0]!.y);
  for (let i = 1; i < poly.length; i++) g.lineTo(poly[i]!.x, poly[i]!.y);
  g.closePath();
  g.clip();
  g.strokeStyle = COLOR_HATCH;
  g.lineWidth = 1;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (let x = minX - (maxY - minY); x < maxX + (maxY - minY); x += 9) {
    g.beginPath();
    g.moveTo(x, minY);
    g.lineTo(x + (maxY - minY), maxY);
    g.stroke();
  }
  g.restore();
}

function drawCells(
  g: CanvasRenderingContext2D,
  placementValue: Placement,
  toPx: (p: Pt) => Pt,
  color: string,
) {
  const { version: v, toPlane } = placementValue;
  const { grid } = v;
  g.save();
  g.font = "12px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.columns; col++) {
      const cell = grid.cells[row * grid.columns + col]!;
      if (cell.glyph === " ") continue;
      const local: Pt = {
        x: (col + 0.5) / grid.columns,
        y: (row + 0.5) / grid.rows,
      };
      const plane = applyMatrix(toPlane, local);
      const px = toPx(plane);
      g.fillStyle = v.settings.color ? cell.color : color;
      g.globalAlpha = color === COLOR_BASE ? 0.9 : 0.75;
      g.fillText(cell.glyph, px.x, px.y);
    }
  }
  g.restore();
}

function drawQuadOutline(
  g: CanvasRenderingContext2D,
  quad: Pt[],
  toPx: (p: Pt) => Pt,
  color: string,
) {
  const px = quad.map(toPx);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.setLineDash([6, 4]);
  g.beginPath();
  g.moveTo(px[0]!.x, px[0]!.y);
  for (let i = 1; i < 4; i++) g.lineTo(px[i]!.x, px[i]!.y);
  g.closePath();
  g.stroke();
  g.restore();
}

function drawAnchors(
  g: CanvasRenderingContext2D,
  anchors: Anchor[],
  anchorToPlane: (a: Pt) => Pt,
  toPx: (p: Pt) => Pt,
) {
  g.save();
  anchors.forEach((a, i) => {
    const px = toPx(anchorToPlane(a));
    g.strokeStyle = COLOR_ANCHOR;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(px.x, px.y, 5, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = COLOR_ANCHOR;
    g.font = "9px monospace";
    g.textAlign = "left";
    g.fillText(String(i + 1), px.x + 7, px.y - 6);
  });
  g.restore();
}

function drawRuler(
  g: CanvasRenderingContext2D,
  width: number,
  height: number,
  scaleLabel: string,
) {
  g.save();
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.fillStyle = COLOR_TEXT_DIM;
  g.font = "9px monospace";
  g.lineWidth = 1;
  const x0 = PAD;
  const y0 = height - PAD + 18;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x0 + PLANE, y0);
  g.stroke();
  for (let i = 0; i <= 10; i++) {
    const x = x0 + (PLANE * i) / 10;
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x, y0 + (i % 5 === 0 ? 8 : 4));
    g.stroke();
    if (i % 5 === 0) g.fillText(`${i * 10}%`, x - 8, y0 + 20);
  }
  const yx = PAD - 20;
  const yy0 = PAD;
  g.beginPath();
  g.moveTo(yx, yy0);
  g.lineTo(yx, yy0 + PLANE);
  g.stroke();
  for (let i = 0; i <= 10; i++) {
    const y = yy0 + (PLANE * i) / 10;
    g.beginPath();
    g.moveTo(yx, y);
    g.lineTo(yx - (i % 5 === 0 ? 8 : 4), y);
    g.stroke();
  }
  g.fillText(scaleLabel, PAD, 24);
  g.restore();
}

export async function renderCompare(
  canvas: HTMLCanvasElement,
  opts: CompareRenderOptions,
): Promise<void> {
  const { base, target, alignment, mode } = opts;
  const width = PLANE + PAD * 2;
  const height = PLANE + PAD * 2;
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#101216";
  g.fillRect(0, 0, width, height);

  const toPx = (p: Pt): Pt => ({
    x: PAD + p.x * PLANE,
    y: PAD + p.y * PLANE,
  });

  const basePlace = placement(base, mode, undefined, false);
  const targetPlace = placement(target, mode, alignment, true);

  // 缩略图底图（屏幕模式直接贴展示缩略；来源模式按自然坐标贴图）
  if (opts.includeThumb) {
    const thumbs = await Promise.all(
      [base, target].map((v) => loadImage(v.thumb).catch(() => null)),
    );
    const [baseImg, targetImg] = thumbs;
    if (baseImg) {
      if (mode === "screen") {
        g.save();
        g.globalAlpha = 0.18;
        g.drawImage(baseImg, PAD, PAD, PLANE, PLANE);
        g.restore();
      } else {
        drawThumbSource(g, baseImg, base, toPx);
      }
    }
    if (targetImg && alignment) {
      if (mode === "screen") {
        const inv = invertMatrix(alignment.matrix);
        if (inv) {
          g.save();
          g.globalAlpha = 0.12;
          const quad = targetPlace.quad.map(toPx);
          g.beginPath();
          g.moveTo(quad[0]!.x, quad[0]!.y);
          for (let i = 1; i < 4; i++) g.lineTo(quad[i]!.x, quad[i]!.y);
          g.closePath();
          g.clip();
          const xs = quad.map((p) => p.x);
          const ys = quad.map((p) => p.y);
          g.drawImage(
            targetImg,
            Math.min(...xs),
            Math.min(...ys),
            Math.max(...xs) - Math.min(...xs),
            Math.max(...ys) - Math.min(...ys),
          );
          g.restore();
        }
      } else {
        drawThumbSource(g, targetImg, target, (p) =>
          toPx(applyMatrix(alignment.matrix, p)),
        );
      }
    }
  }

  // 不重叠区：各自四边形减去对方在平面内的覆盖区（可能裂成多块）
  if (opts.showNonOverlap && alignment) {
    const baseOnlyPieces = polygonDifference(basePlace.quad, targetPlace.quad);
    const targetOnlyPieces = polygonDifference(targetPlace.quad, basePlace.quad);
    g.save();
    const fillPieces = (pieces: Pt[][], color: string) => {
      g.fillStyle = color;
      for (const piece of pieces) {
        if (piece.length < 3) continue;
        const p0 = toPx(piece[0]!);
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        piece.slice(1).forEach((p) => {
          const q = toPx(p);
          g.lineTo(q.x, q.y);
        });
        g.closePath();
        g.fill();
        drawHatch(g, piece.map(toPx));
      }
    };
    fillPieces(baseOnlyPieces, COLOR_NONOVERLAP_BASE);
    fillPieces(targetOnlyPieces, COLOR_NONOVERLAP_TARGET);
    g.restore();
  }

  drawCells(g, basePlace, toPx, COLOR_BASE);
  if (alignment) drawCells(g, targetPlace, toPx, COLOR_TARGET);

  drawQuadOutline(g, basePlace.quad, toPx, COLOR_BASE);
  if (alignment) drawQuadOutline(g, targetPlace.quad, toPx, COLOR_TARGET);

  // 锚点：屏幕模式先把自然坐标转到展示方向；目标版再叠加配准变换
  const baseAnchorToPlane = (a: Pt): Pt =>
    mode === "screen" ? naturalToDisplayed(base.rotation, a) : a;
  drawAnchors(g, base.anchors, baseAnchorToPlane, toPx);
  if (alignment) {
    const targetAnchorToPlane = (a: Pt): Pt => {
      const own =
        mode === "screen" ? naturalToDisplayed(target.rotation, a) : a;
      return applyMatrix(alignment.matrix, own);
    };
    drawAnchors(g, target.anchors, targetAnchorToPlane, toPx);
  }

  if (opts.showRuler) {
    drawRuler(
      g,
      width,
      height,
      mode === "screen"
        ? `REG RULER · 屏幕效果平面（基准版展示坐标）`
        : `REG RULER · 来源位置平面（${base.sourceName} 自然坐标 ${base.sourceWidth}×${base.sourceHeight}）`,
    );
  }

  // 角注信息
  g.save();
  g.fillStyle = COLOR_TEXT_DIM;
  g.font = "10px monospace";
  g.textAlign = "right";
  const lines = [
    `BASE ${base.name} · ${base.grid.columns}×${base.grid.rows}`,
    `TARGET ${target.name} · ${target.grid.columns}×${target.grid.rows}`,
    alignment
      ? `RMSE ${(alignment.rmse * 100).toFixed(2)}% · ${alignment.pointCount} 锚点对`
      : "无有效配准：仅显示基准版",
  ];
  lines.forEach((t, i) => g.fillText(t, width - PAD, PAD + 14 + i * 15));
  if (opts.failureNote) {
    g.fillStyle = "#e8a06a";
    wrapText(g, opts.failureNote, width - PAD, height - PAD - 8, PLANE, 13);
  }
  g.restore();
}

function wrapText(
  g: CanvasRenderingContext2D,
  text: string,
  right: number,
  bottom: number,
  maxWidth: number,
  lineHeight: number,
) {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  for (const ch of chars) {
    if (g.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  g.textAlign = "right";
  lines.forEach((l, i) => {
    g.fillText(l, right, bottom - (lines.length - 1 - i) * lineHeight);
  });
}
