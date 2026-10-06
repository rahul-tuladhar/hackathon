"use client";

import { useEffect } from "react";
import { useAgentStore } from "@/lib/store";

/** Seeds the demo with the sample Big CV and restores layout prefs on load. */
export function Bootstrap() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await useAgentStore.persist.rehydrate();
      if (cancelled) return;

      const store = useAgentStore.getState();
      store.loadPrefs();
      if (!store.rawCV) store.hydrateSample();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
