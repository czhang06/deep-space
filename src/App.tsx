import { FormEvent, Suspense, lazy, useEffect, useRef, useState } from "react";
import { useCastleStore } from "./store/useCastleStore";
import { DEFAULT_WORLD_FOCUS, type ActivityCategory, type ClassificationRule } from "./types/models";

const CastleScene = lazy(() => import("./features/castle/CastleScene"));

type ActiveDrawerPanel =
  | "activity"
  | "citizens"
  | "projects"
  | "rules"
  | "tracker"
  | "events"
  | "setup"
  | "simulation"
  | null;

const drawerPanels: Array<{ id: Exclude<ActiveDrawerPanel, null>; label: string; eyebrow: string }> = [
  { id: "activity", label: "Activity", eyebrow: "Balance" },
  { id: "citizens", label: "Citizens", eyebrow: "Districts" },
  { id: "projects", label: "Projects", eyebrow: "Build" },
  { id: "rules", label: "Rules", eyebrow: "Classify" },
  { id: "tracker", label: "Tracker", eyebrow: "Live" },
  { id: "events", label: "Events", eyebrow: "History" },
  { id: "setup", label: "Setup", eyebrow: "Bridge" },
  { id: "simulation", label: "Loop", eyebrow: "Control" }
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatMinutes(minutes: number | undefined) {
  const rounded = Math.max(0, Math.round(minutes ?? 0));

  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  return `${rounded}m`;
}

function prettifyCategory(category: ActivityCategory | undefined) {
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

function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function FieldRow({
  label,
  value,
  className = ""
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`cockpit-field-row ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function App() {
  const meta = useCastleStore((state) => state.meta);
  const snapshot = useCastleStore((state) => state.snapshot);
  const rules = useCastleStore((state) => state.rules);
  const isLoading = useCastleStore((state) => state.isLoading);
  const error = useCastleStore((state) => state.error);
  const addRule = useCastleStore((state) => state.addRule);
  const deleteRule = useCastleStore((state) => state.deleteRule);
  const refresh = useCastleStore((state) => state.refresh);
  const pauseSimulation = useCastleStore((state) => state.pauseSimulation);
  const resumeSimulation = useCastleStore((state) => state.resumeSimulation);
  const [targetType, setTargetType] = useState<"app" | "domain">("domain");
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("work");
  const [ruleFeedback, setRuleFeedback] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [activePanel, setActivePanel] = useState<ActiveDrawerPanel>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const activeOpenerRef = useRef<HTMLButtonElement | null>(null);
  const commandRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    void useCastleStore.getState().hydrate();

    const timer = window.setInterval(() => {
      void useCastleStore.getState().refresh();
    }, 10000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!ruleFeedback) {
      return;
    }

    const timer = window.setTimeout(() => {
      setRuleFeedback("");
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ruleFeedback]);

  useEffect(() => {
    if (!activePanel) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.setTimeout(() => {
      drawerRef.current
        ?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
        ?.focus();
    }, 0);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePanel]);

  const handleAddRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextPattern = pattern.trim().toLowerCase();

    if (!nextPattern) {
      return;
    }

    setIsSavingRule(true);

    try {
      await addRule({
        targetType,
        pattern: nextPattern,
        category
      });
      setPattern("");
      setRuleFeedback(`Saved ${targetType} rule: ${nextPattern} -> ${category}`);
      await refresh();
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleQuickAddRule = async (
    nextTargetType: ClassificationRule["targetType"],
    nextPattern: string,
    nextCategory: ActivityCategory
  ) => {
    const normalizedPattern = nextPattern.trim().toLowerCase();

    if (!normalizedPattern) {
      return;
    }

    setIsSavingRule(true);

    try {
      await addRule({
        targetType: nextTargetType,
        pattern: normalizedPattern,
        category: nextCategory
      });
      setTargetType(nextTargetType);
      setPattern(normalizedPattern);
      setCategory(nextCategory);
      setRuleFeedback(`Saved ${nextTargetType} rule: ${normalizedPattern} -> ${nextCategory}`);
      await refresh();
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    await deleteRule(id);
    await refresh();
  };

  const handlePauseToggle = async () => {
    if (snapshot?.isPaused) {
      await resumeSimulation();
      return;
    }

    await pauseSimulation();
  };

  const openDrawer = (panel: Exclude<ActiveDrawerPanel, null>) => {
    activeOpenerRef.current = commandRefs.current[panel];
    setActivePanel(panel);
  };

  const closeDrawer = () => {
    const opener = activeOpenerRef.current;
    setActivePanel(null);
    window.setTimeout(() => {
      opener?.focus();
    }, 0);
  };

  const quickDomain = snapshot?.quickRuleDomainTarget ?? "";
  const quickApp = snapshot?.quickRuleAppTarget ?? "";
  const activeOverride = snapshot?.activeOverrideSummary ?? "";
  const trackerReason =
    snapshot?.trackerReason ?? "The tracker is still building enough context to explain this state cleanly.";
  const buildProgress = snapshot?.buildProgress ?? 18;
  const order = snapshot?.order ?? 58;
  const activity = snapshot?.activity;
  const totalTrackedMinutes =
    (activity?.workMinutes ?? 0) +
    (activity?.playMinutes ?? 0) +
    (activity?.idleMinutes ?? 0) +
    (activity?.unknownMinutes ?? 0);
  const keepScale = clamp(buildProgress, 20, 92);
  const citizens = snapshot?.citizens ?? [];
  const builderCount = citizens.filter((citizen) => citizen.type === "builder").length;
  const drifterCount = citizens.filter((citizen) => citizen.type === "drifter").length;
  const rogueCount = citizens.filter((citizen) => citizen.type === "rogue").length;
  const islandDistrictCount = clamp(1 + Math.floor(buildProgress / 22), 1, 4);
  const villageHouseCount = clamp(1 + Math.floor(buildProgress / 18) + Math.floor(builderCount / 2), 1, 6);
  const forestTreeCount = clamp(11 - villageHouseCount + drifterCount, 5, 12);
  const wallTowerCount = clamp(1 + Math.floor(order / 30), 1, 4);
  const castleStage = snapshot?.castleStageLabel ?? "Founding keep";
  const nextUnlockProgress = snapshot?.nextUnlockProgress ?? 0;
  const projectFocus = snapshot?.worldFocus ?? DEFAULT_WORLD_FOCUS;
  const streakTone = snapshot?.currentStreakMomentumLabel ?? "Settling";
  const streakSummary = snapshot?.currentStreakSummary ?? "Unknown 0m in current context";
  const drawerTitle = drawerPanels.find((panel) => panel.id === activePanel)?.label ?? "Details";
  const activitySlices = [
    { label: "Work", value: activity?.workMinutes ?? 0, tone: "work" },
    { label: "Play", value: activity?.playMinutes ?? 0, tone: "play" },
    { label: "Idle", value: activity?.idleMinutes ?? 0, tone: "idle" },
    { label: "Unknown", value: activity?.unknownMinutes ?? 0, tone: "unknown" }
  ];

  const renderDrawerContent = () => {
    if (activePanel === "activity") {
      return (
        <>
          <div className="stacked-bar" aria-label="Activity balance">
            {activitySlices.map((slice) => (
              <span
                className={`stacked-segment stacked-segment--${slice.tone}`}
                key={slice.label}
                style={{ width: `${totalTrackedMinutes > 0 ? (slice.value / totalTrackedMinutes) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className="cockpit-drawer-grid">
            {activitySlices.map((slice) => (
              <article className="metric-card" key={slice.label}>
                <span>{slice.label}</span>
                <strong>{formatMinutes(slice.value)}</strong>
              </article>
            ))}
          </div>
          <p className="panel-note">
            Work grows the keep fastest, play invites rogues, and idle stretches bring drifters into the ring.
          </p>
        </>
      );
    }

    if (activePanel === "citizens") {
      return (
        <>
          <div className="cockpit-drawer-grid">
            <article className="metric-card">
              <span>Builders</span>
              <strong>{builderCount}</strong>
            </article>
            <article className="metric-card">
              <span>Drifters</span>
              <strong>{drifterCount}</strong>
            </article>
            <article className="metric-card">
              <span>Rogues</span>
              <strong>{rogueCount}</strong>
            </article>
            <article className="metric-card">
              <span>Morale</span>
              <strong>{snapshot?.morale ?? 0}</strong>
            </article>
          </div>
          <div className="district-list">
            {(snapshot?.districts ?? []).map((district) => (
              <article className={`district-card district-card--${district.status}`} key={district.id}>
                <div className="district-card__header">
                  <strong>{district.name}</strong>
                  <span>{district.status}</span>
                </div>
                <p>{district.detail}</p>
              </article>
            ))}
          </div>
          <div className="citizen-duty-list">
            {citizens.map((citizen) => (
              <article className="citizen-duty-card" key={citizen.id}>
                <div className="citizen-duty-card__header">
                  <span className={`citizen-swatch citizen-swatch--${citizen.type}`} />
                  <strong>{citizen.name}</strong>
                  <span>{citizen.type}</span>
                </div>
                <p>{citizen.task}</p>
                <div className="citizen-duty-card__meta">
                  <span>{citizen.districtId}</span>
                  <span>{citizen.mood}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      );
    }

    if (activePanel === "projects") {
      return (
        <>
          <div className="project-progress">
            <div className="project-progress__fill" style={{ width: `${nextUnlockProgress}%` }} />
          </div>
          <FieldRow label="Next unlock" value={snapshot?.nextUnlock ?? "Waiting"} />
          <FieldRow label="Progress" value={`${nextUnlockProgress}%`} />
          <p className="panel-note">{snapshot?.nextUnlockHint ?? "Kingdom projects are still being calculated."}</p>
          <div className="project-chip-list">
            {(snapshot?.unlockedStructures ?? []).map((structure) => (
              <span className="project-chip" key={structure}>
                {structure}
              </span>
            ))}
          </div>
          <div className="roadmap-list">
            {(snapshot?.unlockRoadmap ?? []).map((item) => (
              <article className={`roadmap-card roadmap-card--${item.status}`} key={`${item.name}-${toSlug(item.status)}`}>
                <div className="roadmap-card__header">
                  <strong>{item.name}</strong>
                  <span>{item.metric === "order" ? "Order" : "Build"}</span>
                </div>
                <div className="project-progress">
                  <div className="project-progress__fill" style={{ width: `${item.progress}%` }} />
                </div>
                <div className="roadmap-card__meta">
                  <span>{item.status}</span>
                  <span>{item.current}/{item.target}</span>
                </div>
                <p className="panel-note">{item.hint}</p>
              </article>
            ))}
          </div>
        </>
      );
    }

    if (activePanel === "rules") {
      return (
        <>
          {ruleFeedback ? <p className="success-text">{ruleFeedback}</p> : null}
          {activeOverride ? <p className="success-text">Active override: {activeOverride}</p> : null}
          <form className="rules-form cockpit-rules-form" onSubmit={handleAddRule}>
            <label className="rules-field">
              <span>Match type</span>
              <select value={targetType} onChange={(event) => setTargetType(event.target.value as "app" | "domain")}>
                <option value="domain">Domain</option>
                <option value="app">App</option>
              </select>
            </label>
            <label className="rules-field rules-field--wide">
              <span>Pattern</span>
              <input
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                placeholder={targetType === "domain" ? "youtube.com" : "discord"}
              />
            </label>
            <label className="rules-field">
              <span>Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as ActivityCategory)}>
                <option value="work">Work</option>
                <option value="play">Play</option>
                <option value="idle">Idle</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <button className="primary-button" disabled={isSavingRule} type="submit">
              {isSavingRule ? "Saving..." : "Save rule"}
            </button>
          </form>
          <div className="quick-actions">
            {quickDomain ? (
              <div className="quick-action-row">
                <span>Current domain: {quickDomain}</span>
                <div className="quick-action-buttons">
                  <button className="secondary-button" disabled={isSavingRule} onClick={() => void handleQuickAddRule("domain", quickDomain, "work")} type="button">Work</button>
                  <button className="secondary-button" disabled={isSavingRule} onClick={() => void handleQuickAddRule("domain", quickDomain, "play")} type="button">Play</button>
                  <button className="secondary-button" disabled={isSavingRule} onClick={() => void handleQuickAddRule("domain", quickDomain, "unknown")} type="button">Neutral</button>
                </div>
              </div>
            ) : null}
            {quickApp ? (
              <div className="quick-action-row">
                <span>Current app: {quickApp}</span>
                <div className="quick-action-buttons">
                  <button className="secondary-button" disabled={isSavingRule} onClick={() => void handleQuickAddRule("app", quickApp, "work")} type="button">Work</button>
                  <button className="secondary-button" disabled={isSavingRule} onClick={() => void handleQuickAddRule("app", quickApp, "play")} type="button">Play</button>
                  <button className="secondary-button" disabled={isSavingRule} onClick={() => void handleQuickAddRule("app", quickApp, "unknown")} type="button">Neutral</button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="rules-list">
            {rules.length === 0 ? (
              <article className="event-card">No manual rules yet.</article>
            ) : (
              rules.map((rule) => (
                <article className="rule-row" key={rule.id}>
                  <div>
                    <strong>{rule.pattern}</strong>
                    <p>{rule.targetType} {"->"} {rule.category}</p>
                  </div>
                  <button className="secondary-button" onClick={() => void handleDeleteRule(rule.id)} type="button">
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>
        </>
      );
    }

    if (activePanel === "tracker") {
      return (
        <>
          <FieldRow label="Foreground app" value={snapshot?.currentAppName ?? "Waiting"} />
          <FieldRow label="Process name" value={snapshot?.currentProcessName || "No active process"} />
          <FieldRow label="Window title" value={snapshot?.currentWindowTitle || "No active title"} />
          <FieldRow label="Browser domain" value={snapshot?.currentBrowserDomain || "No browser context"} />
          <FieldRow label="Browser category" value={snapshot?.currentBrowserCategory ?? "unknown"} />
          <FieldRow label="Current streak" value={streakSummary} />
          <FieldRow label="Classification source" value={snapshot?.classificationSourceLabel ?? "Waiting for data"} />
          <FieldRow label="Idle seconds" value={snapshot?.currentIdleSeconds ?? 0} />
          <article className="tracker-reason-card">
            <p className="eyebrow">Tracker Reasoning</p>
            <strong>{snapshot?.classificationSourceLabel ?? "Waiting for data"}</strong>
            <p>{trackerReason}</p>
          </article>
          {isLoading ? <p className="notice">Loading snapshot...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </>
      );
    }

    if (activePanel === "events") {
      return (
        <>
          <div className="recent-activity-list">
            {(snapshot?.recentActivity ?? []).length === 0 ? (
              <article className="event-card">Waiting for tracked activity.</article>
            ) : (
              (snapshot?.recentActivity ?? []).slice(0, 6).map((entry) => (
                <article className="recent-activity-card" key={`${entry.timestamp}-${entry.appName}`}>
                  <div className="recent-activity-card__header">
                    <strong>{entry.appName}</strong>
                    <span>{entry.timestampLabel ?? "Unknown time"}</span>
                  </div>
                  <p>{entry.windowTitle || "No active window title recorded."}</p>
                  {entry.label ? <p className="recent-activity-card__reason">{entry.label}</p> : null}
                  <div className="recent-activity-card__meta">
                    <span>{entry.categoryLabel ?? entry.category}</span>
                    {entry.browserDomain ? <span>{entry.browserDomain}</span> : null}
                    <span>{entry.sourceLabel ?? "Waiting for data"}</span>
                    <span>Idle {entry.idleSeconds}s</span>
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="event-list">
            {(snapshot?.eventLog ?? []).length === 0 ? (
              <article className="event-card">Waiting for kingdom events.</article>
            ) : (
              snapshot?.eventLog.map((entry) => (
                <article className="event-card" key={entry}>
                  {entry}
                </article>
              ))
            )}
          </div>
        </>
      );
    }

    if (activePanel === "setup") {
      return (
        <>
          <FieldRow label="Browser bridge" value={snapshot?.browserBridgeLabel ?? "Extension not connected"} />
          <FieldRow label="Bridge freshness" value={snapshot?.browserBridgeDetail ?? "No browser events yet"} />
          <FieldRow
            label="Last browser event"
            value={
              snapshot?.lastBrowserEventAt
                ? `${new Date(snapshot.lastBrowserEventAt).toLocaleTimeString()} via ${snapshot.lastBrowserEventBrowser || "browser"}`
                : "No browser events yet"
            }
          />
          <p className="panel-note">
            Browser domain tracking only works when the unpacked extension in <strong>extension/chrome</strong> is installed and enabled in Chrome.
          </p>
          <p className="panel-note">
            If the browser field looks stale, reload the extension in <strong>chrome://extensions</strong> and make the tab active once.
          </p>
        </>
      );
    }

    if (activePanel === "simulation") {
      return (
        <>
          <FieldRow label="Loop state" value={snapshot?.isPaused ? "Paused" : "Running"} />
          <FieldRow label="Simulation tick" value={`Every ${meta?.cycleSeconds ?? 4}s`} />
          <FieldRow label="Tracker state" value={snapshot?.trackingStatusLabel ?? "Tracker starting"} />
          <FieldRow label="Tracker detail" value={snapshot?.trackingStatusDetail ?? "Waiting for the desktop tracker."} />
          <FieldRow label="Next project" value={snapshot?.nextUnlock ?? "Waiting"} />
          <FieldRow label="Project progress" value={`${nextUnlockProgress}%`} />
          <button className="primary-button" onClick={() => void handlePauseToggle()} type="button">
            {snapshot?.isPaused ? "Resume simulation" : "Pause simulation"}
          </button>
          <div className="alert-list">
            {(snapshot?.alerts ?? []).length === 0 ? (
              <article className="alert-card alert-card--good">
                <strong>Kingdom stable</strong>
                <p>No urgent advisories at the moment.</p>
              </article>
            ) : (
              snapshot?.alerts.map((alert) => (
                <article className={`alert-card alert-card--${alert.severity}`} key={alert.code}>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </article>
              ))
            )}
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <main className="app-shell cockpit-shell">
      <section className="cockpit-stage" aria-label="Tiny Kingdom cockpit">
        <header className="cockpit-topbar">
          <div>
            <p className="eyebrow">Tiny Kingdom</p>
            <h1>Build a kingdom from your focus</h1>
          </div>
          <div className="cockpit-topbar__status" aria-label="Current tracker summary">
            <span>{meta?.appName ?? "Tiny Kingdom"}</span>
            <span>{meta?.trackingMode ?? "starting"}</span>
            <span className={snapshot?.browserBridgeToneClass ?? "status-badge--stale"}>
              {snapshot?.browserBridgeLabel ?? "Extension not connected"}
            </span>
            <span>{snapshot?.updatedAt ? `Updated ${new Date(snapshot.updatedAt).toLocaleTimeString()}` : "Waiting for sync"}</span>
          </div>
        </header>

        <div className="cockpit-main">
          <aside className="cockpit-rail" aria-label="Open detail drawer">
            {drawerPanels.map((panel) => (
              <button
                aria-controls="cockpit-detail-drawer"
                aria-expanded={activePanel === panel.id}
                className={`cockpit-rail-button ${activePanel === panel.id ? "is-active" : ""}`}
                key={panel.id}
                onClick={() => openDrawer(panel.id)}
                ref={(node) => {
                  commandRefs.current[panel.id] = node;
                }}
                type="button"
              >
                <span>{panel.eyebrow}</span>
                <strong>{panel.label}</strong>
              </button>
            ))}
          </aside>

          <section className="cockpit-scene-panel">
            <div className="cockpit-scene-header">
              <div>
                <p className="eyebrow">World Scene</p>
                <h2>{castleStage}</h2>
              </div>
              <div className="cockpit-scene-header__actions">
                <button className="secondary-button" onClick={() => openDrawer("projects")} type="button">
                  Next: {snapshot?.nextUnlock ?? "Surveying"}
                </button>
                <button className="primary-button" onClick={() => void handlePauseToggle()} type="button">
                  {snapshot?.isPaused ? "Resume" : "Pause"}
                </button>
              </div>
            </div>

            <Suspense
              fallback={
                <div className="castle-canvas-frame castle-loading-frame">
                  <p className="eyebrow">Loading Kingdom View</p>
                  <strong>{castleStage}</strong>
                  <span>Preparing the 3D island scene...</span>
                </div>
              }
            >
              <CastleScene
                snapshot={snapshot}
                stageLabel={castleStage}
                keepScale={keepScale}
                islandDistrictCount={islandDistrictCount}
                villageHouseCount={villageHouseCount}
                wallTowerCount={wallTowerCount}
                forestTreeCount={forestTreeCount}
              />
            </Suspense>
          </section>

          <aside className="cockpit-glance-panel" aria-label="Kingdom at a glance">
            <article className={`cockpit-effect-card ${snapshot?.kingdomEffectAccentClass ?? "kingdom-effect--unknown"}`}>
              <p className="eyebrow">Kingdom Effect</p>
              <h3>{snapshot?.kingdomEffectTitle ?? "The Kingdom Is Watching"}</h3>
              <p>{snapshot?.kingdomEffectBody ?? "Current activity is still being interpreted before it meaningfully shifts the kingdom."}</p>
            </article>

            <div className="cockpit-glance-grid">
              <FieldRow label="Mode" value={prettifyCategory(snapshot?.currentCategory)} />
              <FieldRow label="Tracker" value={snapshot?.trackingStatusLabel ?? "Starting"} />
              <FieldRow label="Build" value={`${buildProgress}%`} />
              <FieldRow label="Order" value={order} />
              <FieldRow label="Next unlock" value={snapshot?.nextUnlock ?? "Waiting"} />
              <FieldRow label="Streak" value={streakTone} />
            </div>

            <div className="cockpit-balance-card">
              <div className="cockpit-balance-card__header">
                <span>Today</span>
                <strong>{activity?.dominantCategory ?? "unknown"}</strong>
              </div>
              <div className="stacked-bar" aria-hidden="true">
                {activitySlices.map((slice) => (
                  <span
                    className={`stacked-segment stacked-segment--${slice.tone}`}
                    key={slice.label}
                    style={{ width: `${totalTrackedMinutes > 0 ? (slice.value / totalTrackedMinutes) * 100 : 0}%` }}
                  />
                ))}
              </div>
              <div className="cockpit-mini-metrics">
                <span>Work {formatMinutes(activity?.workMinutes)}</span>
                <span>Play {formatMinutes(activity?.playMinutes)}</span>
                <span>Idle {formatMinutes(activity?.idleMinutes)}</span>
              </div>
            </div>

            <article className="cockpit-focus-card">
              <p className="eyebrow">Scene Focus</p>
              <h3>{projectFocus.label}</h3>
              <p>{projectFocus.spotlight}</p>
              <div className="project-progress">
                <div className={`project-progress__fill project-focus-card__progress-fill--${projectFocus.statusTone}`} style={{ width: `${nextUnlockProgress}%` }} />
              </div>
              <span>{projectFocus.statusLabel} · {nextUnlockProgress}%</span>
            </article>
          </aside>
        </div>
      </section>

      <div className={`cockpit-drawer-backdrop ${activePanel ? "is-open" : ""}`} aria-hidden={!activePanel} onClick={closeDrawer} />
      {activePanel ? (
        <aside
          aria-labelledby="cockpit-drawer-title"
          aria-modal="true"
          className="cockpit-drawer is-open"
          id="cockpit-detail-drawer"
          ref={drawerRef}
          role="dialog"
        >
          <div className="cockpit-drawer__header">
            <div>
              <p className="eyebrow">Detail Drawer</p>
              <h2 id="cockpit-drawer-title">{drawerTitle}</h2>
            </div>
            <button className="secondary-button" onClick={closeDrawer} type="button">
              Close
            </button>
          </div>
          <div className="cockpit-drawer__body">
            {renderDrawerContent()}
          </div>
        </aside>
      ) : null}
    </main>
  );
}

export default App;
