export type Category = "work" | "play" | "idle" | "neutral";

export interface Rule {
  id: string;
  targetType: "app" | "site";
  pattern: string;
  category: Exclude<Category, "idle">;
}

export interface Snapshot {
  seed: number;
  buildPoints: number;
  damage: number;
  rogues: Array<{ id: string; name: string }>;
  builders: number;
  streakMinutes: number;
  today: {
    work: number;
    play: number;
    idle: number;
    neutral: number;
    playAllowance: number;
    top: Array<{ label: string; minutes: number; category: Category }>;
  };
  now: {
    category: Category | "paused";
    rawCategory: Category;
    display: string;
    source: string;
    target: { targetType: "app" | "site"; pattern: string; label: string } | null;
  };
  paused: boolean;
  pausedUntil: number | null;
  tracking: "live" | "starting" | "unsupported" | "preview";
  rules: Rule[];
  settings: { openAtLogin: boolean; playAllowanceMinutes: number };
  events: Array<{ text: string; at: number }>;
}

export interface KingdomApi {
  getSnapshot(): Promise<Snapshot>;
  onSnapshot(listener: (snapshot: Snapshot) => void): () => void;
  setRule(rule: Omit<Rule, "id">): Promise<Snapshot>;
  deleteRule(id: string): Promise<Snapshot>;
  pause(minutes: number | null): Promise<Snapshot>;
  resume(): Promise<Snapshot>;
  setOpenAtLogin(enabled: boolean): Promise<Snapshot>;
  setPlayAllowance(minutes: number): Promise<Snapshot>;
  clearHistory(): Promise<Snapshot>;
  openMain(): Promise<void>;
  hidePopup(): Promise<void>;
  openDataFolder(): Promise<void>;
}

declare global {
  interface Window {
    kingdom?: KingdomApi;
  }
}
