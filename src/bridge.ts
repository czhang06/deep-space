import { useEffect, useState } from "react";
import type { KingdomApi, Rule, Snapshot } from "./types.ts";

// In the desktop app the preload script provides `window.kingdom`. In a plain browser
// (npm run dev:renderer) a local stand-in is used so the UI can be built and previewed.
// Preview knobs: ?points=600&damage=1&aliens=2&grow=1

function previewApi(): KingdomApi {
  const params = new URLSearchParams(window.location.search);
  const number = (name: string, fallback: number) => {
    const value = Number(params.get(name));
    return params.has(name) && Number.isFinite(value) ? value : fallback;
  };
  const listeners = new Set<(snapshot: Snapshot) => void>();
  let snapshot: Snapshot = {
    seed: number("seed", 20261111),
    buildPoints: number("points", 420),
    mode: params.get("mode") === "upgrade" ? "upgrade" : "build",
    upgradePoints: number("upgrade", 0),
    upgradeLog: params.has("upgrade") || params.get("mode") === "upgrade" ? [{ buildPoints: number("points", 420), upgradeFrom: 0 }] : [],
    damage: number("damage", 0),
    aliens: Array.from({ length: number("aliens", 0) }, (_, index) => ({ id: `a${index}`, name: ["Gloop", "Zib", "Xorvak"][index % 3] })),
    streakMinutes: 32,
    today: {
      work: 154,
      play: 48,
      idle: 35,
      neutral: 27,
      playAllowance: 90,
      top: [
        { label: "Visual Studio Code", minutes: 96, category: "work" },
        { label: "GitHub", minutes: 31, category: "work" },
        { label: "YouTube", minutes: 40, category: "play" },
        { label: "Spotify", minutes: 22, category: "neutral" }
      ]
    },
    now: {
      category: "work",
      rawCategory: "work",
      display: "GitHub · Chrome",
      source: "known site",
      target: { targetType: "site", pattern: "github", label: "GitHub" }
    },
    paused: false,
    pausedUntil: null,
    tracking: "preview",
    rules: [{ id: "rule-1", targetType: "app", pattern: "discord", category: "neutral" }],
    settings: { openAtLogin: true, playAllowanceMinutes: 90 },
    events: [
      { text: "Finished a hab node.", at: Date.now() - 600000 },
      { text: "A new station came online. Focused work will grow it.", at: Date.now() - 86400000 }
    ]
  };

  const publish = (next: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener(snapshot));
    return Promise.resolve(snapshot);
  };

  if (params.get("grow")) {
    window.setInterval(() => {
      const step = number("grow", 2);
      publish(snapshot.mode === "upgrade" ? { upgradePoints: snapshot.upgradePoints + step } : { buildPoints: snapshot.buildPoints + step });
    }, 1000);
  }

  return {
    getSnapshot: () => Promise.resolve(snapshot),
    onSnapshot: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setRule: (rule) => {
      const next: Rule = { ...rule, id: `rule-${Date.now()}` };
      const rules = [next, ...snapshot.rules.filter((r) => !(r.targetType === rule.targetType && r.pattern === rule.pattern))];
      return publish({ rules, now: { ...snapshot.now, category: rule.category, rawCategory: rule.category, source: "your rule" } });
    },
    deleteRule: (id) => publish({ rules: snapshot.rules.filter((rule) => rule.id !== id) }),
    pause: (minutes) => publish({ paused: true, pausedUntil: minutes === null ? -1 : Date.now() + minutes * 60000, now: { ...snapshot.now, category: "paused", display: "Tracking paused" } }),
    resume: () => publish({ paused: false, pausedUntil: null, now: { ...snapshot.now, category: snapshot.now.rawCategory, display: "GitHub · Chrome" } }),
    setOpenAtLogin: (enabled) => publish({ settings: { ...snapshot.settings, openAtLogin: enabled } }),
    setPlayAllowance: (minutes) => publish({ settings: { ...snapshot.settings, playAllowanceMinutes: minutes }, today: { ...snapshot.today, playAllowance: minutes } }),
    setMode: (mode) => {
      if (mode === snapshot.mode) {
        return Promise.resolve(snapshot);
      }
      const upgradeLog =
        mode === "upgrade" ? [...snapshot.upgradeLog, { buildPoints: snapshot.buildPoints, upgradeFrom: snapshot.upgradePoints }] : snapshot.upgradeLog;
      return publish({ mode, upgradeLog });
    },
    clearHistory: () => publish({ today: { work: 0, play: 0, idle: 0, neutral: 0, playAllowance: snapshot.today.playAllowance, top: [] }, events: [] }),
    openMain: () => Promise.resolve(),
    hidePopup: () => Promise.resolve(),
    openDataFolder: () => Promise.resolve()
  };
}

export const api: KingdomApi = window.kingdom ?? previewApi();
export const isPreview = !window.kingdom;

export function useSnapshot(): Snapshot | null {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    let alive = true;
    void api.getSnapshot().then((first) => alive && setSnapshot(first));
    const unsubscribe = api.onSnapshot((next) => alive && setSnapshot(next));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return snapshot;
}
