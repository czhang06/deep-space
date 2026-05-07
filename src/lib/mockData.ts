import {
  DEFAULT_WORLD_FOCUS,
  type
  AppMeta,
  CastleSnapshot,
  ClassificationRule,
  KingdomAlert,
  KingdomDistrict,
  UnlockRoadmapItem
} from "../types/models";

export function createMockMeta(): AppMeta {
  return {
    appName: "Tiny Kingdom",
    platform: "browser-preview",
    trackingMode: "fallback-mock-live",
    privacy: "Local-only scaffold",
    cycleSeconds: 4,
    ruleCount: 2
  };
}

export function createMockRules(): ClassificationRule[] {
  return [
    {
      id: "rule-1",
      targetType: "domain",
      pattern: "youtube.com",
      category: "play"
    },
    {
      id: "rule-2",
      targetType: "app",
      pattern: "discord",
      category: "play"
    }
  ];
}

export function createMockSnapshot(): CastleSnapshot {
  const now = new Date();
  const pulse = Math.floor(now.getSeconds() / 6);
  const buildProgress = 54 + (pulse % 6);
  const nextUnlockProgress = Math.round((buildProgress / 68) * 100);
  const unlockRoadmap: UnlockRoadmapItem[] = [
    {
      name: "Market stall",
      metric: "buildProgress",
      target: 20,
      current: buildProgress,
      progress: 100,
      hint: "The market already serves the village core.",
      status: "unlocked"
    },
    {
      name: "Workshop frame",
      metric: "buildProgress",
      target: 35,
      current: buildProgress,
      progress: 100,
      hint: "The workshop skeleton is already standing inside the walls.",
      status: "unlocked"
    },
    {
      name: "Harbor skiff",
      metric: "buildProgress",
      target: 46,
      current: buildProgress,
      progress: 100,
      hint: "Supply skiffs now cut across the inner ponds.",
      status: "unlocked"
    },
    {
      name: "Farm plots",
      metric: "buildProgress",
      target: 52,
      current: buildProgress,
      progress: 100,
      hint: "The outer ring has already been broken into small farm plots.",
      status: "unlocked"
    },
    {
      name: "Watch post",
      metric: "order",
      target: 62,
      current: 68,
      progress: 100,
      hint: "Order is strong enough to keep a watch post staffed.",
      status: "unlocked"
    },
    {
      name: "Stone workshop",
      metric: "buildProgress",
      target: 68,
      current: buildProgress,
      progress: nextUnlockProgress,
      hint: `Raise build progress to 68 to reinforce the workshop in stone (${buildProgress}/68).`,
      status: "active"
    },
    {
      name: "Gatehouse",
      metric: "order",
      target: 74,
      current: 68,
      progress: Math.round((68 / 74) * 100),
      hint: "Raise order to 74 to justify a defended western gatehouse.",
      status: "locked"
    },
    {
      name: "Stone walls",
      metric: "buildProgress",
      target: 82,
      current: buildProgress,
      progress: Math.round((buildProgress / 82) * 100),
      hint: "Reach 82 build progress to replace timber defenses with stone walls.",
      status: "locked"
    }
  ];
  const alerts: KingdomAlert[] = [
    {
      code: "project-nearly-ready",
      severity: "good",
      title: "Stone workshop nearly ready",
      detail: "The builders are close to reinforcing the workshop if this focused streak holds."
    },
    {
      code: "rogue-pressure",
      severity: "danger",
      title: "Rogue pressure rising",
      detail: "A recent play streak has rogues active near the courtyard edge."
    }
  ];
  const districts: KingdomDistrict[] = [
    {
      id: "commons-green",
      name: "Commons Green",
      status: "strained",
      detail: "The market edge is noisy and rogues are stirring up extra foot traffic."
    },
    {
      id: "artisans-ward",
      name: "Artisans' Ward",
      status: "active",
      detail: "Builders are fully engaged inside the workshop yard."
    },
    {
      id: "chapel-rise",
      name: "Chapel Rise",
      status: "quiet",
      detail: "The shrine quarter is calm and helping morale recover."
    },
    {
      id: "watch-ridge",
      name: "Watch Ridge",
      status: "active",
      detail: "Lookouts have a clear line over the village approach."
    }
  ];

  return {
    updatedAt: now.toISOString(),
    buildProgress,
    order: 68,
    morale: 73,
    castleStageLabel: buildProgress < 22 ? "Founding keep" : buildProgress < 42 ? "Courtyard rising" : buildProgress < 62 ? "Island stronghold" : buildProgress < 82 ? "Moated citadel" : "Grand island castle",
    kingdomEffectTitle:
      pulse % 4 === 0 ? "Rogues Are Stirring" : pulse % 3 === 0 ? "The Ring Is Quiet" : "Builders Are In Charge",
    kingdomEffectBody:
      pulse % 4 === 0
        ? "Play sessions are inviting more mischief into the courtyard and slowing clean expansion a bit."
        : pulse % 3 === 0
          ? "Long pauses are drawing drifters into the village edge and lowering the kingdom's momentum."
          : "Focused work is speeding construction, strengthening order, and raising the next district faster.",
    kingdomEffectAccentClass:
      pulse % 4 === 0 ? "kingdom-effect--play" : pulse % 3 === 0 ? "kingdom-effect--idle" : "kingdom-effect--work",
    currentStreakCategory: pulse % 4 === 0 ? "play" : pulse % 3 === 0 ? "idle" : "work",
    currentStreakMinutes: pulse % 4 === 0 ? 12 : pulse % 3 === 0 ? 9 : 26,
    currentStreakLabel:
      pulse % 4 === 0
        ? "Steam Library"
        : pulse % 3 === 0
          ? "System Idle"
          : "Visual Studio Code",
    currentStreakTier: pulse % 4 === 0 ? "building" : pulse % 3 === 0 ? "building" : "surging",
    currentStreakSummary:
      pulse % 4 === 0
        ? "Play 12m in Steam Library"
        : pulse % 3 === 0
          ? "Idle 9m in System Idle"
          : "Work 26m in Visual Studio Code",
    currentStreakMomentumLabel: pulse % 4 === 0 ? "Building" : pulse % 3 === 0 ? "Building" : "Surging",
    worldFocus: {
      ...DEFAULT_WORLD_FOCUS,
      label: "Stone workshop",
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
      recommendedViewLabel: "Plan View",
      secondaryViewLabel: "Rampart View",
      viewStrategy: "Start in Plan View to find the ward cleanly, then switch to Rampart View if you want to feel the workshop inside the fortress massing.",
      storyline: "Anchor on Lower-left island ward, trace via Bridge into the ward, then inspect Stone workshop.",
      confirmationDetail: "Start in Plan View, then confirm in Rampart View. Start in Plan View to find the ward cleanly, then switch to Rampart View if you want to feel the workshop inside the fortress massing.",
      readingSteps: [
        {
          key: "anchor",
          title: "Anchor",
          label: "Lower-left island ward",
          detail: "Use the lower-left district pad inside the island as your anchor; the workshop rises just above it."
        },
        {
          key: "trace",
          title: "Trace",
          label: "Bridge into the ward",
          detail: "Trace inward from the nearest bridge before looking up into the workshop yard."
        },
        {
          key: "inspect",
          title: "Inspect",
          label: "Stone workshop",
          detail: "Plan view gives the clearest read on the workshop yard and build footprint."
        }
      ],
      detail: "The workshop is the main build heartbeat, so it should read as the current center of effort.",
      spotlight: "Plan view gives the clearest read on the workshop yard and build footprint.",
      note: "Focus on the artisans' ward inside the lower-left side of the island.",
      statusLabel: pulse % 4 === 0 ? "Attention drifting" : pulse % 3 === 0 ? "Holding pattern" : "Actively building",
      statusTone: pulse % 4 === 0 ? "warning" : pulse % 3 === 0 ? "warning" : "active",
      statusDetail:
        pulse % 4 === 0
          ? "The workshop is still the target, but playful activity is softening build momentum right now."
          : pulse % 3 === 0
            ? "The workshop yard is waiting on fresh activity before the next visible push."
            : "The workshop is the live build target and the current work streak is pushing it forward quickly.",
      recommendedView: "plan",
      left: "38%",
      top: "63%",
      worldPosition: [-1.48, 0.18, 1.16],
      color: "#e1cf8b"
    },
    worldAtmosphere:
      pulse % 4 === 0
        ? "A playful streak is warming the scene and making the kingdom feel less orderly."
        : pulse % 3 === 0
          ? "The kingdom is in a cooler quiet stretch, with slower movement around the ring."
          : "A strong work streak is making the build site feel bright, purposeful, and alive.",
    nextUnlock: "Stone workshop",
    nextUnlockProgress,
    nextUnlockHint: `Raise build progress to 68 to reinforce the workshop in stone (${buildProgress}/68).`,
    currentCategory: pulse % 4 === 0 ? "play" : pulse % 3 === 0 ? "idle" : "work",
    currentLabel:
      pulse % 4 === 0
        ? "A playful detour steals attention"
        : pulse % 3 === 0
          ? "The kingdom is taking a quiet pause"
          : "Focused building continues",
    currentAppName:
      pulse % 4 === 0 ? "Steam" : pulse % 3 === 0 ? "System Idle" : "Visual Studio Code",
    currentProcessName:
      pulse % 4 === 0 ? "steam" : pulse % 3 === 0 ? "idle" : "code",
    currentWindowTitle:
      pulse % 4 === 0
        ? "Steam Library"
        : pulse % 3 === 0
          ? ""
          : "tiny kingdom - Visual Studio Code",
    classificationSource: pulse % 4 === 0 ? "browser-bridge" : "default-work",
    classificationSourceLabel: pulse % 4 === 0 ? "Browser category" : "Default work rule",
    trackerReason:
      pulse % 4 === 0
        ? "Fresh browser context from store.steampowered.com is steering the current category."
        : "No explicit override was needed, so the tracker treated the current app as focused work.",
    activeOverrideSummary: "",
    activeRulePattern: pulse % 4 === 0 ? "store.steampowered.com" : "",
    activeRuleTargetType: pulse % 4 === 0 ? "domain" : "",
    activeRuleCategory: pulse % 4 === 0 ? "play" : "",
    currentIdleSeconds: pulse % 3 === 0 ? 420 : 18,
    trackingStatus: "fallback",
    trackingStatusLabel: "Desktop tracker fallback",
    trackingStatusDetail:
      "The app is still classifying activity, but it is relying on fallback observation instead of the primary live tracker.",
    quickRuleDomainTarget: pulse % 4 === 0 ? "store.steampowered.com" : "github.com",
    quickRuleAppTarget: pulse % 4 === 0 ? "steam" : pulse % 3 === 0 ? "system idle" : "code",
    currentBrowserDomain: pulse % 4 === 0 ? "store.steampowered.com" : "github.com",
    currentBrowserCategory: pulse % 4 === 0 ? "play" : "work",
    currentBrowserTitle: pulse % 4 === 0 ? "Steam Store" : "tiny kingdom repo - GitHub",
    lastBrowserEventAt: now.toISOString(),
    lastBrowserEventBrowser: "chrome",
    browserBridgeFresh: true,
    browserBridgeAgeSeconds: 0,
    browserBridgeLabel: "Live tab context",
    browserBridgeDetail: "Fresh 0s ago",
    browserBridgeToneClass: "status-badge--live",
    isPaused: false,
    activity: {
      workMinutes: 165,
      playMinutes: 70,
      idleMinutes: 55,
      unknownMinutes: 10,
      dominantCategory: "work"
    },
    citizens: [
      {
        id: "builder-1",
        type: "builder",
        name: "Mara",
        mood: "busy",
        x: -3.2,
        z: 2.6,
        districtId: "artisans-ward",
        task: "Framing the stone workshop"
      },
      {
        id: "builder-2",
        type: "builder",
        name: "Oren",
        mood: "steady",
        x: -2.5,
        z: 3.4,
        districtId: "artisans-ward",
        task: "Sorting timber and tools"
      },
      {
        id: "builder-3",
        type: "builder",
        name: "Pike",
        mood: "focused",
        x: 3.4,
        z: -2.4,
        districtId: "watch-ridge",
        task: "Reinforcing the lookout path"
      },
      {
        id: "drifter-1",
        type: "drifter",
        name: "Nell",
        mood: "wandering",
        x: 3.4,
        z: 2.9,
        districtId: "chapel-rise",
        task: "Lingering near the shrine lanterns"
      },
      {
        id: "rogue-1",
        type: "rogue",
        name: "Rusk",
        mood: "scheming",
        x: -4.2,
        z: -2.5,
        districtId: "commons-green",
        task: "Agitating the market edge"
      }
    ],
    eventLog: [
      "The first builders arrived after a productive morning.",
      "The harbor skiff started hauling supplies across the ponds."
    ],
    unlockedStructures: [
      "Timber keep",
      "Market stall",
      "Workshop frame",
      "Harbor skiff",
      "Farm plots",
      "Watch post"
    ],
    unlockRoadmap,
    alerts,
    districts,
    recentActivity: [
      {
        timestamp: now.toISOString(),
        timestampLabel: "Just now",
        category: pulse % 4 === 0 ? "play" : "work",
        categoryLabel: pulse % 4 === 0 ? "Play" : "Work",
        appName: pulse % 4 === 0 ? "Steam" : "Visual Studio Code",
        windowTitle: pulse % 4 === 0 ? "Steam Library" : "tiny kingdom - Visual Studio Code",
        browserDomain: pulse % 4 === 0 ? "store.steampowered.com" : "github.com",
        browserCategory: pulse % 4 === 0 ? "play" : "work",
        idleSeconds: pulse % 3 === 0 ? 420 : 18,
        label:
          pulse % 4 === 0
            ? "Browser category marked this as play"
            : "Focused work continues in the editor",
        source: pulse % 4 === 0 ? "browser-bridge" : "default-work",
        sourceLabel: pulse % 4 === 0 ? "Browser category" : "Default work rule",
        rulePattern: pulse % 4 === 0 ? "store.steampowered.com" : ""
      }
    ]
  };
}
