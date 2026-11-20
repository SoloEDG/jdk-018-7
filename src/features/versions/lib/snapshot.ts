import type {
  Crop,
  Grid,
  Rotation,
  Settings,
  StudioDocument,
} from "../../../shared/document";
import { rotatedCanvas } from "../../crop/lib/rotate";
import type { FrozenVersion } from "../types";

let counter = 0;

export function makeVersionId(): string {
  counter += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `v_${Date.now().toString(36)}_${counter}_${rand}`;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const THUMB_MAX = 320;

/** 生成与展示方向一致的缩略图 dataURL（旋转作用于原图之后） */
export function makeThumb(
  doc: StudioDocument,
  rotation: Rotation,
): { url: string; width: number; height: number } {
  const { canvas, width, height } = rotatedCanvas(doc.asset!, rotation);
  const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(width * scale));
  out.height = Math.max(1, Math.round(height * scale));
  const g = out.getContext("2d")!;
  g.drawImage(canvas, 0, 0, out.width, out.height);
  return { url: out.toDataURL("image/png"), width: out.width, height: out.height };
}

export interface FreezeInput {
  name: string;
  doc: StudioDocument;
}

/**
 * 把当前作品冻结为独立版本：
 * 全部数据深拷贝，缩略图内嵌 dataURL，不持有 Asset/响应式引用，
 * 之后原图被删除、当前参数继续改变都不会影响该版本，也不会触发重算。
 */
export function freezeVersion({ name, doc }: FreezeInput): FrozenVersion {
  if (!doc.asset || !doc.grid) {
    throw new Error("当前作品尚未生成字符结果，无法冻结版本");
  }
  const rotation: Rotation = doc.rotation;
  const thumb = makeThumb(doc, rotation);
  const grid: Grid = clone(doc.grid);
  const crop: Crop = clone(doc.crop);
  const settings: Settings = clone(doc.settings);
  return {
    id: makeVersionId(),
    name: name.trim() || `版本 ${new Date().toLocaleString("zh-CN")}`,
    createdAt: Date.now(),
    sourceName: doc.asset.name,
    sourceWidth: doc.asset.width,
    sourceHeight: doc.asset.height,
    rotation,
    crop,
    settings,
    grid,
    thumb: thumb.url,
    thumbWidth: thumb.width,
    thumbHeight: thumb.height,
    anchors: [],
  };
}
