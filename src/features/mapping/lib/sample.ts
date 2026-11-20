import type { Asset, Crop, Rotation } from "../../../shared/document";
import { rotatedCanvas } from "../../crop/lib/rotate";

export function sample(
  asset: Asset,
  rotation: Rotation,
  crop: Crop,
  columns: number,
  rows: number,
  background: string,
): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = columns;
  c.height = rows;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.fillStyle = background;
  g.fillRect(0, 0, columns, rows);
  const src = rotatedCanvas(asset, rotation);
  g.drawImage(
    src.canvas,
    crop.x * src.width,
    crop.y * src.height,
    crop.width * src.width,
    crop.height * src.height,
    0,
    0,
    columns,
    rows,
  );
  return g.getImageData(0, 0, columns, rows).data;
}
