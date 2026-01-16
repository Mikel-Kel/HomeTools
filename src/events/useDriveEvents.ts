// src/composables/events/useDriveEvents.ts
import { useDriveJsonFile } from "@/composables/useDriveJsonFile";

export function useDriveEvents(eventsFolderId: string) {
  const jsonFile = useDriveJsonFile(
    eventsFolderId,
    "events.json"
  );

  async function load() {
    return await jsonFile.load();
  }

  async function save(data: any) {
    await jsonFile.save(data);
  }

  return {
    // state
    busy: jsonFile.busy,
    error: jsonFile.error,

    // actions
    load,
    save,
  };
}