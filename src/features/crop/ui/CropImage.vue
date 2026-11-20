<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { Asset, Crop, Rotation } from "../../../shared/document";
import { rotatedCanvas } from "../lib/rotate";
const props = defineProps<{
  asset: Asset;
  rotation: Rotation;
  crop: Crop;
}>();
const canvas = ref<HTMLCanvasElement>();
function paint() {
  const el = canvas.value;
  if (!el) return;
  const { canvas: src, width, height } = rotatedCanvas(
    props.asset,
    props.rotation,
  );
  const maxW = 242;
  const scale = Math.min(1, maxW / width);
  el.width = Math.round(width * scale);
  el.height = Math.round(height * scale);
  const g = el.getContext("2d")!;
  g.drawImage(src, 0, 0, el.width, el.height);
}
onMounted(paint);
watch(() => [props.asset, props.rotation], paint);
</script>
<template>
  <div class="crop-image">
    <canvas ref="canvas" aria-label="旋转后的来源图" />
    <div
      class="crop-box"
      :style="{
        left: crop.x * 100 + '%',
        top: crop.y * 100 + '%',
        width: crop.width * 100 + '%',
        height: crop.height * 100 + '%',
      }"
    >
      <i /><i /><i /><i />
    </div>
  </div>
</template>
