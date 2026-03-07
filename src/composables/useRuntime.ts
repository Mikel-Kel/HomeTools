import { ref } from "vue";
import { detectRuntime, type HomeToolsRuntime } from "@/runtimeEnvironment";

const runtime = ref<HomeToolsRuntime>(detectRuntime());

export function useRuntime() {
  return {
    runtime
  };
}