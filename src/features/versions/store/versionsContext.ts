import { inject, provide, type InjectionKey } from "vue";
import type { VersionsStore } from "./useVersions";

export const versionsKey: InjectionKey<VersionsStore> = Symbol("versions");

export function provideVersions(store: VersionsStore): void {
  provide(versionsKey, store);
}

export function useVersionsContext(): VersionsStore {
  const store = inject(versionsKey);
  if (!store) throw new Error("Missing versions store");
  return store;
}
