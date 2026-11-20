<script setup lang="ts">
import { computed, ref } from "vue";
import {
  Snowflake,
  History,
  Trash2,
  Pencil,
  Download,
  Check,
  Link2,
} from "lucide-vue-next";
import { useVersionsContext } from "../store/versionsContext";
import { exportSingleVersion } from "../lib/exporters";

const store = useVersionsContext();
const name = ref("");
const exportingId = ref<string | null>(null);

const list = computed(() => store.versions.value);
const gridReady = computed(
  () => store.doc.grid && store.doc.grid.revision === store.doc.revision,
);

async function freeze() {
  const v = store.freeze(name.value || "");
  if (v) {
    name.value = "";
    store.baseId.value = v.id;
  }
}

async function restore(id: string) {
  await store.restore(id);
}

async function saveSingle(id: string) {
  const v = store.getVersion(id);
  if (!v) return;
  exportingId.value = id;
  try {
    const p = store.getSinglePrefs(id);
    await exportSingleVersion(v, p.format, p.withRuler);
    store.notice.value = `版本「${v.name}」独立结果已导出`;
  } finally {
    exportingId.value = null;
  }
}

function fmtTime(t: number) {
  return new Date(t).toLocaleString("zh-CN", { hour12: false });
}
</script>

<template>
  <section class="panel version-panel">
    <div class="section-title">
      <span>04 / FROZEN VERSIONS</span><Snowflake :size="15" />
    </div>
    <div class="freeze-row">
      <input
        v-model="name"
        class="version-name-input"
        maxlength="40"
        placeholder="版本名称（可留空自动命名）"
        aria-label="版本名称"
        @keyup.enter="freeze"
      />
      <button class="primary freeze-btn" :disabled="!gridReady" @click="freeze">
        <Snowflake :size="14" /> 冻结当前作品
      </button>
    </div>
    <p v-if="!gridReady" class="panel-warn">
      当前字符结果仍在生成，待同步后才能冻结
    </p>

    <div v-if="list.length === 0" class="empty-versions">
      <History :size="22" />
      <p>还没有冻结版本。冻结后布局独立保存，不再随参数变化重排。</p>
    </div>

    <ul v-else class="version-list">
      <li v-for="v in list" :key="v.id" class="version-card">
        <img :src="v.thumb" :alt="v.name" class="version-thumb" />
        <div class="version-meta">
          <div class="version-title-row">
            <input
              class="version-title-input"
              :value="v.name"
              maxlength="40"
              @change="store.rename(v.id, ($event.target as HTMLInputElement).value)"
            />
          </div>
          <small class="mono muted">
            {{ v.sourceName }} · {{ v.rotation }}° ·
            {{ v.grid.columns }}×{{ v.grid.rows }}
          </small>
          <small class="mono muted">{{ fmtTime(v.createdAt) }}</small>
          <div class="version-card-actions">
            <button class="mini" @click="restore(v.id)">
              <History :size="12" /> 恢复为当前
            </button>
            <button
              class="mini"
              :class="{ active: store.baseId.value === v.id }"
              @click="store.baseId.value = v.id"
            >
              <Check :size="12" /> 基准
            </button>
            <button
              class="mini"
              :class="{ active: store.targetId.value === v.id }"
              :disabled="store.baseId.value === v.id"
              @click="store.targetId.value = v.id"
            >
              <Link2 :size="12" /> 对照
            </button>
            <button class="mini danger" @click="store.remove(v.id)">
              <Trash2 :size="12" />
            </button>
          </div>
          <div class="single-export">
            <label class="mini-select">
              格式
              <select
                :value="store.getSinglePrefs(v.id).format"
                @change="
                  store.getSinglePrefs(v.id).format =
                    ($event.target as HTMLSelectElement).value as 'png' | 'txt'
                "
              >
                <option value="png">PNG</option>
                <option value="txt">TXT</option>
              </select>
            </label>
            <label
              v-if="store.getSinglePrefs(v.id).format === 'png'"
              class="mini-check"
            >
              <input
                type="checkbox"
                class="plain-check"
                v-model="store.getSinglePrefs(v.id).withRuler"
              />
              标尺
            </label>
            <button
              class="mini"
              :disabled="exportingId === v.id"
              @click="saveSingle(v.id)"
            >
              <Download :size="12" />
              {{ exportingId === v.id ? "导出中…" : "导出该版" }}
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
