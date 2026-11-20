<script setup lang="ts">
import { Eraser, Trash2 } from "lucide-vue-next";
import type { FrozenVersion } from "../types";
import { naturalToDisplayed, type Pt } from "../lib/geometry";

const props = defineProps<{
  version: FrozenVersion;
  roleLabel: string;
}>();
const emit = defineEmits<{
  add: [event: PointerEvent];
  start: [payload: { index: number; event: PointerEvent }];
  move: [event: PointerEvent];
  end: [];
  remove: [index: number];
  clear: [];
}>();

function dotStyle(index: number): { left: string; top: string } {
  const a = props.version.anchors[index];
  if (!a) return { left: "0%", top: "0%" };
  const d: Pt = naturalToDisplayed(props.version.rotation, a);
  return { left: d.x * 100 + "%", top: d.y * 100 + "%" };
}
</script>

<template>
  <div class="anchor-board">
    <div class="anchor-board-head">
      <strong>{{ roleLabel }}</strong>
      <button class="mini" title="清空锚点" @click="emit('clear')">
        <Eraser :size="12" /> 清空
      </button>
    </div>
    <div
      class="anchor-canvas"
      @pointerdown="emit('add', $event)"
      @pointermove="emit('move', $event)"
      @pointerup="emit('end')"
      @pointercancel="emit('end')"
    >
      <img :src="version.thumb" :alt="version.name" draggable="false" />
      <div
        v-for="(_, index) in version.anchors"
        :key="index"
        class="anchor-dot"
        :style="dotStyle(index)"
        @pointerdown.stop="emit('start', { index, event: $event })"
        @pointermove="emit('move', $event)"
        @pointerup="emit('end')"
      >
        <span>{{ index + 1 }}</span>
        <button
          class="anchor-del"
          aria-label="删除锚点"
          @click.stop="emit('remove', index)"
        >
          <Trash2 :size="9" />
        </button>
      </div>
    </div>
    <small class="mono muted">
      {{ version.anchors.length }} 锚点 · 旋转 {{ version.rotation }}°
    </small>
  </div>
</template>
