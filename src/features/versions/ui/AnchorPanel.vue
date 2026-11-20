<script setup lang="ts">
import { computed, ref } from "vue";
import { Crosshair, TriangleAlert } from "lucide-vue-next";
import { useVersionsContext } from "../store/versionsContext";
import { displayedToNatural, type Pt } from "../lib/geometry";
import type { FrozenVersion } from "../types";
import AnchorBoard from "./AnchorBoard.vue";

const store = useVersionsContext();
const dragIndex = ref<{ id: string; index: number } | null>(null);

const base = computed(() => store.getVersion(store.baseId.value));
const target = computed(() => store.getVersion(store.targetId.value));

function eventToNatural(v: FrozenVersion, e: PointerEvent): Pt {
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  const displayed = {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  };
  return displayedToNatural(v.rotation, displayed);
}

function addPoint(v: FrozenVersion, e: PointerEvent) {
  if (dragIndex.value) return;
  store.addAnchor(v.id, eventToNatural(v, e));
}

function startDrag(v: FrozenVersion, payload: { index: number; event: PointerEvent }) {
  (payload.event.currentTarget as HTMLElement).setPointerCapture(
    payload.event.pointerId,
  );
  dragIndex.value = { id: v.id, index: payload.index };
}

function drag(v: FrozenVersion, e: PointerEvent) {
  if (!dragIndex.value || dragIndex.value.id !== v.id) return;
  store.updateAnchor(v.id, dragIndex.value.index, eventToNatural(v, e));
}

function endDrag() {
  dragIndex.value = null;
}

const pairCount = computed(() =>
  base.value && target.value
    ? Math.min(base.value.anchors.length, target.value.anchors.length)
    : 0,
);
</script>

<template>
  <section class="panel anchor-panel">
    <div class="section-title">
      <span>05 / ANCHOR REGISTRATION</span><Crosshair :size="15" />
    </div>
    <p v-if="!base" class="panel-warn">请先冻结至少一个版本作为基准</p>
    <p v-else-if="!target" class="panel-warn">
      在版本卡片上点「对照」选择第二个版本，锚点将按顺序一一对应
    </p>

    <div v-else class="anchor-editor">
      <AnchorBoard
        :version="base"
        role-label="基准版"
        @add="addPoint(base, $event)"
        @start="startDrag(base, $event)"
        @move="drag(base, $event)"
        @end="endDrag"
        @remove="store.removeAnchor(base.id, $event)"
        @clear="store.clearAnchors(base.id)"
      />
      <div class="anchor-link">
        <Crosshair :size="16" />
        <span>{{ pairCount }} 对对应锚点</span>
      </div>
      <AnchorBoard
        :version="target"
        role-label="对照版"
        @add="addPoint(target, $event)"
        @start="startDrag(target, $event)"
        @move="drag(target, $event)"
        @end="endDrag"
        @remove="store.removeAnchor(target.id, $event)"
        @clear="store.clearAnchors(target.id)"
      />
      <p class="anchor-hint muted">
        <TriangleAlert :size="12" />
        在两版原图的同一特征处按相同顺序打点；至少 3 对且不能近共线。
        锚点只服务比较，不会移动任何版本里冻结的字符。
      </p>
    </div>
  </section>
</template>
