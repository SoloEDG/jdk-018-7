import { reactive, ref, provide, watch } from "vue";
import { createDocument } from "../shared/defaults";
import { studioKey } from "../shared/context";
import { generate } from "../features/mapping";
import { useVersions, provideVersions } from "../features/versions";

export function useWorkspace() {
  const doc = reactive(createDocument());
  const busy = ref(false),
    notice = ref("所有处理均在你的浏览器中完成");
  let timer: ReturnType<typeof setTimeout>;
  function invalidate() {
    doc.revision++;
    busy.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        doc.grid = generate(doc);
      } catch (e) {
        notice.value = e instanceof Error ? e.message : "生成失败";
      } finally {
        busy.value = false;
      }
    }, 60);
  }
  watch(() => doc.settings.background, invalidate);
  provide(studioKey, { doc, busy, notice, invalidate });

  // 版本中心：冻结快照与配准缓存按版本 ID 独立管理，与当前作品解耦
  const versions = useVersions(doc, notice);
  provideVersions(versions);

  return { doc, busy, notice, invalidate, versions };
}
