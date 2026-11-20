import type { FrozenVersion } from "../types";
import { drawGrid } from "../../preview/lib/draw";

const CELL_W = 8;
const CELL_H = 16;
const PAD = 44;

/** 渲染单个冻结版本的独立结果，可选配准标尺与标题角注 */
export function renderSingleVersion(
  canvas: HTMLCanvasElement,
  v: FrozenVersion,
  withRuler: boolean,
): void {
  const gridW = v.grid.columns * CELL_W;
  const gridH = v.grid.rows * CELL_H;
  canvas.width = gridW + PAD * 2;
  canvas.height = gridH + PAD * 2 + (withRuler ? 26 : 0);
  const g = canvas.getContext("2d")!;
  g.fillStyle = v.settings.background;
  g.fillRect(0, 0, canvas.width, canvas.height);

  const gridCanvas = document.createElement("canvas");
  drawGrid(gridCanvas, v.grid, v.settings.color, v.settings.background);
  g.drawImage(gridCanvas, PAD, PAD);

  if (withRuler) {
    g.save();
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.fillStyle = "rgba(255,255,255,0.65)";
    g.font = "10px monospace";
    g.lineWidth = 1;
    const y = PAD + gridH + 14;
    g.beginPath();
    g.moveTo(PAD, y);
    g.lineTo(PAD + gridW, y);
    g.stroke();
    const ticks = 10;
    for (let i = 0; i <= ticks; i++) {
      const x = PAD + (gridW * i) / ticks;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + (i % 5 === 0 ? 7 : 4));
      g.stroke();
      if (i % 5 === 0) g.fillText(`${i * 10}%`, x - 8, y + 19);
    }
    // 纵向标尺
    const x0 = PAD - 14;
    g.beginPath();
    g.moveTo(x0, PAD);
    g.lineTo(x0, PAD + gridH);
    g.stroke();
    for (let i = 0; i <= ticks; i++) {
      const yy = PAD + (gridH * i) / ticks;
      g.beginPath();
      g.moveTo(x0, yy);
      g.lineTo(x0 - (i % 5 === 0 ? 7 : 4), yy);
      g.stroke();
    }
    g.restore();
  }

  g.save();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = "11px monospace";
  g.textAlign = "left";
  g.fillText(
    `${v.name} · ${v.sourceName} · 旋转${v.rotation}° · ${v.grid.columns}×${v.grid.rows}`,
    PAD,
    20,
  );
  g.restore();
}

export function singleText(v: FrozenVersion): string {
  return v.grid.cells.reduce((acc, cell, i) => {
    acc += cell.glyph;
    if ((i + 1) % v.grid.columns === 0 && i !== v.grid.cells.length - 1) {
      acc += "\n";
    }
    return acc;
  }, "");
}
