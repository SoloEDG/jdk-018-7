export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 顺时针旋转角度，作用于原图之后、裁剪之前 */
export type Rotation = 0 | 90 | 180 | 270;

export interface Asset {
  name: string;
  url: string;
  width: number;
  height: number;
  image: HTMLImageElement;
}
export interface Settings {
  columns: number;
  charset: string;
  custom: string;
  contrast: number;
  gamma: number;
  invert: boolean;
  color: boolean;
  background: string;
}
export interface Cell {
  glyph: string;
  color: string;
}
export interface Grid {
  columns: number;
  rows: number;
  cells: Cell[];
  revision: number;
}
export interface StudioDocument {
  asset: Asset | null;
  rotation: Rotation;
  crop: Crop;
  settings: Settings;
  grid: Grid | null;
  revision: number;
}
