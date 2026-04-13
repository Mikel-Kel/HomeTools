import { onMounted, onBeforeUnmount, ref } from "vue";

import {
  getFileModifiedTime,
  listFiles,
} from "@/services/driveAdapter";

interface DriveWatcherOptions {
  folderId: string;
  fileName?: string;
  lastKnownState?: { value: string | null };
  onChanged: () => Promise<void> | void;
  intervalMs?: number;
}

export function useDriveWatcher({
  folderId,
  fileName,
  lastKnownState,
  onChanged,
  intervalMs = 5_000,
}: DriveWatcherOptions) {

  const timer = ref<number | null>(null);

  const paused = ref(false);
  const running = ref(false);

  async function resolveRemoteState(): Promise<string | null> {

    if (fileName) {
      return await getFileModifiedTime(folderId, fileName);
    }

    const files = await listFiles(folderId);

    return files
      .map(f => `${f.name}:${f.modifiedTime ?? ""}`)
      .sort()
      .join("|");
  }

  async function check() {

    if (paused.value || running.value) return;

    running.value = true;

    try {

      const remote = await resolveRemoteState();

      if (remote == null) return;

      const local = lastKnownState?.value ?? null;

      if (remote !== local) {

        if (lastKnownState) {
          lastKnownState.value = remote;
        }

        await onChanged();
      }

    } catch (err: any) {

      if (
        err?.message === "DRIVE_UNAUTHORIZED" ||
        err?.message === "DRIVE_UNAVAILABLE"
      ) {
        return;
      }

      console.warn("DriveWatcher error", err);

    } finally {

      running.value = false;

    }
  }

  function onVisibilityChange() {
    paused.value = document.hidden;
  }

  onMounted(() => {

    timer.value = window.setInterval(
      check,
      intervalMs
    );

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

  });

  onBeforeUnmount(() => {

    if (timer.value) {
      clearInterval(timer.value);
    }

    document.removeEventListener(
      "visibilitychange",
      onVisibilityChange
    );

  });

  return {
    pause: () => (paused.value = true),
    resume: () => (paused.value = false),
    forceCheck: check,
  };
}