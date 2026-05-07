import { create } from "zustand";
import { createMockMeta, createMockRules, createMockSnapshot } from "../lib/mockData";
import type { AppMeta, CastleSnapshot, ClassificationRule } from "../types/models";

interface CastleStoreState {
  meta: AppMeta | null;
  snapshot: CastleSnapshot | null;
  rules: ClassificationRule[];
  isLoading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  loadRules: () => Promise<void>;
  addRule: (rule: Omit<ClassificationRule, "id">) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
}

async function loadMeta(): Promise<AppMeta> {
  if (window.castlekeeper) {
    return window.castlekeeper.getMeta();
  }

  return createMockMeta();
}

async function loadSnapshot(): Promise<CastleSnapshot> {
  if (window.castlekeeper) {
    return window.castlekeeper.getSnapshot();
  }

  return createMockSnapshot();
}

async function requestPause(): Promise<CastleSnapshot> {
  if (window.castlekeeper) {
    return window.castlekeeper.pauseSimulation();
  }

  return { ...createMockSnapshot(), isPaused: true };
}

async function requestResume(): Promise<CastleSnapshot> {
  if (window.castlekeeper) {
    return window.castlekeeper.resumeSimulation();
  }

  return createMockSnapshot();
}

async function loadRules(): Promise<ClassificationRule[]> {
  if (window.castlekeeper) {
    return window.castlekeeper.getRules();
  }

  return createMockRules();
}

async function requestAddRule(
  rule: Omit<ClassificationRule, "id">
): Promise<ClassificationRule[]> {
  if (window.castlekeeper) {
    return window.castlekeeper.addRule(rule);
  }

  return [createMockRules()[0], { id: "mock-added", ...rule }];
}

async function requestDeleteRule(id: string): Promise<ClassificationRule[]> {
  if (window.castlekeeper) {
    return window.castlekeeper.deleteRule(id);
  }

  return createMockRules().filter((rule) => rule.id !== id);
}

export const useCastleStore = create<CastleStoreState>((set) => ({
  meta: null,
  snapshot: null,
  rules: [],
  isLoading: false,
  error: null,

  hydrate: async () => {
    set({ isLoading: true, error: null });

    try {
      const [meta, snapshot, rules] = await Promise.all([
        loadMeta(),
        loadSnapshot(),
        loadRules()
      ]);
      set({ meta, snapshot, rules, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load castle snapshot."
      });
    }
  },

  refresh: async () => {
    try {
      const snapshot = await loadSnapshot();
      set({ snapshot, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to refresh castle snapshot."
      });
    }
  },

  loadRules: async () => {
    try {
      const rules = await loadRules();
      set({ rules, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to load classification rules."
      });
    }
  },

  pauseSimulation: async () => {
    try {
      const snapshot = await requestPause();
      set({ snapshot, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to pause the simulation."
      });
    }
  },

  resumeSimulation: async () => {
    try {
      const snapshot = await requestResume();
      set({ snapshot, error: null });
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to resume the simulation."
      });
    }
  },

  addRule: async (rule) => {
    try {
      const rules = await requestAddRule(rule);
      set((state) => ({
        rules,
        meta: state.meta ? { ...state.meta, ruleCount: rules.length } : state.meta,
        error: null
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to save classification rule."
      });
    }
  },

  deleteRule: async (id) => {
    try {
      const rules = await requestDeleteRule(id);
      set((state) => ({
        rules,
        meta: state.meta ? { ...state.meta, ruleCount: rules.length } : state.meta,
        error: null
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Unable to delete classification rule."
      });
    }
  }
}));
