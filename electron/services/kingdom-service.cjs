const { EventEmitter } = require("node:events");
const { classify, statLabel } = require("./classifier.cjs");
const { ForegroundWatcher } = require("./foreground-watcher.cjs");
const sim = require("./sim.cjs");
const { Store } = require("./store.cjs");

const TICK_MS = 5000;
const MAX_SLICE_MINUTES = 15 / 60; // sleep/hibernate gaps never count as time
const IDLE_AFTER_SECONDS = 5 * 60;
const SWITCH_AFTER_SECONDS = 60; // a new category must hold this long before it counts
const SAVE_EVERY_MS = 30000;
const OWN_PROCESSES = new Set(["electron", "deep space", "tiny kingdom"]);

/**
 * Ties the pieces together: samples the foreground app and idle time, smooths quick
 * alt-tabs, feeds the simulation, saves, and emits "snapshot" for the windows and tray.
 */
class KingdomService extends EventEmitter {
  /**
   * @param {{ dataDir: string, getIdleSeconds: () => number }} options
   */
  constructor({ dataDir, getIdleSeconds }) {
    super();
    this.store = new Store(dataDir);
    this.store.removeLegacyData(dataDir);
    const saved = sim.reviveState(this.store.load());
    this.state = saved ?? sim.createState();
    if (!saved) {
      sim.pushEvent(this.state, "A new station came online. Focused work will grow it.", Date.now());
    }
    this.getIdleSeconds = getIdleSeconds;
    this.watcher = new ForegroundWatcher();
    this.locked = false;
    this.timer = null;
    this.lastTickAt = Date.now();
    this.lastSaveAt = 0;
    this.lastSample = null;
    this.raw = null; // latest classification, before smoothing
    this.effective = "neutral";
    this.candidate = { category: "neutral", since: Date.now() };
  }

  start() {
    this.watcher.start();
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.watcher.stop();
    this.save(true);
  }

  setLocked(locked) {
    this.locked = locked;
    this.tick();
  }

  tick(now = Date.now()) {
    const minutes = Math.min((now - this.lastTickAt) / 60000, MAX_SLICE_MINUTES);
    this.lastTickAt = now;

    if (sim.isPaused(this.state, now)) {
      this.emitSnapshot();
      return;
    }
    if (this.state.pausedUntil !== null) {
      this.state.pausedUntil = null; // a timed pause just ran out
    }

    const idleSeconds = this.getIdleSeconds();
    const sample = this.watcher.current();
    const isOwnWindow = sample && OWN_PROCESSES.has(String(sample.processName ?? "").toLowerCase());

    if (this.locked || idleSeconds >= IDLE_AFTER_SECONDS) {
      this.raw = { category: "idle", source: this.locked ? "locked" : "idle", display: "Away", app: null, site: null };
    } else if (sample && !isOwnWindow) {
      this.lastSample = sample;
      this.raw = classify(sample, this.state.rules);
    } else if (!this.raw) {
      this.raw = classify(this.lastSample ?? {}, this.state.rules);
    }
    // Looking at Deep Space itself keeps whatever you were doing before.

    this.smooth(this.raw.category, now);

    if (minutes > 0) {
      sim.step(this.state, {
        category: this.effective,
        label: this.raw.category === this.effective && this.raw.app ? statLabel(this.raw) : undefined,
        minutes,
        now
      });
    }

    // Places on the journey reached during this slice.
    const arrived = sim.checkMilestones(this.state, now);
    for (const entry of arrived) {
      this.emit("milestone", entry);
    }

    const recap = sim.dueWeeklyRecap(this.state, now);
    if (recap) {
      this.emit("recap", recap);
    }

    this.save(arrived.length > 0 || recap !== null);
    this.emitSnapshot();
  }

  smooth(category, now) {
    if (category === this.effective) {
      this.candidate = { category, since: now };
      return;
    }
    if (category === "idle") {
      // Idle is only reported after five quiet minutes, so it's already "sustained".
      this.effective = "idle";
      this.candidate = { category, since: now };
      return;
    }
    if (this.candidate.category !== category) {
      this.candidate = { category, since: now };
    }
    if (this.effective === "idle" || now - this.candidate.since >= SWITCH_AFTER_SECONDS * 1000) {
      this.effective = category;
    }
  }

  save(force) {
    const now = Date.now();
    if (!force && now - this.lastSaveAt < SAVE_EVERY_MS) {
      return;
    }
    this.lastSaveAt = now;
    try {
      this.store.save(this.state);
    } catch (error) {
      console.error("Could not save kingdom", error);
    }
  }

  emitSnapshot() {
    this.emit("snapshot", this.getSnapshot());
  }

  // ---- actions from the UI ------------------------------------------------

  setRule({ targetType, pattern, category }) {
    const cleanPattern = String(pattern ?? "").trim().toLowerCase();
    if (!cleanPattern || !["app", "site"].includes(targetType) || !["work", "play", "neutral"].includes(category)) {
      throw new Error("Invalid rule");
    }
    this.state.rules = [
      { id: `rule-${Date.now()}`, targetType, pattern: cleanPattern, category },
      ...this.state.rules.filter((rule) => !(rule.targetType === targetType && rule.pattern === cleanPattern))
    ];
    this.reclassify();
    return this.getSnapshot();
  }

  deleteRule(id) {
    this.state.rules = this.state.rules.filter((rule) => rule.id !== id);
    this.reclassify();
    return this.getSnapshot();
  }

  // A correction applies right away instead of waiting out the smoothing window.
  reclassify() {
    if (this.lastSample && this.raw?.category !== "idle") {
      this.raw = classify(this.lastSample, this.state.rules);
      this.effective = this.raw.category;
      this.candidate = { category: this.effective, since: Date.now() };
    }
    this.save(true);
    this.emitSnapshot();
  }

  /** @param {number | null} minutes  null pauses until resumed */
  pause(minutes) {
    this.state.pausedUntil = minutes === null ? -1 : Date.now() + minutes * 60000;
    this.save(true);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  resume() {
    this.state.pausedUntil = null;
    this.lastTickAt = Date.now();
    this.save(true);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  setMode(mode) {
    sim.setMode(this.state, mode);
    this.save(true);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  setUpgradeFocus(pieceId, label) {
    sim.setUpgradeFocus(this.state, pieceId, label);
    this.save(true);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  setMilestonePlan(plan) {
    sim.setMilestonePlan(this.state, plan);
    this.save(true);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  /** Facts about the app itself (version, update status) that the windows show. */
  setAppInfo(info) {
    this.appInfo = { ...this.appInfo, ...info };
    if (this.timer) {
      this.emitSnapshot(); // before start(), the first tick sends it
    }
  }

  updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.save(true);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  clearHistory() {
    this.state.days = {};
    this.state.events = [];
    this.save(true);
    this.emitSnapshot();
    return this.getSnapshot();
  }

  // ---- what the windows see -------------------------------------------------

  getSnapshot(now = Date.now()) {
    const day = sim.today(this.state, now);
    const raw = this.raw;
    const paused = sim.isPaused(this.state, now);
    const target = raw?.site?.key
      ? { targetType: "site", pattern: raw.site.key, label: raw.site.label }
      : raw?.app?.key
        ? { targetType: "app", pattern: raw.app.key, label: raw.app.label }
        : null;

    const topLabels = Object.entries(day.labels)
      .map(([label, entry]) => ({ label, minutes: Math.round(entry.minutes), category: entry.category }))
      .filter((entry) => entry.minutes >= 1)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8);

    return {
      seed: this.state.seed,
      buildPoints: this.state.buildPoints,
      mode: this.state.mode,
      upgradePoints: this.state.upgradePoints,
      upgradeLog: this.state.upgradeLog,
      damage: sim.damageCount(this.state),
      aliens: this.state.aliens.map((alien) => ({ id: alien.id, name: alien.name })),
      streakMinutes: this.state.streak.category === "work" ? Math.round(this.state.streak.minutes) : 0,
      today: {
        work: Math.round(day.work),
        play: Math.round(day.play),
        idle: Math.round(day.idle),
        neutral: Math.round(day.neutral),
        playAllowance: this.state.settings.playAllowanceMinutes,
        top: topLabels
      },
      now: {
        category: paused ? "paused" : this.effective,
        rawCategory: raw?.category ?? "neutral",
        display: paused ? "Tracking paused" : raw?.display ?? "Starting up",
        source: raw?.source ?? "starting",
        target
      },
      paused,
      pausedUntil: this.state.pausedUntil,
      tracking: process.platform !== "win32" ? "unsupported" : this.watcher.healthy ? "live" : "starting",
      rules: this.state.rules,
      settings: this.state.settings,
      milestones: this.state.milestones.reached,
      history: sim.recentDays(this.state, now, 14),
      weekTop: sim.weekTop(this.state, now),
      app: this.appInfo ?? { version: "", update: { state: "unavailable" } },
      events: this.state.events.slice(0, 5)
    };
  }
}

module.exports = { KingdomService };
