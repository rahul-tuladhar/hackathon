"use client";

import { useEffect } from "react";
import { useAgentStore } from "@/lib/store";
import { useMemoryStore } from "@/lib/memory-store";

/** Seeds the demo with the sample Big CV and restores layout prefs on load. */
export function Bootstrap() {
  const rawCV = useAgentStore((s) => s.rawCV);
  const hydrateSample = useAgentStore((s) => s.hydrateSample);
  const loadPrefs = useAgentStore((s) => s.loadPrefs);
  const loadMemory = useMemoryStore((s) => s.load);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  useEffect(() => {
    if (!rawCV) hydrateSample();
  }, [rawCV, hydrateSample]);

  return null;
}
