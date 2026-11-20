export { default as VersionPanel } from "./ui/VersionPanel.vue";
export { default as AnchorPanel } from "./ui/AnchorPanel.vue";
export { default as ComparePanel } from "./ui/ComparePanel.vue";
export { useVersions } from "./store/useVersions";
export { provideVersions } from "./store/versionsContext";
export type { VersionsStore } from "./store/useVersions";
export type {
  FrozenVersion,
  Alignment,
  Anchor,
  CompareMode,
  AlignmentIssue,
} from "./types";
