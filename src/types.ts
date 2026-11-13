import type { MilestonePlanEntry } from "./station/milestones.ts";
import type { UpgradeSegment } from "./station/upgrades.ts";

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
  mode: "build" | "upgrade";
  upgradePoints: number;
  upgradeLog: UpgradeSegment[];
  damage: number;
  aliens: Array<{ id: string; name: string }>;
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
  settings: { openAtLogin: boolean; playAllowanceMinutes: number; milestoneNotifications: boolean };
  /** places on the journey already reached; at is null when reached before the daily records */
  milestones: Array<{ index: number; at: number | null; approx?: boolean }>;
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
  setMode(mode: "build" | "upgrade"): Promise<Snapshot>;
  setUpgradeFocus(pieceId: number | null, label?: string): Promise<Snapshot>;
  setMilestonePlan(plan: MilestonePlanEntry[]): Promise<Snapshot>;
  setMilestoneNotifications(enabled: boolean): Promise<Snapshot>;
  /** the main window is asked to show the logbook (from a milestone notification) */
  onOpenLogbook?(listener: () => void): () => void;
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
