import type { AppMeta, CastleSnapshot, ClassificationRule } from "./models";

declare global {
  interface Window {
    castlekeeper?: {
      getMeta: () => Promise<AppMeta>;
      getSnapshot: () => Promise<CastleSnapshot>;
      pauseSimulation: () => Promise<CastleSnapshot>;
      resumeSimulation: () => Promise<CastleSnapshot>;
      getRules: () => Promise<ClassificationRule[]>;
      addRule: (rule: Omit<ClassificationRule, "id">) => Promise<ClassificationRule[]>;
      deleteRule: (id: string) => Promise<ClassificationRule[]>;
    };
  }
}

export {};
