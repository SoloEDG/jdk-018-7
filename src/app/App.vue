<script setup lang="ts">
import { Asterisk, LockKeyhole, ArrowUpRight, GitBranch, PenLine } from "lucide-vue-next";
import { ref } from "vue";
import { useWorkspace } from "./useWorkspace";
import { SourcePanel } from "../features/source";
import { CropPanel } from "../features/crop";
import { MappingPanel } from "../features/mapping";
import { PreviewPanel } from "../features/preview";
import { ExportPanel } from "../features/export";
import {
  VersionPanel,
  AnchorPanel,
  ComparePanel,
} from "../features/versions";

const w = useWorkspace();
const tab = ref<"studio" | "versions">("studio");
</script>
<template>
  <div class="app">
    <header>
      <a class="brand" href="./"
        ><span class="brand-mark"><Asterisk :size="27" /></span> GLYPH<span
          class="brand-sub"
          >/ ASCII STUDIO</span
        ></a
      >
      <div class="header-right">
        <span><LockKeyhole :size="12" /> 本地处理 · 无需上传</span
        ><span class="version">V.1.1 <ArrowUpRight :size="12" /></span>
      </div>
    </header>
    <div class="intro">
      <div>
        <div class="eyebrow"><span /> THE ART OF LESS</div>
        <h1>让图像，用字符说话<span>。</span></h1>
        <p>把细腻光影，转译成有温度的 ASCII 艺术，再把每一稿冻结成可配准对照的版本。</p>
      </div>
      <div class="intro-code">
        . : - = + * # % @<small>PIXELS → CHARACTERS → VERSIONS</small>
      </div>
    </div>

    <nav class="mode-tabs" role="tablist">
      <button
        role="tab"
        :class="{ active: tab === 'studio' }"
        @click="tab = 'studio'"
      >
        <PenLine :size="14" /> 创作工作台
      </button>
      <button
        role="tab"
        :class="{ active: tab === 'versions' }"
        @click="tab = 'versions'"
      >
        <GitBranch :size="14" /> 版本配准对照
        <b v-if="w.versions.versions.value.length" class="tab-badge">
          {{ w.versions.versions.value.length }}
        </b>
      </button>
    </nav>

    <div v-show="tab === 'studio'" class="editor">
      <aside><SourcePanel /><CropPanel /><MappingPanel /></aside>
      <div class="result"><PreviewPanel /><ExportPanel /></div>
    </div>

    <div v-show="tab === 'versions'" class="editor versions-editor">
      <aside class="versions-aside">
        <VersionPanel />
        <AnchorPanel />
      </aside>
      <div class="result">
        <main class="workspace compare-workspace"><ComparePanel /></main>
      </div>
    </div>

    <footer>
      <span role="status">{{ w.notice.value }}</span
      ><span>CRAFTED IN CHARACTERS <b>✳</b></span>
    </footer>
  </div>
</template>
