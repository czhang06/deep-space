const { classifyObservation } = require("./activity-classifier.cjs");
const { BrowserBridgeServer } = require("./browser-bridge-server.cjs");
const { PersistenceService } = require("./persistence-service.cjs");
const { WindowsActivityService } = require("./windows-activity-service.cjs");

const TICK_SECONDS = 4;
const BROWSER_EVENT_MAX_AGE_MS = 30000;
const browserProcesses = new Set(["chrome", "msedge", "brave", "firefox", "opera", "arc"]);
const UNLOCK_MILESTONES = [
  {
    name: "Market stall",
    metric: "buildProgress",
    target: 20,
    hint: "Reach 20 build progress to open a proper market square.",
    event: "A proper market square opened beside the keep."
  },
  {
    name: "Workshop frame",
    metric: "buildProgress",
    target: 35,
    hint: "Reach 35 build progress to raise a permanent workshop frame.",
    event: "The builders raised a workshop frame."
  },
  {
    name: "Harbor skiff",
    metric: "buildProgress",
    target: 46,
    hint: "Reach 46 build progress to launch a supply skiff onto the ponds.",
    event: "A harbor skiff now moves supplies through the inner ponds."
  },
  {
    name: "Farm plots",
    metric: "buildProgress",
    target: 52,
    hint: "Reach 52 build progress to cultivate the first outer-ring farm plots.",
    event: "The outer ring has been tilled into working farm plots."
  },
  {
    name: "Watch post",
    metric: "order",
    target: 62,
    hint: "Raise order to 62 so the kingdom can support a proper watch post.",
    event: "A watch post now stands over the village path."
  },
  {
    name: "Stone workshop",
    metric: "buildProgress",
    target: 68,
    hint: "Reach 68 build progress to reinforce the workshop in stone.",
    event: "The workshop has been reinforced with stone and proper storage."
  },
  {
    name: "Gatehouse",
    metric: "order",
    target: 74,
    hint: "Raise order to 74 to justify a defended western gatehouse.",
    event: "A proper gatehouse now guards the western bridge."
  },
  {
    name: "Stone walls",
    metric: "buildProgress",
    target: 82,
    hint: "Reach 82 build progress to replace timber defenses with stone walls.",
    event: "Stone curtain walls now encircle the stronghold."
  }
];
const DISTRICT_CENTERS = {
  "commons-green": { x: -1.55 / 0.42, z: -1.15 / 0.42 },
  "watch-ridge": { x: 1.5 / 0.42, z: -1.2 / 0.42 },
  "artisans-ward": { x: -1.35 / 0.42, z: 1.2 / 0.42 },
  "chapel-rise": { x: 1.55 / 0.42, z: 1.15 / 0.42 }
};
const DISTRICT_OFFSETS = [
  { x: -0.72, z: -0.36 },
  { x: 0.64, z: -0.18 },
  { x: -0.24, z: 0.58 },
  { x: 0.48, z: 0.4 }
];

function createInitialState(savedState = {}) {
  return {
    startedAt: new Date(),
    updatedAt: new Date(),
    isPaused: false,
    buildProgress: 18,
    order: 58,
    morale: 67,
    currentStreakCategory: "unknown",
    currentStreakTicks: 0,
    currentStreakLabel: "Waiting for activity",
    currentStreakStartedAt: "",
    currentCategory: "unknown",
    currentLabel: "Waiting for activity",
    currentAppName: "Unknown app",
    currentProcessName: "",
    currentWindowTitle: "",
    classificationSource: "waiting",
    activeRulePattern: "",
    activeRuleTargetType: "",
    activeRuleCategory: "",
    currentIdleSeconds: 0,
    trackingStatus: "starting",
    currentBrowserDomain: "",
    currentBrowserCategory: "unknown",
    currentBrowserTitle: "",
    lastBrowserEventAt: "",
    lastBrowserEventBrowser: "",
    activity: {
      workMinutes: 0,
      playMinutes: 0,
      idleMinutes: 0,
      unknownMinutes: 0,
      dominantCategory: "unknown"
    },
    citizens: [
      { id: "builder-1", type: "builder", name: "Mara", mood: "busy", x: -2.2, z: 1.2 },
      { id: "builder-2", type: "builder", name: "Oren", mood: "steady", x: 1.7, z: 0.8 },
      { id: "drifter-1", type: "drifter", name: "Nell", mood: "wandering", x: 2.6, z: -1.1 }
    ],
    eventLog: [
      "Tiny Kingdom is now listening for local Windows activity.",
      "The first builders are waiting for your next focused streak."
    ],
    unlockedStructures: ["Timber keep", "Market stall"],
    lastObservation: null,
    recentActivity: [],
    lastBrowserEvent: null,
    rules: [],
    ...savedState
  };
}

function getStreakMinutes(state) {
  return Math.max(0, Math.round((Number(state.currentStreakTicks ?? 0) * TICK_SECONDS) / 6) / 10);
}

function getStreakTier(state) {
  const minutes = getStreakMinutes(state);

  if (minutes >= 20) {
    return "surging";
  }

  if (minutes >= 8) {
    return "building";
  }

  return "settling";
}

function formatStreakCategory(category) {
  if (category === "work") {
    return "Work";
  }

  if (category === "play") {
    return "Play";
  }

  if (category === "idle") {
    return "Idle";
  }

  return "Unknown";
}

function formatRecentActivitySourceLabel(source) {
  const labels = {
    "override-rule": "Manual override",
    "browser-bridge": "Browser category",
    "default-work": "Default work rule",
    "default-play": "Default play rule",
    "idle-threshold": "Idle threshold",
    "fallback-unknown": "Fallback guess",
    waiting: "Waiting for data"
  };

  return labels[source ?? "waiting"] ?? source ?? "Waiting for data";
}

function formatRecentActivityTimestampLabel(timestamp) {
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 1000));

  if (ageSeconds < 45) {
    return "Just now";
  }

  if (ageSeconds < 3600) {
    return `${Math.max(1, Math.round(ageSeconds / 60))}m ago`;
  }

  return `${Math.max(1, Math.round(ageSeconds / 3600))}h ago`;
}

function decorateRecentActivityEntry(entry) {
  return {
    ...entry,
    timestampLabel: formatRecentActivityTimestampLabel(entry.timestamp),
    categoryLabel: formatStreakCategory(entry.category),
    sourceLabel: formatRecentActivitySourceLabel(entry.source)
  };
}

function formatStreakMomentumLabel(tier) {
  if (tier === "surging") {
    return "Surging";
  }

  if (tier === "building") {
    return "Building";
  }

  return "Settling";
}

function deriveStreakSummary(state, streakMinutes) {
  const categoryLabel = formatStreakCategory(state.currentStreakCategory);
  const targetLabel = state.currentStreakLabel || "current context";

  return `${categoryLabel} ${streakMinutes}m in ${targetLabel}`;
}

function deriveWorldFocus(nextUnlockName) {
  if (nextUnlockName === "Market stall") {
    return {
      label: "Market square",
      area: "East village approach",
      anchorLabel: "Right-side village road",
      anchorDetail: "Find the road that runs into the far-right wall; the market site sits just inside that approach.",
      anchorLeft: "74%",
      anchorTop: "52%",
      routeLabel: "Road into the wall",
      routeDetail: "Follow the road toward the far-right wall before looking inward.",
      routeLeft: "72%",
      routeTop: "54%",
      viewTip: "Look to the right-side road and market edge.",
      secondaryView: "plan",
      viewStrategy: "Start in Rampart View for the village mood, then switch to Plan View to confirm how the square sits off the approach road.",
      detail: "This is the first public square that makes the outer village feel inhabited.",
      spotlight: "Rampart view frames the market edge against the far wall and village road.",
      note: "Look to the village approach beside the east road.",
      recommendedView: "rampart",
      left: "69%",
      top: "55%",
      worldPosition: [3.65, 0.18, 0.52],
      color: "#d6bf79"
    };
  }

  if (nextUnlockName === "Workshop frame" || nextUnlockName === "Stone workshop") {
    return {
      label: nextUnlockName === "Stone workshop" ? "Stone workshop" : "Workshop yard",
      area: "Artisans' ward",
      anchorLabel: "Lower-left island ward",
      anchorDetail: "Use the lower-left district pad inside the island as your anchor; the workshop rises just above it.",
      anchorLeft: "32%",
      anchorTop: "66%",
      routeLabel: "Bridge into the ward",
      routeDetail: "Trace inward from the nearest bridge before looking up into the workshop yard.",
      routeLeft: "35%",
      routeTop: "64%",
      viewTip: "Look to the lower-left district inside the island keep.",
      secondaryView: "rampart",
      viewStrategy: "Start in Plan View to find the ward cleanly, then switch to Rampart View if you want to feel the workshop inside the fortress massing.",
      detail: "The workshop is the main build heartbeat, so it should read as the current center of effort.",
      spotlight: "Plan view gives the clearest read on the workshop yard and build footprint.",
      note: "Focus on the artisans' ward inside the lower-left side of the island.",
      recommendedView: "plan",
      left: "38%",
      top: "63%",
      worldPosition: [-1.48, 0.18, 1.16],
      color: "#e1cf8b"
    };
  }

  if (nextUnlockName === "Harbor skiff") {
    return {
      label: "Harbor skiff",
      area: "North pond",
      anchorLabel: "Upper-right pond ring",
      anchorDetail: "Look for the small pond tucked beyond the right wall; the harbor build sits on that shoreline.",
      anchorLeft: "82%",
      anchorTop: "41%",
      routeLabel: "Shoreline curve",
      routeDetail: "Read the pond edge first, then sweep along the shoreline toward the dock site.",
      routeLeft: "80%",
      routeTop: "39%",
      viewTip: "Look along the far-right upper pond outside the island edge.",
      secondaryView: "rampart",
      viewStrategy: "Start in Plan View to trace the pond ring, then use Rampart View to see how the harbor tucks into the edge of the kingdom.",
      detail: "A live skiff gives the moat-and-pond ring a clearer logistics story.",
      spotlight: "Plan view is best for reading the harbor route and pond placement together.",
      note: "Watch the north pond on the far-right edge of the kingdom ring.",
      recommendedView: "plan",
      left: "78%",
      top: "37%",
      worldPosition: [5.05, 0.08, -3.92],
      color: "#9bd2e8"
    };
  }

  if (nextUnlockName === "Farm plots") {
    return {
      label: "Farm plots",
      area: "Outer farmland",
      anchorLabel: "Upper-right field edge",
      anchorDetail: "Track the ground beyond the east wall until it opens into the first broad field patch.",
      anchorLeft: "73%",
      anchorTop: "33%",
      routeLabel: "Beyond the east wall",
      routeDetail: "Sweep past the east wall and keep moving outward until the field patch opens up.",
      routeLeft: "76%",
      routeTop: "31%",
      viewTip: "Look beyond the east wall into the upper-right fields.",
      secondaryView: "rampart",
      viewStrategy: "Start in Plan View to locate the farmland cleanly, then switch to Rampart View to see how it expands the settlement beyond the walls.",
      detail: "This pushes the kingdom from a keep-in-isolation into a settlement with real food production.",
      spotlight: "Plan view is best for seeing how the fields extend the kingdom beyond the walls.",
      note: "The next build spreads into the outer farmland beyond the east wall.",
      recommendedView: "plan",
      left: "79%",
      top: "28%",
      worldPosition: [4.75, 0.08, -4.9],
      color: "#b8cb73"
    };
  }

  if (nextUnlockName === "Watch post") {
    return {
      label: "Watch ridge",
      area: "Watch ridge",
      anchorLabel: "Upper-right island corner",
      anchorDetail: "Use the upper-right island district by the far wall as the lookout anchor point.",
      anchorLeft: "53%",
      anchorTop: "44%",
      routeLabel: "Far wall backdrop",
      routeDetail: "Use the far wall as the backdrop, then look forward to the ridge itself.",
      routeLeft: "55%",
      routeTop: "42%",
      viewTip: "Look toward the upper-right island district near the far wall.",
      secondaryView: "plan",
      viewStrategy: "Start in Rampart View to read the lookout against the wall line, then switch to Plan View to confirm its exact district position.",
      detail: "The watch post clarifies how the kingdom monitors the outer ring.",
      spotlight: "Rampart view sells the lookout role best because it reads against the far walls and approach.",
      note: "Look to the upper-right district inside the island for the next lookout.",
      recommendedView: "rampart",
      left: "57%",
      top: "41%",
      worldPosition: [1.62, 0.2, -1.28],
      color: "#c8b18b"
    };
  }

  if (nextUnlockName === "Gatehouse") {
    return {
      label: "East gate",
      area: "East gate line",
      anchorLabel: "Main east approach",
      anchorDetail: "Follow the broad approach road until it meets the far-right wall; the gatehouse rises at that choke point.",
      anchorLeft: "72%",
      anchorTop: "50%",
      routeLabel: "Approach choke point",
      routeDetail: "Stay on the broad approach road until it compresses against the wall line.",
      routeLeft: "75%",
      routeTop: "50%",
      viewTip: "Look to the far-right wall where the main approach meets the fortification.",
      secondaryView: "plan",
      viewStrategy: "Start in Rampart View to read the gatehouse as architecture, then use Plan View to verify how it locks the approach road to the wall line.",
      detail: "This becomes the strongest architectural read in the wall-corner composition.",
      spotlight: "Rampart view is the strongest composition for the gatehouse because it sits on the visible far wall.",
      note: "The guarded entry point rises on the far-right wall line.",
      recommendedView: "rampart",
      left: "77%",
      top: "50%",
      worldPosition: [5.88, 0.15, 0],
      color: "#d8c48d"
    };
  }

  if (nextUnlockName === "Stone walls") {
    return {
      label: "Stone walls",
      area: "Far wall curtain",
      anchorLabel: "Visible north and east walls",
      anchorDetail: "Read the long far-wall run first; the stone-upgrade work spreads along those two visible wall faces.",
      anchorLeft: "63%",
      anchorTop: "43%",
      routeLabel: "Sweep the wall run",
      routeDetail: "Start on the far wall and sweep right to follow the upgrade path across the curtain.",
      routeLeft: "68%",
      routeTop: "43%",
      viewTip: "Look across the visible north and east wall run.",
      secondaryView: "plan",
      viewStrategy: "Start in Rampart View to feel the upgraded silhouette, then use Plan View to verify how the hardening spreads across both visible wall faces.",
      detail: "Stone walls are the moment the scene graduates from timber outpost to real citadel.",
      spotlight: "Rampart view best shows the upgraded wall silhouette and fortress massing.",
      note: "The next fortification pass hardens the visible far walls around the island.",
      recommendedView: "rampart",
      left: "71%",
      top: "44%",
      worldPosition: [6.1, 0.62, -1.2],
      color: "#c0c8d6"
    };
  }

  if (nextUnlockName === "Grand keep complete") {
    return {
      label: "Grand keep",
      area: "Central keep",
      anchorLabel: "Island center courtyard",
      anchorDetail: "Start from the island courtyard in the middle of the moat ring; the finished keep dominates that centerline.",
      anchorLeft: "50%",
      anchorTop: "64%",
      routeLabel: "Courtyard centerline",
      routeDetail: "Use the courtyard centerline to carry your eye straight into the keep.",
      routeLeft: "50%",
      routeTop: "61%",
      viewTip: "Look to the center of the island where the keep now dominates the scene.",
      secondaryView: "plan",
      viewStrategy: "Start in Rampart View for the finished silhouette, then switch to Plan View if you want to confirm the keep as the center of the whole footprint.",
      detail: "The kingdom has completed its current progression arc and the keep is the main visual anchor.",
      spotlight: "Rampart view turns the finished keep into the centerpiece of the whole composition.",
      note: "The island core is now the kingdom's finished centerpiece.",
      recommendedView: "rampart",
      left: "50%",
      top: "59%",
      worldPosition: [0, 0.82, 0],
      color: "#d5d0c8"
    };
  }

  return null;
}

function withViewLabels(worldFocus) {
  return {
    ...worldFocus,
    recommendedViewLabel: worldFocus.recommendedView === "rampart" ? "Rampart View" : "Plan View",
    secondaryViewLabel: worldFocus.secondaryView === "rampart" ? "Rampart View" : "Plan View"
  };
}

function deriveWorldFocusStatus(state, nextUnlock) {
  const streakTier = getStreakTier(state);
  const nextUnlockName = nextUnlock?.name ?? "Next project";
  const progress = Math.max(0, Math.min(100, Number(nextUnlock?.progress ?? 0)));

  if (state.isPaused) {
    return {
      statusLabel: "Paused",
      statusDetail: `${nextUnlockName} is waiting because the build loop is currently paused.`,
      statusTone: "warning"
    };
  }

  if (progress >= 100) {
    return {
      statusLabel: "Complete",
      statusDetail: `${nextUnlockName} is ready, so the kingdom can shift its attention to the next major scene change.`,
      statusTone: "ready"
    };
  }

  if (state.currentCategory === "work") {
    if (progress >= 92) {
      return {
        statusLabel: "Nearly ready",
        statusDetail: `${nextUnlockName} is almost ready to unlock if this focused streak keeps holding.`,
        statusTone: "ready"
      };
    }

    if (streakTier === "surging") {
      return {
        statusLabel: "Actively building",
        statusDetail: `${nextUnlockName} is the live build target and the current work surge is pushing it forward quickly.`,
        statusTone: "active"
      };
    }

    if (streakTier === "building") {
      return {
        statusLabel: "Momentum building",
        statusDetail: `${nextUnlockName} is advancing steadily as the current work streak gains weight.`,
        statusTone: "active"
      };
    }

    return {
      statusLabel: "Construction resumed",
      statusDetail: `${nextUnlockName} is back in motion, but the kingdom is still settling into a stronger construction rhythm.`,
      statusTone: "steady"
    };
  }

  if (state.currentCategory === "play") {
    return {
      statusLabel: "Attention drifting",
      statusDetail: `${nextUnlockName} is still the target, but playful detours are softening build momentum right now.`,
      statusTone: "warning"
    };
  }

  if (state.currentCategory === "idle") {
    return {
      statusLabel: "Holding pattern",
      statusDetail: `${nextUnlockName} is waiting on fresh activity before the kingdom starts moving it forward again.`,
      statusTone: "warning"
    };
  }

  if (progress >= 80) {
    return {
      statusLabel: "In sight",
      statusDetail: `${nextUnlockName} is close enough that the world should already be telegraphing where it will appear.`,
      statusTone: "steady"
    };
  }

  return {
    statusLabel: "Surveying site",
    statusDetail: `${nextUnlockName} is identified, but the kingdom still needs a clearer streak before the scene focus feels decisive.`,
    statusTone: "steady"
  };
}

function deriveWorldFocusNarrative(worldFocus) {
  const startView = worldFocus.recommendedView === "rampart" ? "Rampart View" : "Plan View";
  const confirmView = worldFocus.secondaryView === "rampart" ? "Rampart View" : "Plan View";

  return {
    storyline: `Anchor on ${worldFocus.anchorLabel}, trace via ${worldFocus.routeLabel}, then inspect ${worldFocus.label}.`,
    confirmationDetail: `Start in ${startView}, then confirm in ${confirmView}. ${worldFocus.viewStrategy}`
  };
}

function deriveWorldFocusReadingSteps(worldFocus) {
  return [
    {
      key: "anchor",
      title: "Anchor",
      label: worldFocus.anchorLabel,
      detail: worldFocus.anchorDetail
    },
    {
      key: "trace",
      title: "Trace",
      label: worldFocus.routeLabel,
      detail: worldFocus.routeDetail
    },
    {
      key: "inspect",
      title: "Inspect",
      label: worldFocus.label,
      detail: worldFocus.spotlight
    }
  ];
}

function deriveWorldAtmosphere(state) {
  const streakTier = getStreakTier(state);

  if (state.isPaused) {
    return "The kingdom is holding still with its build loop paused.";
  }

  if (state.currentCategory === "work") {
    if (streakTier === "surging") {
      return "A focused work surge is brightening the build site and making the fortress feel alive.";
    }

    if (streakTier === "building") {
      return "Builders are steadily pushing the next structure forward and keeping the courtyard active.";
    }

    return "Work has resumed, but the kingdom is still settling into its next construction rhythm.";
  }

  if (state.currentCategory === "play") {
    return "Warmer light and looser order are giving the kingdom a more unruly, mischievous atmosphere.";
  }

  if (state.currentCategory === "idle") {
    return "The ring has gone quiet, cooling the scene and slowing movement around the moat and wards.";
  }

  return "The kingdom is waiting for a stronger signal before its mood fully shifts.";
}

function deriveTrackerReason(state) {
  const source = state.classificationSource ?? "waiting";

  if (source === "override-rule" && state.activeRulePattern) {
    return `A manual ${state.activeRuleTargetType || "rule"} override for ${state.activeRulePattern} is driving this classification.`;
  }

  if (source === "browser-bridge" && state.currentBrowserDomain) {
    return `Fresh browser context from ${state.currentBrowserDomain} is steering the current category.`;
  }

  if (source === "idle-threshold") {
    return `Idle detection took over after ${Number(state.currentIdleSeconds ?? 0)} seconds without activity.`;
  }

  if (source === "default-work") {
    return "No explicit override was needed, so the tracker treated the current app as focused work.";
  }

  if (source === "default-play") {
    return "No explicit override was needed, so the tracker treated the current app as play.";
  }

  if (source === "fallback-unknown") {
    return "The tracker had partial context and fell back to an unknown classification.";
  }

  return state.currentLabel || "The tracker is still building enough context to explain this state cleanly.";
}

function deriveClassificationSourceLabel(state) {
  const source = state.classificationSource ?? "waiting";
  const labels = {
    "override-rule": "Manual override",
    "browser-bridge": "Browser category",
    "default-work": "Default work rule",
    "default-play": "Default play rule",
    "idle-threshold": "Idle threshold",
    "fallback-unknown": "Fallback guess",
    waiting: "Waiting for data"
  };

  return labels[source] ?? source;
}

function deriveActiveOverrideSummary(state) {
  if (state.classificationSource !== "override-rule" || !state.activeRulePattern) {
    return "";
  }

  return `${state.activeRuleTargetType} ${state.activeRulePattern} -> ${state.activeRuleCategory}`;
}

function deriveTrackingStatusPresentation(state) {
  if (state.isPaused || state.trackingStatus === "paused") {
    return {
      trackingStatusLabel: "Tracker paused",
      trackingStatusDetail: "The build loop is paused, so desktop activity is not advancing the kingdom right now."
    };
  }

  if (state.trackingStatus === "live") {
    return {
      trackingStatusLabel: "Desktop tracker live",
      trackingStatusDetail: "Foreground activity is being classified directly from the desktop tracker."
    };
  }

  if (state.trackingStatus === "fallback") {
    return {
      trackingStatusLabel: "Desktop tracker fallback",
      trackingStatusDetail: "The app is still classifying activity, but it is relying on fallback observation instead of the primary live tracker."
    };
  }

  return {
    trackingStatusLabel: "Tracker starting",
    trackingStatusDetail: "Waiting for the desktop tracker to report its first stable observation."
  };
}

function deriveQuickRuleTargets(state) {
  return {
    quickRuleDomainTarget: String(state.currentBrowserDomain ?? "").trim().toLowerCase(),
    quickRuleAppTarget:
      String(state.currentProcessName ?? "").trim().toLowerCase() ||
      String(state.currentAppName ?? "").trim().toLowerCase() ||
      ""
  };
}

function deriveBrowserBridgeStatus(state, bridgeMetrics) {
  if (!state.lastBrowserEventAt) {
    return {
      browserBridgeLabel: "Extension not connected",
      browserBridgeDetail: "No browser events yet",
      browserBridgeToneClass: "status-badge--stale"
    };
  }

  if (!bridgeMetrics.isFresh) {
    return {
      browserBridgeLabel: "Browser bridge stale",
      browserBridgeDetail:
        bridgeMetrics.ageSeconds != null
          ? `Last tab event ${bridgeMetrics.ageSeconds}s ago`
          : "Last tab event is too old",
      browserBridgeToneClass: "status-badge--stale"
    };
  }

  if (state.currentBrowserDomain) {
    return {
      browserBridgeLabel: "Live tab context",
      browserBridgeDetail:
        bridgeMetrics.ageSeconds != null
          ? `Fresh ${bridgeMetrics.ageSeconds}s ago`
          : "Fresh browser context",
      browserBridgeToneClass: "status-badge--live"
    };
  }

  return {
    browserBridgeLabel: "Bridge connected",
    browserBridgeDetail:
      bridgeMetrics.ageSeconds != null
        ? `Heartbeat ${bridgeMetrics.ageSeconds}s ago`
        : "Connected without active tab domain",
    browserBridgeToneClass: "status-badge--connected"
  };
}

function deriveCastleStageLabel(state) {
  const buildProgress = Number(state.buildProgress ?? 0);

  if (buildProgress < 22) {
    return "Founding keep";
  }

  if (buildProgress < 42) {
    return "Courtyard rising";
  }

  if (buildProgress < 62) {
    return "Island stronghold";
  }

  if (buildProgress < 82) {
    return "Moated citadel";
  }

  return "Grand island castle";
}

function deriveKingdomEffect(state) {
  if (state.currentCategory === "work") {
    return {
      kingdomEffectTitle: "Builders Are In Charge",
      kingdomEffectBody: "Focused work is speeding construction, strengthening order, and raising the next district faster.",
      kingdomEffectAccentClass: "kingdom-effect--work"
    };
  }

  if (state.currentCategory === "play") {
    return {
      kingdomEffectTitle: "Rogues Are Stirring",
      kingdomEffectBody: "Play sessions are inviting more mischief into the courtyard and slowing clean expansion a bit.",
      kingdomEffectAccentClass: "kingdom-effect--play"
    };
  }

  if (state.currentCategory === "idle") {
    return {
      kingdomEffectTitle: "The Ring Is Quiet",
      kingdomEffectBody: "Long pauses are drawing drifters into the village edge and lowering the kingdom's momentum.",
      kingdomEffectAccentClass: "kingdom-effect--idle"
    };
  }

  return {
    kingdomEffectTitle: "The Kingdom Is Watching",
    kingdomEffectBody:
      state.currentLabel || "Current activity is still being interpreted before it meaningfully shifts the kingdom.",
    kingdomEffectAccentClass: "kingdom-effect--unknown"
  };
}

function getUnlockMetricValue(state, metric) {
  if (metric === "order") {
    return Number(state.order ?? 0);
  }

  return Number(state.buildProgress ?? 0);
}

function getNextUnlockInfo(state) {
  const nextMilestone = UNLOCK_MILESTONES.find(
    (milestone) => !state.unlockedStructures.includes(milestone.name)
  );

  if (!nextMilestone) {
    return {
      name: "Grand keep complete",
      progress: 100,
      hint: "All current kingdom projects are complete."
    };
  }

  const value = getUnlockMetricValue(state, nextMilestone.metric);
  const progress = Math.max(0, Math.min(100, Math.round((value / nextMilestone.target) * 100)));

  return {
    name: nextMilestone.name,
    progress,
    hint: `${nextMilestone.hint} (${Math.round(Math.max(0, value))}/${nextMilestone.target})`
  };
}

function getUnlockRoadmap(state) {
  let activeAssigned = false;

  return UNLOCK_MILESTONES.map((milestone) => {
    const current = Math.round(Math.max(0, getUnlockMetricValue(state, milestone.metric)));
    const progress = Math.max(0, Math.min(100, Math.round((current / milestone.target) * 100)));
    const isUnlocked = state.unlockedStructures.includes(milestone.name);
    const status = isUnlocked
      ? "unlocked"
      : !activeAssigned
        ? "active"
        : "locked";

    if (status === "active") {
      activeAssigned = true;
    }

    return {
      name: milestone.name,
      metric: milestone.metric,
      target: milestone.target,
      current,
      progress: isUnlocked ? 100 : progress,
      hint: isUnlocked
        ? milestone.event
        : `${milestone.hint} (${current}/${milestone.target})`,
      status
    };
  });
}

function deriveAlerts(state, bridgeMetrics) {
  const alerts = [];
  const rogueCount = state.citizens.filter((citizen) => citizen.type === "rogue").length;
  const nextUnlock = getNextUnlockInfo(state);
  const isBrowserApp = browserProcesses.has((state.currentProcessName ?? "").toLowerCase());

  if (state.isPaused) {
    alerts.push({
      code: "simulation-paused",
      severity: "warning",
      title: "Simulation paused",
      detail: "Kingdom progression is frozen until the loop is resumed."
    });
  }

  if (isBrowserApp && !bridgeMetrics.isFresh) {
    alerts.push({
      code: "browser-bridge-stale",
      severity: "warning",
      title: "Browser scout blind",
      detail: "The active browser window has no fresh tab context, so classification may be less precise."
    });
  }

  if (rogueCount >= 2 || (state.currentCategory === "play" && rogueCount >= 1)) {
    alerts.push({
      code: "rogue-pressure",
      severity: "danger",
      title: "Rogue pressure rising",
      detail: "Play-heavy activity is empowering rogues and increasing disruption around the keep."
    });
  }

  if (state.currentIdleSeconds >= 300) {
    alerts.push({
      code: "quiet-ring",
      severity: "info",
      title: "Quiet ring settling in",
      detail: "A long idle stretch is cooling the kingdom and drawing drifters toward the outer paths."
    });
  }

  if (nextUnlock.progress >= 75 && nextUnlock.progress < 100) {
    alerts.push({
      code: "project-nearly-ready",
      severity: "good",
      title: `${nextUnlock.name} nearly ready`,
      detail: "One more good stretch should push the current kingdom project across the line."
    });
  }

  return alerts.slice(0, 3);
}

function getIslandDistrictCount(state) {
  return Math.max(1, Math.min(4, 1 + Math.floor(Number(state.buildProgress ?? 0) / 22)));
}

function deriveDistricts(state, alerts) {
  const rogueAlert = alerts.some((alert) => alert.code === "rogue-pressure");
  const quietAlert = alerts.some((alert) => alert.code === "quiet-ring");
  const buildCategory = state.currentCategory === "work";
  const playCategory = state.currentCategory === "play";
  const unlocked = new Set(state.unlockedStructures);
  const islandDistrictCount = getIslandDistrictCount(state);
  const districts = [];

  districts.push({
    id: "commons-green",
    name: "Commons Green",
    status: rogueAlert ? "strained" : quietAlert ? "quiet" : "active",
    detail: rogueAlert
      ? "Rogues are bothering traders and slowing the market edge."
      : quietAlert
        ? "The commons have gone calm while the kingdom sits quiet."
        : "Villagers and traders are keeping the central green lively."
  });

  if (unlocked.has("Workshop frame") || islandDistrictCount >= 2) {
    districts.push({
      id: "artisans-ward",
      name: "Artisans' Ward",
      status: buildCategory ? "active" : playCategory ? "strained" : "quiet",
      detail: buildCategory
        ? "The workshop yard is the hottest part of the build right now."
        : playCategory
          ? "Without focused work, the artisans' yard is losing momentum."
          : "The craftsmen are holding position while the kingdom slows."
    });
  } else {
    districts.push({
      id: "artisans-ward",
      name: "Artisans' Ward",
      status: "planned",
      detail: "The builders have marked out where the first permanent workshops will stand."
    });
  }

  if (islandDistrictCount >= 2) {
    districts.push({
      id: "chapel-rise",
      name: "Chapel Rise",
      status: quietAlert ? "quiet" : state.morale >= 65 ? "active" : "planned",
      detail: quietAlert
        ? "The shrine quarter is calm, with only lanterns and low foot traffic."
        : state.morale >= 65
          ? "The shrine quarter is helping keep spirits high."
          : "The shrine quarter exists, but it needs stronger morale to feel fully alive."
    });
  }

  if (unlocked.has("Watch post")) {
    districts.push({
      id: "watch-ridge",
      name: "Watch Ridge",
      status: rogueAlert ? "strained" : "active",
      detail: rogueAlert
        ? "Lookouts are actively signaling trouble along the outer paths."
        : "The ridge watch has the approaches well covered."
    });
  } else if (islandDistrictCount >= 3) {
    districts.push({
      id: "watch-ridge",
      name: "Watch Ridge",
      status: "planned",
      detail: "A watch district has been plotted here, but it still needs order and materials."
    });
  }

  return districts.slice(0, 4);
}

function deriveCitizens(state, districts, alerts) {
  const quietDistrict = districts.find((district) => district.status === "quiet")?.id;
  const strainedDistrict = districts.find((district) => district.status === "strained")?.id;
  const activeDistricts = districts
    .filter((district) => district.status === "active")
    .map((district) => district.id);
  const districtPopulation = new Map();

  function getPreferredDistricts(type) {
    if (type === "builder") {
      return ["artisans-ward", ...activeDistricts, "watch-ridge", "commons-green"];
    }

    if (type === "drifter") {
      return [quietDistrict, "chapel-rise", "commons-green", "artisans-ward"];
    }

    return [strainedDistrict, "commons-green", "watch-ridge", "chapel-rise"];
  }

  function getTask(type, districtId, mood) {
    if (type === "builder") {
      if (districtId === "artisans-ward") {
        return "Driving the workshop build";
      }

      if (districtId === "watch-ridge") {
        return "Reinforcing ridge defenses";
      }

      return "Hauling supplies between wards";
    }

    if (type === "drifter") {
      if (districtId === "chapel-rise") {
        return "Resting near the shrine lamps";
      }

      if (districtId === "commons-green") {
        return "Loitering around the commons";
      }

      return `Wandering while ${mood}`;
    }

    if (districtId === "commons-green") {
      return "Stirring trouble in the market";
    }

    if (districtId === "watch-ridge") {
      return "Testing the watch response";
    }

    return "Looking for a weak corner in the walls";
  }

  return state.citizens.map((citizen) => {
    const preferred = getPreferredDistricts(citizen.type).filter(Boolean);
    const districtId = preferred.find((id) => DISTRICT_CENTERS[id]) ?? "commons-green";
    const currentCount = districtPopulation.get(districtId) ?? 0;
    districtPopulation.set(districtId, currentCount + 1);
    const center = DISTRICT_CENTERS[districtId] ?? { x: citizen.x, z: citizen.z };
    const offset = DISTRICT_OFFSETS[currentCount % DISTRICT_OFFSETS.length];
    const tensionOffset =
      citizen.type === "rogue" && alerts.some((alert) => alert.code === "rogue-pressure")
        ? { x: 0.36, z: -0.24 }
        : { x: 0, z: 0 };

    return {
      ...citizen,
      districtId,
      task: getTask(citizen.type, districtId, citizen.mood),
      x: Number((center.x + offset.x + tensionOffset.x).toFixed(2)),
      z: Number((center.z + offset.z + tensionOffset.z).toFixed(2))
    };
  });
}

function extractBrowserContext(observation) {
  if (!observation || typeof observation !== "object") {
    return {
      browserDomain: "",
      browserCategory: "unknown",
      browserTitle: ""
    };
  }

  return {
    browserDomain:
      typeof observation.browserDomain === "string" ? observation.browserDomain : "",
    browserCategory:
      typeof observation.browserCategory === "string"
        ? observation.browserCategory
        : "unknown",
    browserTitle:
      typeof observation.browserTitle === "string" ? observation.browserTitle : ""
  };
}

function getBrowserBridgeMetrics(event) {
  if (!event?.receivedAt) {
    return {
      ageSeconds: null,
      isFresh: false
    };
  }

  const ageMs = Date.now() - new Date(event.receivedAt).getTime();

  if (Number.isNaN(ageMs)) {
    return {
      ageSeconds: null,
      isFresh: false
    };
  }

  return {
    ageSeconds: Math.max(0, Math.round(ageMs / 1000)),
    isFresh: ageMs <= BROWSER_EVENT_MAX_AGE_MS
  };
}

class KingdomService {
  constructor({ persistenceRootPath } = {}) {
    this.persistence = persistenceRootPath
      ? new PersistenceService(persistenceRootPath)
      : null;
    const savedState = this.persistence?.loadState();
    this.state = createInitialState(savedState ?? {});
    this.interval = null;
    this.activityService = process.platform === "win32" ? new WindowsActivityService() : null;
    this.browserBridge = new BrowserBridgeServer({
      onEvent: (event) => {
        this.handleBrowserEvent(event);
      }
    });
    this.tickInFlight = false;
    this.state.recentActivity = this.persistence?.loadActivityLog() ?? [];
    this.state.rules = this.persistence?.loadRules() ?? [];
    this.syncUnlocks(false);
  }

  start() {
    if (this.interval) {
      return;
    }

    this.browserBridge.start();
    void this.tick();
    this.interval = setInterval(() => {
      void this.tick();
    }, TICK_SECONDS * 1000);
  }

  stop() {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
    this.browserBridge.stop();
  }

  pause() {
    this.state.isPaused = true;
    this.state.updatedAt = new Date();
  }

  resume() {
    this.state.isPaused = false;
    this.state.updatedAt = new Date();
  }

  getMeta(platform) {
    return {
      appName: "Tiny Kingdom",
      platform,
      trackingMode: this.activityService ? "windows-live" : "mock-fallback",
      privacy: this.activityService
        ? "Local-only Windows tracker"
        : "Local-only mock data",
      cycleSeconds: TICK_SECONDS,
      ruleCount: this.state.rules.length
    };
  }

  getRules() {
    return this.state.rules;
  }

  addRule(input) {
    const rule = {
      id: `rule-${Date.now()}`,
      targetType: input.targetType,
      pattern: String(input.pattern ?? "").trim().toLowerCase(),
      category: input.category
    };

    if (!rule.pattern || !["app", "domain"].includes(rule.targetType)) {
      throw new Error("Invalid rule input.");
    }

    if (!["work", "play", "idle", "unknown"].includes(rule.category)) {
      throw new Error("Invalid rule category.");
    }

    this.state.rules = [
      rule,
      ...this.state.rules.filter(
        (existing) =>
          !(
            existing.targetType === rule.targetType &&
            existing.pattern === rule.pattern
          )
      )
    ];
    this.persistence?.saveRules(this.state.rules);
    this.pushEvent(`Saved ${rule.targetType} rule for ${rule.pattern} -> ${rule.category}.`);
    return this.state.rules;
  }

  deleteRule(id) {
    this.state.rules = this.state.rules.filter((rule) => rule.id !== id);
    this.persistence?.saveRules(this.state.rules);
    return this.state.rules;
  }

  getSnapshot() {
    const dominantCategory = this.findDominantCategory();
    const bridgeMetrics = getBrowserBridgeMetrics(this.state.lastBrowserEvent);
    const nextUnlock = getNextUnlockInfo(this.state);
    const unlockRoadmap = getUnlockRoadmap(this.state);
    const alerts = deriveAlerts(this.state, bridgeMetrics);
    const districts = deriveDistricts(this.state, alerts);
    const citizens = deriveCitizens(this.state, districts, alerts);
    const streakMinutes = getStreakMinutes(this.state);
    const streakTier = getStreakTier(this.state);
    const currentStreakMomentumLabel = formatStreakMomentumLabel(streakTier);
    const currentStreakSummary = deriveStreakSummary(this.state, streakMinutes);
    const castleStageLabel = deriveCastleStageLabel(this.state);
    const baseWorldFocus = deriveWorldFocus(nextUnlock.name);
    const worldFocus = baseWorldFocus
      ? {
          ...withViewLabels(baseWorldFocus),
          ...deriveWorldFocusStatus(this.state, nextUnlock),
          ...deriveWorldFocusNarrative(baseWorldFocus),
          readingSteps: deriveWorldFocusReadingSteps(baseWorldFocus)
        }
      : null;
    const worldAtmosphere = deriveWorldAtmosphere(this.state);
    const trackerReason = deriveTrackerReason(this.state);
    const classificationSourceLabel = deriveClassificationSourceLabel(this.state);
    const activeOverrideSummary = deriveActiveOverrideSummary(this.state);
    const trackingStatusPresentation = deriveTrackingStatusPresentation(this.state);
    const quickRuleTargets = deriveQuickRuleTargets(this.state);
    const browserBridgeStatus = deriveBrowserBridgeStatus(this.state, bridgeMetrics);
    const kingdomEffect = deriveKingdomEffect(this.state);

    return {
      updatedAt: this.state.updatedAt.toISOString(),
      buildProgress: Math.max(0, Math.min(100, Math.round(this.state.buildProgress))),
      order: Math.max(0, Math.min(100, Math.round(this.state.order))),
      morale: Math.max(0, Math.min(100, Math.round(this.state.morale))),
      castleStageLabel,
      ...kingdomEffect,
      currentStreakCategory: this.state.currentStreakCategory ?? "unknown",
      currentStreakMinutes: streakMinutes,
      currentStreakLabel: this.state.currentStreakLabel ?? this.state.currentLabel,
      currentStreakTier: streakTier,
      currentStreakSummary,
      currentStreakMomentumLabel,
      worldFocus,
      worldAtmosphere,
      nextUnlock: nextUnlock.name,
      nextUnlockProgress: nextUnlock.progress,
      nextUnlockHint: nextUnlock.hint,
      currentCategory: this.state.currentCategory,
      currentLabel: this.state.currentLabel,
      currentAppName: this.state.currentAppName,
      currentProcessName: this.state.currentProcessName,
      currentWindowTitle: this.state.currentWindowTitle,
      classificationSource: this.state.classificationSource,
      classificationSourceLabel,
      trackerReason,
      activeOverrideSummary,
      activeRulePattern: this.state.activeRulePattern,
      activeRuleTargetType: this.state.activeRuleTargetType,
      activeRuleCategory: this.state.activeRuleCategory,
      currentIdleSeconds: this.state.currentIdleSeconds,
      trackingStatus: this.state.trackingStatus,
      ...trackingStatusPresentation,
      ...quickRuleTargets,
      currentBrowserDomain: this.state.currentBrowserDomain,
      currentBrowserCategory: this.state.currentBrowserCategory,
      currentBrowserTitle: this.state.currentBrowserTitle,
      lastBrowserEventAt: this.state.lastBrowserEventAt,
      lastBrowserEventBrowser: this.state.lastBrowserEventBrowser,
      browserBridgeFresh: bridgeMetrics.isFresh,
      browserBridgeAgeSeconds: bridgeMetrics.ageSeconds,
      ...browserBridgeStatus,
      isPaused: this.state.isPaused,
      activity: {
        ...this.state.activity,
        dominantCategory
      },
      citizens,
      eventLog: this.state.eventLog.slice(0, 6),
      unlockedStructures: this.state.unlockedStructures,
      unlockRoadmap,
      alerts,
      districts,
      recentActivity: this.state.recentActivity.slice(0, 8).map(decorateRecentActivityEntry)
    };
  }

  async tick() {
    if (this.tickInFlight) {
      return;
    }

    this.tickInFlight = true;

    try {
      if (this.state.isPaused) {
        this.state.updatedAt = new Date();
        this.state.trackingStatus = "paused";
        return;
      }

      const observation = await this.readObservation();
      this.applyObservation(observation);
      this.saveState();
    } catch (error) {
      this.state.updatedAt = new Date();
      this.state.trackingStatus = "error";
      this.state.currentLabel = "Tracker temporarily unavailable";
      this.pushEvent(
        `Tracking error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      this.tickInFlight = false;
    }
  }

  async readObservation() {
    if (!this.activityService) {
      return {
        idleSeconds: 0,
        processName: "code",
        appName: "Visual Studio Code",
        windowTitle: "Tiny Kingdom mock tracking fallback",
        timestamp: new Date().toISOString()
      };
    }

    const observation = await this.activityService.getCurrentActivity();
    const browserEvent = this.state.lastBrowserEvent;
    const processName = (observation.processName ?? "").toLowerCase();
    const browserIsFresh = getBrowserBridgeMetrics(browserEvent).isFresh;

    if (browserIsFresh && browserProcesses.has(processName)) {
      return {
        ...observation,
        browserDomain: browserEvent.domain ?? "",
        browserCategory: browserEvent.category ?? "unknown",
        browserTitle: browserEvent.title ?? ""
      };
    }

    if (!browserProcesses.has(processName)) {
      return {
        ...observation,
        browserDomain: "",
        browserCategory: "unknown",
        browserTitle: ""
      };
    }

    return {
      ...observation,
      browserDomain: "",
      browserCategory: "unknown",
      browserTitle: ""
    };
  }

  applyObservation(observation) {
    const classification = classifyObservation(observation, this.state.rules);
    const deltaMinutes = TICK_SECONDS / 60;
    const previousCategory = this.state.currentCategory;
    const previousAppName = this.state.currentAppName;
    const previousBrowserDomain = this.state.currentBrowserDomain;

    this.state.updatedAt = new Date();
    this.state.lastObservation = observation;
    this.state.currentCategory = classification.category;
    this.state.currentLabel = classification.label;
    this.state.currentAppName = classification.appName;
    this.state.currentProcessName = observation.processName ?? "";
    this.state.currentWindowTitle = observation.windowTitle ?? "";
    this.state.classificationSource = classification.source ?? "waiting";
    this.state.activeRulePattern = classification.matchedRule?.pattern ?? "";
    this.state.activeRuleTargetType = classification.matchedRule?.targetType ?? "";
    this.state.activeRuleCategory = classification.matchedRule?.category ?? "";
    this.state.currentIdleSeconds = Number(observation.idleSeconds ?? 0);
    this.state.trackingStatus = this.activityService ? "live" : "fallback";

    const browserContext = extractBrowserContext(observation);
    const sameStreak =
      previousCategory === classification.category &&
      previousAppName === classification.appName &&
      previousBrowserDomain === browserContext.browserDomain;

    this.state.currentStreakCategory = classification.category;
    this.state.currentStreakLabel =
      browserContext.browserDomain || classification.appName || classification.label;
    this.state.currentStreakTicks = sameStreak
      ? Number(this.state.currentStreakTicks ?? 0) + 1
      : 1;
    this.state.currentStreakStartedAt = sameStreak && this.state.currentStreakStartedAt
      ? this.state.currentStreakStartedAt
      : this.state.updatedAt.toISOString();
    this.state.currentBrowserDomain = browserContext.browserDomain;
    this.state.currentBrowserCategory = browserContext.browserCategory;
    this.state.currentBrowserTitle = browserContext.browserTitle;

    if (classification.category === "work") {
      this.state.activity.workMinutes += deltaMinutes;
      this.state.buildProgress += 1.8 + this.countCitizens("builder") * 0.15;
      this.state.order += 0.28;
      this.state.morale += 0.22;

      if (Math.floor(this.state.activity.workMinutes) > 0 && Math.floor(this.state.activity.workMinutes) % 15 === 0) {
        this.ensureCitizenMilestone("builder", "Focused work welcomed another builder.");
      }
    } else if (classification.category === "play") {
      this.state.activity.playMinutes += deltaMinutes;
      this.state.order -= 0.42;
      this.state.morale += 0.08;

      if (Math.floor(this.state.activity.playMinutes) > 0 && Math.floor(this.state.activity.playMinutes) % 20 === 0) {
        this.ensureCitizenMilestone("rogue", "A rogue slipped into the courtyard during a playful streak.");
      }
    } else if (classification.category === "idle") {
      this.state.activity.idleMinutes += deltaMinutes;
      this.state.morale -= 0.18;

      if (Math.floor(this.state.activity.idleMinutes) > 0 && Math.floor(this.state.activity.idleMinutes) % 20 === 0) {
        this.ensureCitizenMilestone("drifter", "A drifter arrived while the kingdom sat idle.");
      }
    } else {
      this.state.activity.unknownMinutes += deltaMinutes;
    }

    this.recordRecentActivity(observation, classification);

    const builderCount = this.countCitizens("builder");
    const rogueCount = this.countCitizens("rogue");

    this.state.buildProgress -= rogueCount * 0.08;
    this.state.order += builderCount * 0.04 - rogueCount * 0.08;
    this.state.morale += builderCount * 0.03 - rogueCount * 0.04;

    this.state.order = Math.max(20, Math.min(100, this.state.order));
    this.state.morale = Math.max(30, Math.min(100, this.state.morale));
    this.state.buildProgress = Math.max(0, Math.min(100, this.state.buildProgress));
    this.syncUnlocks(true);
  }

  handleBrowserEvent(event) {
    const previousEvent = this.state.lastBrowserEvent;
    const browserContextChanged =
      !previousEvent ||
      previousEvent.domain !== (event.domain ?? "") ||
      previousEvent.category !== (event.category ?? "unknown") ||
      previousEvent.title !== (event.title ?? "");

    this.state.lastBrowserEvent = event;
    this.state.currentBrowserDomain = event.domain ?? "";
    this.state.currentBrowserCategory = event.category ?? "unknown";
    this.state.currentBrowserTitle = event.title ?? "";
    this.state.lastBrowserEventAt = event.receivedAt ?? new Date().toISOString();
    this.state.lastBrowserEventBrowser = event.browserName ?? "browser";
    this.persistence?.appendBrowserEvent(event);

    if (browserContextChanged && event.category && event.domain) {
      this.pushEvent(`Browser tracked ${event.category} activity on ${event.domain}.`);
    }

    this.saveState();
  }

  ensureCitizenMilestone(type, message) {
    const currentCount = this.countCitizens(type);
    const milestones = {
      builder: Math.max(1, Math.floor(this.state.activity.workMinutes / 15)),
      rogue: Math.max(0, Math.floor(this.state.activity.playMinutes / 20)),
      drifter: Math.max(0, Math.floor(this.state.activity.idleMinutes / 20))
    };

    if (currentCount >= milestones[type]) {
      return;
    }

    this.addCitizen(type);
    this.pushEvent(message);
  }

  findDominantCategory() {
    const activity = this.state.activity;
    const pairs = [
      ["work", activity.workMinutes],
      ["play", activity.playMinutes],
      ["idle", activity.idleMinutes],
      ["unknown", activity.unknownMinutes]
    ];

    return pairs.sort((left, right) => right[1] - left[1])[0][0];
  }

  countCitizens(type) {
    return this.state.citizens.filter((citizen) => citizen.type === type).length;
  }

  addCitizen(type) {
    const total = this.countCitizens(type) + 1;
    const names = {
      builder: ["Mara", "Oren", "Pike", "Tobin", "Alys"],
      drifter: ["Nell", "Bram", "Hett", "Rill", "Sable"],
      rogue: ["Rusk", "Vey", "Mott", "Keel", "Fen"]
    };

    this.state.citizens.push({
      id: `${type}-${total}`,
      type,
      name: names[type][(total - 1) % names[type].length],
      mood: type === "builder" ? "busy" : type === "rogue" ? "scheming" : "wandering",
      x: -2.8 + (((Date.now() / 1000) * 1.17 + total) % 6),
      z: -1.8 + (((Date.now() / 1000) * 0.83 + total * 0.7) % 4),
      districtId: "commons-green",
      task: type === "builder" ? "Awaiting orders" : type === "rogue" ? "Sizing up the walls" : "Looking for shelter"
    });
  }

  syncUnlocks(notify) {
    for (const milestone of UNLOCK_MILESTONES) {
      if (this.state.unlockedStructures.includes(milestone.name)) {
        continue;
      }

      if (getUnlockMetricValue(this.state, milestone.metric) < milestone.target) {
        continue;
      }

      this.state.unlockedStructures.push(milestone.name);

      if (notify) {
        this.pushEvent(milestone.event);
      }
    }
  }

  pushEvent(message) {
    if (this.state.eventLog[0] === message) {
      return;
    }

    this.state.eventLog.unshift(message);
    this.state.eventLog = this.state.eventLog.slice(0, 10);
  }

  recordRecentActivity(observation, classification) {
    const entry = {
      timestamp: new Date().toISOString(),
      category: classification.category,
      appName: classification.appName,
      windowTitle: observation.windowTitle ?? "",
      browserDomain: observation.browserDomain ?? "",
      browserCategory: observation.browserCategory ?? "unknown",
      idleSeconds: Number(observation.idleSeconds ?? 0),
      label: classification.label ?? "",
      source: classification.source ?? "waiting",
      rulePattern: classification.matchedRule?.pattern ?? ""
    };

    const latestEntry = this.state.recentActivity[0];
    const latestTimestamp = latestEntry ? new Date(latestEntry.timestamp).getTime() : 0;
    const nextTimestamp = new Date(entry.timestamp).getTime();
    const idleBucket = Math.floor(entry.idleSeconds / 30);
    const latestIdleBucket = latestEntry
      ? Math.floor(Number(latestEntry.idleSeconds ?? 0) / 30)
      : -1;
    const materiallyChanged =
      !latestEntry ||
      latestEntry.category !== entry.category ||
      latestEntry.appName !== entry.appName ||
      latestEntry.windowTitle !== entry.windowTitle ||
      latestEntry.browserDomain !== entry.browserDomain ||
      latestEntry.browserCategory !== entry.browserCategory ||
      (latestEntry.label ?? "") !== entry.label ||
      (latestEntry.source ?? "") !== entry.source ||
      (latestEntry.rulePattern ?? "") !== entry.rulePattern ||
      latestIdleBucket !== idleBucket;

    if (!materiallyChanged && nextTimestamp - latestTimestamp < 45000) {
      return;
    }

    this.state.recentActivity = [entry, ...this.state.recentActivity].slice(0, 40);
    this.persistence?.appendActivity(entry);
  }

  saveState() {
    this.persistence?.saveState({
      buildProgress: this.state.buildProgress,
      order: this.state.order,
      morale: this.state.morale,
      currentStreakCategory: this.state.currentStreakCategory,
      currentStreakTicks: this.state.currentStreakTicks,
      currentStreakLabel: this.state.currentStreakLabel,
      currentStreakStartedAt: this.state.currentStreakStartedAt,
      currentCategory: this.state.currentCategory,
      currentLabel: this.state.currentLabel,
      currentAppName: this.state.currentAppName,
      currentProcessName: this.state.currentProcessName,
      currentWindowTitle: this.state.currentWindowTitle,
      classificationSource: this.state.classificationSource,
      activeRulePattern: this.state.activeRulePattern,
      activeRuleTargetType: this.state.activeRuleTargetType,
      activeRuleCategory: this.state.activeRuleCategory,
      currentIdleSeconds: this.state.currentIdleSeconds,
      trackingStatus: this.state.trackingStatus,
      currentBrowserDomain: this.state.currentBrowserDomain,
      currentBrowserCategory: this.state.currentBrowserCategory,
      currentBrowserTitle: this.state.currentBrowserTitle,
      lastBrowserEventAt: this.state.lastBrowserEventAt,
      lastBrowserEventBrowser: this.state.lastBrowserEventBrowser,
      activity: this.state.activity,
      citizens: this.state.citizens,
      eventLog: this.state.eventLog,
      unlockedStructures: this.state.unlockedStructures
    });
  }
}

module.exports = {
  KingdomService
};
