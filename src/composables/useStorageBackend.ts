import { ref } from "vue";
import { detectStorageBackend, type StorageBackend } from "@/utils/storageBackend";

const backend = ref<StorageBackend>(detectStorageBackend());

export function useStorageBackend() {
  return { backend };
}