<script setup lang="ts">
import { computed } from "vue";
import { Crop, RotateCcw, RotateCw } from "lucide-vue-next";
import { useCrop } from "../model/useCrop";
import type { Rotation } from "../../../shared/document";
import CropImage from "./CropImage.vue";
const c = useCrop();
const selection = computed(() => (c.start.value ? c.draft.value : c.doc.crop));
const steps: Rotation[] = [0, 90, 180, 270];
function turn() {
  const idx = steps.indexOf(c.doc.rotation);
  c.rotate(steps[(idx + 1) % steps.length]!);
}
</script>
<template>
  <section class="panel">
    <div class="section-title"><span>02 / CROP</span><Crop :size="15" /></div>
    <div
      v-if="c.doc.asset"
      class="crop-interaction"
      @pointerdown="c.down"
      @pointermove="c.move"
      @pointerup="c.up"
      @pointercancel="c.start.value = null"
    >
      <CropImage
        :asset="c.doc.asset"
        :rotation="c.doc.rotation"
        :crop="selection"
      />
    </div>
    <div class="row hint">
      <span>拖动框选转换区域</span
      ><span class="row-actions">
        <button class="icon-button" aria-label="旋转 90 度" @click="turn">
          <RotateCw :size="13" />
        </button>
        <button class="icon-button" aria-label="重置裁剪" @click="c.reset">
          <RotateCcw :size="13" />
        </button>
      </span>
    </div>
    <small class="mono muted"
      >旋转 {{ c.doc.rotation }}° · {{ Math.round(selection.width * 100) }}% W
      × {{ Math.round(selection.height * 100) }}% H</small
    >
  </section>
</template>
