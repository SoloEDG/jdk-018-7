import type { Asset, Rotation } from "../../../shared/document";

export interface RotatedCanvas {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** 按顺时针角度把原图绘制到新画布，返回展示方向的位图 */
export function rotatedCanvas(asset: Asset, rotation: Rotation): RotatedCanvas {
  const swap = rotation === 90 || rotation === 270;
  const width = swap ? asset.height : asset.width;
  const height = swap ? asset.width : asset.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d")!;
  if (rotation === 0) {
    g.drawImage(asset.image, 0, 0);
  } else {
    g.translate(width / 2, height / 2);
    g.rotate((rotation * Math.PI) / 180);
    g.drawImage(asset.image, -asset.width / 2, -asset.height / 2);
  }
  return { canvas, width, height };
}
