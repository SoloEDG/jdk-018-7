import { download, exportName } from "../../export/lib/download";
import { textContent } from "../../export/lib/text";
import { renderCompare } from "./compareRender";
import { renderSingleVersion, singleText } from "./singleRender";
import type { Alignment, CompareMode, FrozenVersion } from "../types";

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG 编码失败"))), "image/png");
  });
}

export interface CompareExportOptions {
  base: FrozenVersion;
  target: FrozenVersion;
  alignment: Alignment | undefined;
  mode: CompareMode;
  showNonOverlap: boolean;
  showRuler: boolean;
  includeThumb: boolean;
  failureNote?: string;
}

/** 导出带配准标尺的对照页 PNG */
export async function exportComparePage(opts: CompareExportOptions): Promise<void> {
  const canvas = document.createElement("canvas");
  await renderCompare(canvas, opts);
  const blob = await canvasToBlob(canvas);
  const name = `compare_${opts.base.name}_vs_${opts.target.name}_${opts.mode}`;
  download(blob, exportName(name, "png"));
}

/** 导出某冻结版本的独立结果（PNG 可选标尺，或 TXT 文本） */
export async function exportSingleVersion(
  v: FrozenVersion,
  format: "png" | "txt",
  withRuler: boolean,
): Promise<void> {
  if (format === "txt") {
    download(
      new Blob([singleText(v)], { type: "text/plain;charset=utf-8" }),
      exportName(`${v.name}_${v.sourceName}`, "txt"),
    );
    return;
  }
  const canvas = document.createElement("canvas");
  renderSingleVersion(canvas, v, withRuler);
  const blob = await canvasToBlob(canvas);
  download(blob, exportName(`${v.name}_${v.sourceName}`, "png"));
}

export { textContent };
