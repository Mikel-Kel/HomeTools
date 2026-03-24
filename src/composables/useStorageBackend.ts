import { ref } from "vue";
import { detectStorageBackend, type StorageBackend } from "@/utils/storageBackend";

const backend = ref<StorageBackend>(detectStorageBackend());
/*const backend = "GOOGLE_DRIVE"*/

export function useStorageBackend() {
  return { backend };
}