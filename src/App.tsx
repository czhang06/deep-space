import { FormEvent, Suspense, lazy, useEffect, useState } from "react";
import { useCastleStore } from "./store/useCastleStore";
import CitizenPanel from "./features/dashboard/CitizenPanel";
import RecentActivityPanel from "./features/dashboard/RecentActivityPanel";
import SimulationPanel from "./features/controls/SimulationPanel";
import { DEFAULT_WORLD_FOCUS, type ActivityCategory, type ClassificationRule } from "./types/models";

const CastleScene = lazy(() => import("./features/castle/CastleScene"));

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

function App() {
  const meta = useCastleStore((state) => state.meta);
  const snapshot = useCastleStore((state) => state.snapshot);
  const rules = useCastleStore((state) => state.rules);
  const isLoading = useCastleStore((state) => state.isLoading);
  const error = useCastleStore((state) => state.error);
  const addRule = useCastleStore((state) => state.addRule);
  const deleteRule = useCastleStore((state) => state.deleteRule);
  const refresh = useCastleStore((state) => state.refresh);
  const [targetType, setTargetType] = useState<"app" | "domain">("domain");
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("work");
  const [ruleFeedback, setRuleFeedback] = useState("");
  const [isSavingRule, setIsSavingRule] = useState(false);

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
  const nextProjectDetail =
    snapshot?.nextUnlockHint ?? "Builders are still surveying the next scene upgrade.";
  const nextUnlockProgress = snapshot?.nextUnlockProgress ?? 0;
  const projectFocus = snapshot?.worldFocus ?? DEFAULT_WORLD_FOCUS;
  const streakTone = snapshot?.currentStreakMomentumLabel ?? "Settling";
  const streakSummary = snapshot?.currentStreakSummary ?? "Unknown 0m in current context";

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Tiny Kingdom</p>
          <h1>Build a kingdom from your focus</h1>
          <p className="hero-copy">
            Your desktop activity now feeds a living castle scene: focused work raises
            towers, momentum lights the ward, and the surrounding village reacts as
            the day changes.
          </p>
        </div>

        <div className="hero-meta">
          <div className="meta-pill">{meta?.appName ?? "Tiny Kingdom"}</div>
          <div className="meta-pill">{meta?.trackingMode ?? "starting"}</div>
          <div className="meta-pill">{snapshot?.trackingStatusLabel ?? "Tracker starting"}</div>
          <div className="meta-pill">{meta?.ruleCount ?? rules.length} rules</div>
          <div className={`meta-pill ${snapshot?.browserBridgeToneClass ?? "status-badge--stale"}`}>
            {snapshot?.browserBridgeLabel ?? "Extension not connected"}
          </div>
          <div className="meta-pill">
            {snapshot?.updatedAt
              ? `Updated ${new Date(snapshot.updatedAt).toLocaleTimeString()}`
              : "Waiting for sync"}
          </div>
        </div>
      </section>

      <section className="content-grid single-column">
        <section className="panel kingdom-layout-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">World Layout</p>
              <h3>Central island build plan</h3>
            </div>
            <div className="progress-chip">{castleStage}</div>
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

          <p className="panel-note">
            The castle now follows your sketch direction: a keep growing across the
            central island, surrounded by a moat, with village expansion pushing out
            into the forest ring before the outer wall fills in.
          </p>

          <div className="layout-reading-grid">
            <article className="layout-reading-card">
              <span>Viewpoint</span>
              <strong>Southwest rampart corner</strong>
              <p>
                Rampart view looks into the stronghold from the wall corner, while
                Plan view is the cleaner read for orientation.
              </p>
            </article>
            <article className="layout-reading-card">
              <span>Layout</span>
              <strong>Keep, moat, far walls, outer village</strong>
              <p>
                The scene is organized as a central island castle with the north and
                east walls visible beyond it and village growth pressing into the ring.
              </p>
            </article>
            <article className="layout-reading-card">
              <span>Build focus</span>
              <strong>{snapshot?.nextUnlock ?? "Surveying next structure"}</strong>
              <p>{nextProjectDetail}</p>
            </article>
          </div>

          <article className="project-focus-card">
            <div className="project-focus-card__header">
              <div>
                <p className="eyebrow">Scene Focus</p>
                <h3>Where to look right now</h3>
              </div>
              <div className="project-focus-card__header-meta">
                <div className="progress-chip">{nextUnlockProgress}% ready</div>
                <div className={`project-focus-card__status project-focus-card__status--${projectFocus.statusTone}`}>{projectFocus.statusLabel}</div>
              </div>
            </div>
            <div className="project-focus-card__progress">
              <div className="project-focus-card__progress-track" aria-hidden="true">
                <span
                  className={`project-focus-card__progress-fill project-focus-card__progress-fill--${projectFocus.statusTone}`}
                  style={{ width: `${nextUnlockProgress}%` }}
                />
              </div>
              <p className="project-focus-card__status-detail">{projectFocus.statusDetail}</p>
            </div>
            <div className="project-focus-card__grid">
              <div className="project-focus-card__item">
                <span>Target area</span>
                <strong>{projectFocus.area}</strong>
              </div>
              <div className="project-focus-card__item">
                <span>Anchor landmark</span>
                <strong>{projectFocus.anchorLabel}</strong>
              </div>
              <div className="project-focus-card__item">
                <span>Start in</span>
                <strong>{projectFocus.recommendedViewLabel}</strong>
              </div>
              <div className="project-focus-card__item">
                <span>Why it matters</span>
                <strong>{projectFocus.detail}</strong>
              </div>
              <div className="project-focus-card__item">
                <span>Momentum</span>
                <strong>{streakTone} streak</strong>
              </div>
              <div className="project-focus-card__item">
                <span>Confirm in</span>
                <strong>{projectFocus.secondaryViewLabel}</strong>
              </div>
            </div>
            <p className="project-focus-card__storyline">{projectFocus.storyline}</p>
            <p className="project-focus-card__confirmation">{projectFocus.confirmationDetail}</p>
            <div className="project-focus-card__reading-strip">
              {projectFocus.readingSteps.map((step, index) => (
                <div className="project-focus-card__reading-step" key={step.key}>
                  <span>{index + 1}. {step.title}</span>
                  <strong>{step.label}</strong>
                  <p>{step.detail}</p>
                </div>
              ))}
            </div>
            <p className="project-focus-card__atmosphere">
              {snapshot?.worldAtmosphere ?? "The kingdom's broader atmosphere is still being interpreted."}
            </p>
          </article>

          <div className="metric-grid">
            <article className="metric-card">
              <span>Castle stage</span>
              <strong>{castleStage}</strong>
            </article>
            <article className="metric-card">
              <span>Forest expansion</span>
              <strong>{villageHouseCount} homes</strong>
            </article>
            <article className="metric-card">
              <span>Wall readiness</span>
              <strong>{wallTowerCount}/4 towers</strong>
            </article>
            <article className="metric-card">
              <span>Wild ring</span>
              <strong>{forestTreeCount} trees left</strong>
            </article>
            <article className="metric-card">
              <span>Builder crew</span>
              <strong>{builderCount} builders</strong>
            </article>
            <article className="metric-card">
              <span>Drifters nearby</span>
              <strong>{drifterCount} drifters</strong>
            </article>
            <article className="metric-card">
              <span>Castle trouble</span>
              <strong>{rogueCount} rogues</strong>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Activity Balance</p>
              <h3>How today is shaping the kingdom</h3>
            </div>
            <div className="progress-chip">
              {activity?.dominantCategory ?? "unknown"}
            </div>
          </div>

          <div className="stacked-bar">
            <span
              className="stacked-segment stacked-segment--work"
              style={{ width: `${totalTrackedMinutes > 0 ? (activity?.workMinutes ?? 0) / totalTrackedMinutes * 100 : 0}%` }}
            />
            <span
              className="stacked-segment stacked-segment--play"
              style={{ width: `${totalTrackedMinutes > 0 ? (activity?.playMinutes ?? 0) / totalTrackedMinutes * 100 : 0}%` }}
            />
            <span
              className="stacked-segment stacked-segment--idle"
              style={{ width: `${totalTrackedMinutes > 0 ? (activity?.idleMinutes ?? 0) / totalTrackedMinutes * 100 : 0}%` }}
            />
            <span
              className="stacked-segment stacked-segment--unknown"
              style={{ width: `${totalTrackedMinutes > 0 ? (activity?.unknownMinutes ?? 0) / totalTrackedMinutes * 100 : 0}%` }}
            />
          </div>

          <div className="metric-grid">
            <article className="metric-card">
              <span>Work time</span>
              <strong>{formatMinutes(activity?.workMinutes)}</strong>
            </article>
            <article className="metric-card">
              <span>Play time</span>
              <strong>{formatMinutes(activity?.playMinutes)}</strong>
            </article>
            <article className="metric-card">
              <span>Idle time</span>
              <strong>{formatMinutes(activity?.idleMinutes)}</strong>
            </article>
            <article className="metric-card">
              <span>Unsorted</span>
              <strong>{formatMinutes(activity?.unknownMinutes)}</strong>
            </article>
          </div>

          <p className="panel-note">
            Work grows the keep fastest, play invites rogues, and long idle stretches
            bring drifters into the ring around the castle.
          </p>
        </section>

        <CitizenPanel />

        <SimulationPanel />

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Current Activity</p>
              <h3>Live state</h3>
            </div>
            <div className="progress-chip">
              Build {snapshot?.buildProgress ?? 0}%
            </div>
          </div>

          <div className="status-list">
            <div className="status-row">
              <span>Foreground app</span>
              <strong>{snapshot?.currentAppName ?? "Waiting"}</strong>
            </div>
            <div className="status-row">
              <span>Process name</span>
              <strong>{snapshot?.currentProcessName || "No active process"}</strong>
            </div>
            <div className="status-row">
              <span>Window title</span>
              <strong>{snapshot?.currentWindowTitle || "No active title"}</strong>
            </div>
            <div className="status-row">
              <span>Browser domain</span>
              <strong>{snapshot?.currentBrowserDomain || "No browser context"}</strong>
            </div>
            <div className="status-row">
              <span>Tracker state</span>
              <strong>{snapshot?.trackingStatusLabel ?? "Tracker starting"}</strong>
            </div>
            <div className="status-row">
              <span>Tracker detail</span>
              <strong>{snapshot?.trackingStatusDetail ?? "Waiting for the desktop tracker to report its first stable observation."}</strong>
            </div>
            <div className="status-row">
              <span>Browser bridge</span>
              <strong className={`status-badge ${snapshot?.browserBridgeToneClass ?? "status-badge--stale"}`}>
                {snapshot?.browserBridgeLabel ?? "Extension not connected"}
              </strong>
            </div>
            <div className="status-row">
              <span>Bridge freshness</span>
              <strong>{snapshot?.browserBridgeDetail ?? "No browser events yet"}</strong>
            </div>
            <div className="status-row">
              <span>Last browser event</span>
              <strong>
                {snapshot?.lastBrowserEventAt
                  ? `${new Date(snapshot.lastBrowserEventAt).toLocaleTimeString()} via ${snapshot.lastBrowserEventBrowser || "browser"}`
                  : "No browser events yet"}
              </strong>
            </div>
            <div className="status-row">
              <span>Browser category</span>
              <strong>{snapshot?.currentBrowserCategory ?? "unknown"}</strong>
            </div>
            <div className="status-row">
              <span>Current label</span>
              <strong>{snapshot?.currentLabel ?? "Preparing tracker"}</strong>
            </div>
            <div className="status-row">
              <span>Current streak</span>
              <strong>{streakSummary}</strong>
            </div>
            <div className="status-row">
              <span>Streak momentum</span>
              <strong>{streakTone}</strong>
            </div>
            <div className="status-row">
              <span>Classification source</span>
              <strong>{snapshot?.classificationSourceLabel ?? "Waiting for data"}</strong>
            </div>
            <div className="status-row">
              <span>Idle seconds</span>
              <strong>{snapshot?.currentIdleSeconds ?? 0}</strong>
            </div>
          </div>

          <article className={`kingdom-effect ${snapshot?.kingdomEffectAccentClass ?? "kingdom-effect--unknown"}`}>
            <p className="eyebrow">Kingdom Effect</p>
            <h4>{snapshot?.kingdomEffectTitle ?? "The Kingdom Is Watching"}</h4>
            <p>{snapshot?.kingdomEffectBody ?? "Current activity is still being interpreted before it meaningfully shifts the kingdom."}</p>
          </article>

          <article className="tracker-reason-card">
            <p className="eyebrow">Tracker Reasoning</p>
            <strong>{snapshot?.classificationSourceLabel ?? "Waiting for data"}</strong>
            <p>{trackerReason}</p>
          </article>

          {isLoading ? <p className="notice">Loading snapshot...</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {ruleFeedback ? <p className="success-text">{ruleFeedback}</p> : null}
          {activeOverride ? <p className="success-text">Active override: {activeOverride}</p> : null}

          <div className="quick-actions">
            <p className="panel-note">Quick classify what you are doing right now.</p>

            {quickDomain ? (
              <div className="quick-action-row">
                <span>Current domain: {quickDomain}</span>
                <div className="quick-action-buttons">
                  <button
                    className="secondary-button"
                    disabled={isSavingRule}
                    onClick={() => {
                      void handleQuickAddRule("domain", quickDomain, "work");
                    }}
                    type="button"
                  >
                    Domain = Work
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isSavingRule}
                    onClick={() => {
                      void handleQuickAddRule("domain", quickDomain, "play");
                    }}
                    type="button"
                  >
                    Domain = Play
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isSavingRule}
                    onClick={() => {
                      void handleQuickAddRule("domain", quickDomain, "unknown");
                    }}
                    type="button"
                  >
                    Domain = Neutral
                  </button>
                </div>
              </div>
            ) : null}

            {quickApp ? (
              <div className="quick-action-row">
                <span>Current app rule: {quickApp}</span>
                <div className="quick-action-buttons">
                  <button
                    className="secondary-button"
                    disabled={isSavingRule}
                    onClick={() => {
                      void handleQuickAddRule("app", quickApp, "work");
                    }}
                    type="button"
                  >
                    App = Work
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isSavingRule}
                    onClick={() => {
                      void handleQuickAddRule("app", quickApp, "play");
                    }}
                    type="button"
                  >
                    App = Play
                  </button>
                  <button
                    className="secondary-button"
                    disabled={isSavingRule}
                    onClick={() => {
                      void handleQuickAddRule("app", quickApp, "unknown");
                    }}
                    type="button"
                  >
                    App = Neutral
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Kingdom Stats</p>
              <h3>Simulation snapshot</h3>
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-card">
              <span>Order</span>
              <strong>{snapshot?.order ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Morale</span>
              <strong>{snapshot?.morale ?? 0}</strong>
            </article>
            <article className="metric-card">
              <span>Next unlock</span>
              <strong>{snapshot?.nextUnlock ?? "Waiting"}</strong>
            </article>
            <article className="metric-card">
              <span>Refresh cycle</span>
              <strong>{meta?.cycleSeconds ?? 4}s</strong>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Kingdom Projects</p>
              <h3>What the builders are chasing next</h3>
            </div>
            <div className="progress-chip">{snapshot?.nextUnlock ?? "Waiting"}</div>
          </div>

          <div className="project-progress">
            <div
              className="project-progress__fill"
              style={{ width: `${snapshot?.nextUnlockProgress ?? 0}%` }}
            />
          </div>

          <div className="status-list">
            <div className="status-row">
              <span>Next unlock</span>
              <strong>{snapshot?.nextUnlock ?? "Waiting"}</strong>
            </div>
            <div className="status-row">
              <span>Progress</span>
              <strong>{snapshot?.nextUnlockProgress ?? 0}%</strong>
            </div>
          </div>

          <p className="panel-note">
            {snapshot?.nextUnlockHint ?? "Kingdom projects are still being calculated."}
          </p>

          <div className="project-chip-list">
            {(snapshot?.unlockedStructures ?? []).map((structure) => (
              <span className="project-chip" key={structure}>
                {structure}
              </span>
            ))}
          </div>

          <p className="panel-note">
            Unlocks now drive real world presentation, so new projects appear in the scene as the tracker earns them.
          </p>

          <div className="roadmap-list">
            {(snapshot?.unlockRoadmap ?? []).map((item) => (
              <article
                className={`roadmap-card roadmap-card--${item.status}`}
                key={`${item.name}-${toSlug(item.status)}`}
              >
                <div className="roadmap-card__header">
                  <strong>{item.name}</strong>
                  <span>{item.metric === "order" ? "Order" : "Build"}</span>
                </div>
                <div className="project-progress">
                  <div
                    className="project-progress__fill"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <div className="roadmap-card__meta">
                  <span>{item.status}</span>
                  <span>{item.current}/{item.target}</span>
                </div>
                <p className="panel-note">{item.hint}</p>
              </article>
            ))}
          </div>
        </section>

        <RecentActivityPanel />

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Recent Events</p>
              <h3>Tracker output</h3>
            </div>
          </div>

          <div className="event-list">
            {(snapshot?.eventLog ?? []).length === 0 ? (
              <article className="event-card">Waiting for events.</article>
            ) : (
              snapshot?.eventLog.map((entry) => (
                <article className="event-card" key={entry}>
                  {entry}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Classification Rules</p>
              <h3>Manual overrides</h3>
            </div>
          </div>

          <form className="rules-form" onSubmit={handleAddRule}>
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
              <select value={category} onChange={(event) => setCategory(event.target.value as "work" | "play" | "idle" | "unknown")}>
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

          <div className="rules-list">
            {rules.length === 0 ? (
              <article className="event-card">No manual rules yet.</article>
            ) : (
              rules.map((rule) => (
                <article className="rule-row" key={rule.id}>
                  <div>
                    <strong>{rule.pattern}</strong>
                    <p>
                      {rule.targetType} {"->"} {rule.category}
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      void handleDeleteRule(rule.id);
                    }}
                    type="button"
                  >
                    Delete
                  </button>
                </article>
              ))
            )}
          </div>

          <p className="panel-note">
            Domain rules override browser defaults. App rules match process name,
            app name, or active window title.
          </p>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Browser Setup</p>
              <h3>Extension reminder</h3>
            </div>
          </div>

          <p className="panel-note">
            Browser domain tracking only works when the unpacked extension in
            <strong> extension/chrome </strong>
            is installed and enabled in Chrome.
          </p>

          <p className="panel-note">
            If the browser field looks stale, reload the extension in
            <strong> chrome://extensions </strong>
            and make the tab active once.
          </p>
        </section>
      </section>
    </main>
  );
}

export default App;
