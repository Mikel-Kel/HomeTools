import { onMounted, onBeforeUnmount, ref } from "vue";
import { getFileMetadataByName } from "@/services/google/googleDrive";

interface DriveWatcherOptions {
  folderId: string;
  fileName: string;

  lastKnownModified: { value: string | null };
  onChanged: () => Promise<void> | void;
  intervalMs?: number;
}

export function useDriveWatcher({
  folderId,
  fileName,
  lastKnownModified,
  onChanged,
  intervalMs = 5_000,
}: DriveWatcherOptions) {
  const timer = ref<number | null>(null);
  const paused = ref(false);
  const running = ref(false);

  async function check() {
    if (paused.value || running.value) return;

    running.value = true;

    try {
      const meta = await getFileMetadataByName(
        folderId,
        fileName
      );

      if (!meta?.modifiedTime) return;

      const remote = meta.modifiedTime;
      const local = lastKnownModified.value;

      if (!local || remote > local) {
        // 🔑 important : set BEFORE reload
        lastKnownModified.value = remote;
        await onChanged();
      }
    } catch (err) {
      console.warn("DriveWatcher error", err);
    } finally {
      running.value = false;
    }
  }

  function onVisibilityChange() {
    paused.value = document.hidden;
  }

  onMounted(() => {
    timer.value = window.setInterval(check, intervalMs);
    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );
  });

  onBeforeUnmount(() => {
    if (timer.value) clearInterval(timer.value);
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