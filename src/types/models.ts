export type ActivityCategory = "work" | "play" | "idle" | "unknown";

export interface WorldFocusReadingStep {
  key: "anchor" | "trace" | "inspect";
  title: string;
  label: string;
  detail: string;
}

export type CitizenType = "builder" | "drifter" | "rogue";

export interface ActivitySummary {
  workMinutes: number;
  playMinutes: number;
  idleMinutes: number;
  unknownMinutes: number;
  dominantCategory: ActivityCategory;
}

export interface Citizen {
  id: string;
  type: CitizenType;
  name: string;
  mood: string;
  x: number;
  z: number;
  districtId: string;
  task: string;
}

export interface UnlockRoadmapItem {
  name: string;
  metric: "buildProgress" | "order";
  target: number;
  current: number;
  progress: number;
  hint: string;
  status: "unlocked" | "active" | "locked";
}

export interface KingdomAlert {
  code: string;
  severity: "good" | "warning" | "danger" | "info";
  title: string;
  detail: string;
}

export interface KingdomDistrict {
  id: string;
  name: string;
  status: "active" | "planned" | "strained" | "quiet";
  detail: string;
}

export interface WorldFocus {
  label: string;
  area: string;
  anchorLabel: string;
  anchorDetail: string;
  anchorLeft: string;
  anchorTop: string;
  routeLabel: string;
  routeDetail: string;
  routeLeft: string;
  routeTop: string;
  viewTip: string;
  secondaryView: "rampart" | "plan";
  recommendedViewLabel: string;
  secondaryViewLabel: string;
  viewStrategy: string;
  storyline: string;
  confirmationDetail: string;
  readingSteps: WorldFocusReadingStep[];
  detail: string;
  spotlight: string;
  note: string;
  statusLabel: string;
  statusDetail: string;
  statusTone: "active" | "steady" | "warning" | "ready";
  recommendedView: "rampart" | "plan";
  left: string;
  top: string;
  worldPosition: [number, number, number];
  color: string;
}

export interface CastleSnapshot {
  updatedAt: string;
  buildProgress: number;
  order: number;
  morale: number;
  castleStageLabel: string;
  kingdomEffectTitle: string;
  kingdomEffectBody: string;
  kingdomEffectAccentClass: string;
  currentStreakCategory: ActivityCategory;
  currentStreakMinutes: number;
  currentStreakLabel: string;
  currentStreakTier: "settling" | "building" | "surging";
  currentStreakSummary: string;
  currentStreakMomentumLabel: string;
  worldFocus: WorldFocus | null;
  worldAtmosphere: string;
  nextUnlock: string;
  nextUnlockProgress: number;
  nextUnlockHint: string;
  currentCategory: ActivityCategory;
  currentLabel: string;
  currentAppName: string;
  currentProcessName: string;
  currentWindowTitle: string;
  classificationSource: string;
  classificationSourceLabel: string;
  trackerReason: string;
  activeOverrideSummary: string;
  activeRulePattern: string;
  activeRuleTargetType: string;
  activeRuleCategory: string;
  currentIdleSeconds: number;
  trackingStatus: string;
  trackingStatusLabel: string;
  trackingStatusDetail: string;
  quickRuleDomainTarget: string;
  quickRuleAppTarget: string;
  currentBrowserDomain: string;
  currentBrowserCategory: string;
  currentBrowserTitle: string;
  lastBrowserEventAt: string;
  lastBrowserEventBrowser: string;
  browserBridgeFresh: boolean;
  browserBridgeAgeSeconds: number | null;
  browserBridgeLabel: string;
  browserBridgeDetail: string;
  browserBridgeToneClass: string;
  isPaused: boolean;
  activity: ActivitySummary;
  citizens: Citizen[];
  eventLog: string[];
  unlockedStructures: string[];
  unlockRoadmap: UnlockRoadmapItem[];
  alerts: KingdomAlert[];
  districts: KingdomDistrict[];
  recentActivity: Array<{
    timestamp: string;
    timestampLabel?: string;
    category: string;
    categoryLabel?: string;
    appName: string;
    windowTitle: string;
    browserDomain: string;
    browserCategory: string;
    idleSeconds: number;
    label?: string;
    source?: string;
    sourceLabel?: string;
    rulePattern?: string;
  }>;
}

export interface AppMeta {
  appName: string;
  platform: string;
  trackingMode: string;
  privacy: string;
  cycleSeconds?: number;
  ruleCount?: number;
}

export interface ClassificationRule {
  id: string;
  targetType: "app" | "domain";
  pattern: string;
  category: ActivityCategory;
}

export const DEFAULT_WORLD_FOCUS: WorldFocus = {
  label: "Central works",
  area: "Central works",
  anchorLabel: "Island courtyard",
  anchorDetail: "Start from the middle of the island and use the current build markers to orient yourself.",
  anchorLeft: "50%",
  anchorTop: "64%",
  routeLabel: "Courtyard centerline",
  routeDetail: "Carry your eye from the courtyard centerline toward the current build marker.",
  routeLeft: "50%",
  routeTop: "61%",
  viewTip: "Look to the island core and current build markers.",
  secondaryView: "rampart",
  recommendedViewLabel: "Plan View",
  secondaryViewLabel: "Rampart View",
  viewStrategy: "Start in Plan View to locate the center cleanly, then switch to Rampart View to understand the mood and depth.",
  storyline: "Anchor on Island courtyard, trace via Courtyard centerline, then inspect Central works.",
  confirmationDetail: "Start in Plan View, then confirm in Rampart View. Start in Plan View to locate the center cleanly, then switch to Rampart View to understand the mood and depth.",
  readingSteps: [
    {
      key: "anchor",
      title: "Anchor",
      label: "Island courtyard",
      detail: "Start from the middle of the island and use the current build markers to orient yourself."
    },
    {
      key: "trace",
      title: "Trace",
      label: "Courtyard centerline",
      detail: "Carry your eye from the courtyard centerline toward the current build marker."
    },
    {
      key: "inspect",
      title: "Inspect",
      label: "Central works",
      detail: "Plan view is the safest way to read the current build footprint."
    }
  ],
  detail: "The builders are still deciding where the next major scene change should land.",
  spotlight: "Plan view is the safest way to read the current build footprint.",
  note: "The current build footprint still needs a clearer scene anchor.",
  statusLabel: "Surveying site",
  statusDetail: "The kingdom is still gathering enough momentum to make the next focal point feel decisive.",
  statusTone: "steady",
  recommendedView: "plan",
  left: "50%",
  top: "59%",
  worldPosition: [0, 0.82, 0],
  color: "#d5d0c8"
};
