import { ref } from "vue";
import { useDriveFolder } from "./useDriveFolder";

export function useDriveEvents(eventsFolderId: string) {
  const folder = useDriveFolder(eventsFolderId);
  const fileId = ref<string | null>(null);

  async function load() {
    await folder.refresh();

    const file = folder.findByName("events.json");
    if (!file) {
      console.warn("events.json not found");
      return null;
    }

    fileId.value = file.id;
    return await folder.openJSON(file.id);
  }

  async function save(data: any) {
    const id = await folder.saveJSONFile("events.json", data);
    fileId.value = id;
  }

  return {
    // state
    busy: folder.busy,
    error: folder.lastError,

    // actions
    load,
    save,
  };
}