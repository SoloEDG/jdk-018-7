import { reactive, ref } from "vue";
import type { StudioDocument } from "../../../shared/document";
import { decodeImage } from "../../source/lib/decode";
import {
  DEFAULT_RMSE_LIMIT,
  anchorSignature,
  tryAlign,
  type PointPair,
} from "../lib/affine";
import { freezeVersion, clone } from "../lib/snapshot";
import type {
  Alignment,
  AlignmentFailure,
  Anchor,
  CompareMode,
  FrozenVersion,
} from "../types";

export interface PairPrefs {
  mode: CompareMode;
  showNonOverlap: boolean;
  showRuler: boolean;
  includeThumb: boolean;
  rmseLimit: number;
}

export interface SinglePrefs {
  format: "png" | "txt";
  withRuler: boolean;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

const defaultPairPrefs = (): PairPrefs => ({
  mode: "screen",
  showNonOverlap: true,
  showRuler: true,
  includeThumb: true,
  rmseLimit: DEFAULT_RMSE_LIMIT,
});

const defaultSinglePrefs = (): SinglePrefs => ({ format: "png", withRuler: false });

/**
 * 版本中心：冻结版本、锚点配准、对齐缓存与导出选择全部按版本 ID 隔离。
 * 任何对齐失败都只更新提示，不会覆盖已缓存的上次有效变换。
 */
export function useVersions(doc: StudioDocument, notice: { value: string }) {
  const versions = ref<FrozenVersion[]>([]);
  const baseId = ref<string | null>(null);
  const targetId = ref<string | null>(null);
  /** key 为排序后的版本 ID 对，值为该方向的有效对齐，按 from→to 存两份 */
  const alignments = reactive(new Map<string, Alignment[]>());
  const failures = reactive(new Map<string, AlignmentFailure>());
  const pairPrefs = reactive(new Map<string, PairPrefs>());
  const singlePrefs = reactive(new Map<string, SinglePrefs>());
  /** 版本内嵌的来源 dataURL 缓存（按版本 ID），释放原 Asset 后仍可恢复 */
  const sourceDataUrls = reactive(new Map<string, string>());
  const busy = ref(false);

  function getVersion(id: string | null): FrozenVersion | undefined {
    return versions.value.find((v) => v.id === id) ?? undefined;
  }

  function getPairPrefs(a: string, b: string): PairPrefs {
    const key = pairKey(a, b);
    let p = pairPrefs.get(key);
    if (!p) {
      p = defaultPairPrefs();
      pairPrefs.set(key, p);
    }
    return p;
  }

  function getSinglePrefs(id: string): SinglePrefs {
    let p = singlePrefs.get(id);
    if (!p) {
      p = defaultSinglePrefs();
      singlePrefs.set(id, p);
    }
    return p;
  }

  function freeze(name: string) {
    try {
      const v = freezeVersion({ name, doc });
      versions.value = [...versions.value, v];
      sourceDataUrls.set(v.id, doc.asset!.url);
      if (!baseId.value) baseId.value = v.id;
      notice.value = `已冻结版本「${v.name}」，布局独立保存，不再随当前作品变化`;
      return v;
    } catch (e) {
      notice.value = e instanceof Error ? e.message : "冻结失败";
      return null;
    }
  }

  function rename(id: string, name: string) {
    const v = getVersion(id);
    if (v && name.trim()) v.name = name.trim();
  }

  function remove(id: string) {
    // 身份隔离清理：只删除该版本及其专有缓存，其余版本的对齐依据原样保留
    versions.value = versions.value.filter((v) => v.id !== id);
    sourceDataUrls.delete(id);
    singlePrefs.delete(id);
    for (const key of [...alignments.keys()]) {
      if (key.split("::").includes(id)) alignments.delete(key);
    }
    for (const key of [...failures.keys()]) {
      if (key.split("::").includes(id)) failures.delete(key);
    }
    for (const key of [...pairPrefs.keys()]) {
      if (key.split("::").includes(id)) pairPrefs.delete(key);
    }
    if (baseId.value === id) baseId.value = versions.value[0]?.id ?? null;
    if (targetId.value === id) targetId.value = null;
  }

  /** 把冻结版本恢复为当前作品；任一步失败都不改动当前文档 */
  async function restore(id: string): Promise<boolean> {
    const v = getVersion(id);
    if (!v) {
      notice.value = "恢复失败：该版本已不存在";
      return false;
    }
    const url = sourceDataUrls.get(id);
    if (!url) {
      notice.value = "恢复失败：版本内嵌的来源资源已不可用，当前作品保持不变";
      return false;
    }
    busy.value = true;
    try {
      const asset = await decodeImage(url, v.sourceName);
      // 成功后一次性原子替换，避免半成品状态
      const restoredGrid = clone(v.grid);
      doc.asset = asset;
      doc.rotation = v.rotation;
      doc.crop = clone(v.crop);
      doc.settings = clone(v.settings);
      doc.grid = restoredGrid;
      doc.revision = restoredGrid.revision;
      notice.value = `已恢复版本「${v.name}」为当前作品，可继续编辑或重新冻结`;
      return true;
    } catch (e) {
      notice.value = e instanceof Error
        ? `恢复失败：${e.message}，当前作品保持不变`
        : "恢复失败：来源图片无法解码，当前作品保持不变";
      return false;
    } finally {
      busy.value = false;
    }
  }

  /** 锚点编辑（增/删/拖拽），坐标为自然方向归一化坐标 */
  function addAnchor(id: string, point: Anchor) {
    const v = getVersion(id);
    if (!v) return;
    v.anchors = [
      ...v.anchors,
      {
        x: Math.max(0, Math.min(1, point.x)),
        y: Math.max(0, Math.min(1, point.y)),
      },
    ];
  }

  function updateAnchor(id: string, index: number, point: Anchor) {
    const v = getVersion(id);
    const a = v?.anchors[index];
    if (!a) return;
    a.x = Math.max(0, Math.min(1, point.x));
    a.y = Math.max(0, Math.min(1, point.y));
  }

  function removeAnchor(id: string, index: number) {
    const v = getVersion(id);
    if (!v) return;
    v.anchors = v.anchors.filter((_: Anchor, i: number) => i !== index);
  }

  function clearAnchors(id: string) {
    const v = getVersion(id);
    if (v) v.anchors = [];
  }

  function buildPairs(a: FrozenVersion, b: FrozenVersion): PointPair[] {
    const n = Math.min(a.anchors.length, b.anchors.length);
    const pairs: PointPair[] = [];
    for (let i = 0; i < n; i++) {
      const pa = a.anchors[i]!;
      const pb = b.anchors[i]!;
      if ([pa.x, pa.y, pb.x, pb.y].every(Number.isFinite)) {
        pairs.push({ from: { ...pa }, to: { ...pb } });
      }
    }
    return pairs;
  }

  /**
   * 重新计算两版配准。失败时返回 false 且保留缓存中的上次有效对齐，
   * 仅刷新该版本对的问题提示。
   */
  function recompute(aId: string, bId: string): boolean {
    const a = getVersion(aId);
    const b = getVersion(bId);
    if (!a || !b) return false;
    const key = pairKey(aId, bId);
    const prefs = getPairPrefs(aId, bId);
    const pairs = buildPairs(a, b);
    const result = tryAlign(aId, bId, pairs, prefs.rmseLimit);
    if (result.failure) {
      failures.set(key, result.failure);
      return false;
    }
    const forward = result.alignment!;
    const reverse = tryAlign(bId, aId, pairs.map((p) => ({ from: p.to, to: p.from })), prefs.rmseLimit);
    const list: Alignment[] = [forward];
    if (reverse.alignment) list.push(reverse.alignment);
    alignments.set(key, list);
    failures.delete(key);
    return true;
  }

  function getAlignment(fromId: string, toId: string): Alignment | undefined {
    const key = pairKey(fromId, toId);
    return alignments.get(key)?.find((al) => al.fromId === fromId && al.toId === toId);
  }

  function getFailure(aId: string, bId: string): AlignmentFailure | undefined {
    return failures.get(pairKey(aId, bId));
  }

  function hasStaleAlignment(aId: string, bId: string): boolean {
    const a = getVersion(aId);
    const b = getVersion(bId);
    if (!a || !b) return false;
    const al = getAlignment(aId, bId);
    if (!al) return false;
    return al.anchorSignature !== anchorSignature(buildPairs(a, b));
  }

  /** 删除当前作品的原图资源（冻结版本内嵌快照，不受影响） */
  function detachSource() {
    if (!doc.asset) return;
    doc.asset = null;
    doc.grid = null;
    doc.revision += 1;
    notice.value = "当前原图资源已释放；冻结版本保存的是独立快照，仍可查看、对照与恢复";
  }

  return {
    doc,
    notice,
    versions,
    baseId,
    targetId,
    busy,
    alignments,
    pairPrefs,
    singlePrefs,
    sourceDataUrls,
    getVersion,
    getPairPrefs,
    getSinglePrefs,
    freeze,
    rename,
    remove,
    restore,
    addAnchor,
    updateAnchor,
    removeAnchor,
    clearAnchors,
    recompute,
    getAlignment,
    getFailure,
    hasStaleAlignment,
    detachSource,
  };
}

export type VersionsStore = ReturnType<typeof useVersions>;
