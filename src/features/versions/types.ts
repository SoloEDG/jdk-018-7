import type { Crop, Grid, Settings } from "../../shared/document";

/** 顺时针旋转角度（采样与坐标换算共用） */
export type Rotation = 0 | 90 | 180 | 270;

/** 锚点：原图（未旋转的自然方向）归一化坐标 */
export interface Anchor {
  x: number;
  y: number;
}

/** 冻结版本——纯快照数据，不持有任何对当前作品的响应式引用 */
export interface FrozenVersion {
  id: string;
  name: string;
  createdAt: number;
  /** 来源资源描述（原图被替换/删除后仅作展示） */
  sourceName: string;
  sourceWidth: number;
  sourceHeight: number;
  rotation: Rotation;
  crop: Crop;
  settings: Settings;
  grid: Grid;
  /** 缩小的来源图 dataURL，用于锚点标注与对照，不依赖原 Asset 对象 */
  thumb: string;
  thumbWidth: number;
  thumbHeight: number;
  /** 该版本自身的锚点（自然方向归一化坐标） */
  anchors: Anchor[];
}

export type AlignmentIssue =
  | "too-few"
  | "near-collinear"
  | "high-error"
  | "singular";

/** 一次有效的配准结果，from → to 的仿射变换（归一化坐标系） */
export interface Alignment {
  fromId: string;
  toId: string;
  /** [a, b, c, d, e, f]：x' = a x + b y + c；y' = d x + e y + f */
  matrix: [number, number, number, number, number, number];
  rmse: number;
  /** 参与求解的锚点对数 */
  pointCount: number;
  anchorSignature: string;
  createdAt: number;
}

export interface AlignmentFailure {
  issue: AlignmentIssue;
  message: string;
  rmse?: number;
}

export type CompareMode = "screen" | "source";
