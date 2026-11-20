<script setup lang="ts">
import { computed, ref, watch, onMounted, nextTick } from "vue";
import {
  Monitor,
  MapPinned,
  Layers,
  Ruler,
  Image as ImageIcon,
  Download,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-vue-next";
import { useVersionsContext } from "../store/versionsContext";
import { renderCompare } from "../lib/compareRender";
import { exportComparePage } from "../lib/exporters";
import { DEFAULT_RMSE_LIMIT } from "../lib/affine";

const store = useVersionsContext();
const canvas = ref<HTMLCanvasElement>();
const exporting = ref(false);
const renderTick = ref(0);

const base = computed(() => store.getVersion(store.baseId.value));
const target = computed(() => store.getVersion(store.targetId.value));
const prefs = computed(() =>
  base.value && target.value
    ? store.getPairPrefs(base.value.id, target.value.id)
    : null,
);
const alignment = computed(() =>
  base.value && target.value
    ? store.getAlignment(base.value.id, target.value.id)
    : undefined,
);
const failure = computed(() =>
  base.value && target.value
    ? store.getFailure(base.value.id, target.value.id)
    : undefined,
);
const stale = computed(() =>
  base.value && target.value
    ? store.hasStaleAlignment(base.value.id, target.value.id)
    : false,
);

function recompute() {
  if (!base.value || !target.value) return;
  const ok = store.recompute(base.value.id, target.value.id);
  renderTick.value++;
  if (!ok) {
    const f = store.getFailure(base.value.id, target.value.id);
    if (f) store.notice.value = f.message;
  } else {
    store.notice.value = "配准已更新，变换仅作用于对照视图，版本字符布局未改动";
  }
}

// 锚点变化后自动尝试重新配准；失败时保留旧对齐，画布继续按旧对齐绘制
watch(
  () =>
    [base.value?.anchors, target.value?.anchors, store.baseId.value, store.targetId.value]
      .map((x) => JSON.stringify(x))
      .join("#"),
  () => {
    if (base.value && target.value) {
      store.recompute(base.value.id, target.value.id);
      renderTick.value++;
    }
  },
  { immediate: true },
);

watch(
  () => [
    prefs.value?.mode,
    prefs.value?.showNonOverlap,
    prefs.value?.showRuler,
    prefs.value?.includeThumb,
    renderTick.value,
  ],
  () => void paint(),
);

onMounted(() => void paint());

async function paint() {
  await nextTick();
  if (!canvas.value || !base.value || !target.value || !prefs.value) return;
  await renderCompare(canvas.value, {
    base: base.value,
    target: target.value,
    alignment: alignment.value,
    mode: prefs.value.mode,
    showNonOverlap: prefs.value.showNonOverlap,
    showRuler: prefs.value.showRuler,
    includeThumb: prefs.value.includeThumb,
    failureNote: failure.value?.message,
  });
}

async function saveCompare() {
  if (!base.value || !target.value || !prefs.value) return;
  exporting.value = true;
  try {
    await exportComparePage({
      base: base.value,
      target: target.value,
      alignment: alignment.value,
      mode: prefs.value.mode,
      showNonOverlap: prefs.value.showNonOverlap,
      showRuler: prefs.value.showRuler,
      includeThumb: prefs.value.includeThumb,
      failureNote: failure.value?.message,
    });
    store.notice.value = "带配准标尺的对照页已导出";
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <section v-if="base && target && prefs" class="compare-view">
    <div class="compare-toolbar">
      <div class="tabs">
        <button
          :class="{ active: prefs.mode === 'screen' }"
          @click="prefs.mode = 'screen'"
        >
          <Monitor :size="14" /> 屏幕效果比较
        </button>
        <button
          :class="{ active: prefs.mode === 'source' }"
          @click="prefs.mode = 'source'"
        >
          <MapPinned :size="14" /> 来源位置比较
        </button>
      </div>
      <button class="secondary recompute" @click="recompute">
        <RefreshCw :size="13" /> 重新配准
      </button>
    </div>

    <div class="compare-toggles">
      <label>
        <input type="checkbox" class="plain-check" v-model="prefs.showNonOverlap" />
        <Layers :size="13" /> 显示不重叠区
      </label>
      <label>
        <input type="checkbox" class="plain-check" v-model="prefs.showRuler" />
        <Ruler :size="13" /> 配准标尺
      </label>
      <label>
        <input type="checkbox" class="plain-check" v-model="prefs.includeThumb" />
        <ImageIcon :size="13" /> 来源缩略底图
      </label>
      <label class="rmse-limit">
        误差上限
        <input
          type="range"
          min="0.01"
          max="0.1"
          step="0.005"
          :value="prefs.rmseLimit"
          @input="
            prefs.rmseLimit = Number(($event.target as HTMLInputElement).value)
          "
        />
        <b>{{ Math.round(prefs.rmseLimit * 100) }}%</b>
        <button class="mini" @click="prefs.rmseLimit = DEFAULT_RMSE_LIMIT">
          默认
        </button>
      </label>
    </div>

    <div class="compare-status">
      <div v-if="alignment" class="status-ok">
        <ShieldCheck :size="14" />
        有效配准：{{ alignment.pointCount }} 对锚点 · RMSE
        {{ (alignment.rmse * 100).toFixed(2) }}%
        <span v-if="failure" class="stale-tag warn-tag">{{ failure.message }}</span>
        <span v-else-if="stale" class="stale-tag">锚点已改动，点击「重新配准」应用</span>
      </div>
      <div v-else class="status-warn">
        <TriangleAlert :size="14" />
        {{ failure?.message ?? "尚无有效配准，画布仅显示基准版" }}
      </div>
    </div>

    <div class="compare-canvas-wrap">
      <canvas ref="canvas" class="compare-canvas" aria-label="版本对照画布" />
    </div>

    <div class="compare-legend">
      <span><i class="dot base-dot" /> 基准版 {{ base.name }}</span>
      <span><i class="dot target-dot" /> 对照版 {{ target.name }}</span>
      <span><i class="swatch base-swatch" /> 基准独有区</span>
      <span><i class="swatch target-swatch" /> 对照独有区</span>
      <small class="muted">
        变换只用于叠加比较，两版冻结的字符布局均未被重排
      </small>
    </div>

    <div class="compare-actions">
      <button class="primary" :disabled="exporting" @click="saveCompare">
        <Download :size="15" />
        {{ exporting ? "导出中…" : "导出带标尺对照页 PNG" }}
      </button>
    </div>
  </section>
  <section v-else class="compare-view compare-empty">
    <MapPinned :size="26" />
    <p>冻结两个版本，并分别指定「基准」与「对照」后，在这里做锚点配准比较。</p>
  </section>
</template>
