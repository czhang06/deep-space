// The station's rules, as pure functions over a plain state object (easy to test and to save).
//
//   work   -> build points (1 per focused minute, 1.5x once a streak passes 25 min)
//   breaks -> nothing lost
//   play   -> free up to the daily allowance; past it, aliens latch on (max 3)
//   aliens -> slow building by 20% each and damage the hull (repair debt);
//             the crew pries one off after 30 more minutes of work
//
// The station layout itself is derived in the renderer from (seed, buildPoints), so it never
// reshuffles and the main process doesn't need to know about modules.
//
// Milestones (the places on the ship's journey) work the same way: the renderer works out how
// many build points each destination needs and sends that plan here. The main process records
// when each one is reached, so arrivals are dated and announced even with no window open.
// Milestones passed before the plan arrived are backfilled with dates estimated from the daily
// history.

const STATE_VERSION = 2;
const STREAK_BONUS_MINUTES = 25;
const STREAK_BONUS = 1.5;
const ALIEN_SLOWDOWN = 0.2;
const MAX_ALIENS = 3;
const ALIEN_EVERY_MINUTES = 45; // of play past the allowance
const ALIEN_WORK_TO_EVICT = 30;
const DAMAGE_COST = 12; // build points to repair one bit of damage
const DAYS_KEPT = 60;
const EVENTS_KEPT = 20;

const ALIEN_NAMES = ["Gloop", "Zib", "Xorvak", "Blorb", "Skree", "Mox", "Quill", "Nib"];
const MISCHIEF = [
  "chewed through a power cable",
  "scorched a hull panel",
  "cracked a viewport",
  "tangled the solar wiring",
  "slimed the airlock"
];

function createState({ seed = Math.floor(Math.random() * 2 ** 31), now = Date.now() } = {}) {
  return {
    version: STATE_VERSION,
    seed,
    createdAt: now,
    buildPoints: 0,
    // Upgrade mode: focused work levels up existing modules instead of adding new ones.
    // upgradeLog records, for each stint in upgrade mode, how far building had got and how
    // many upgrade points had been spent when it began, so upgrades replay identically even
    // after more modules are built later.
    mode: "build",
    upgradePoints: 0,
    upgradeLog: [],
    repairDebt: 0,
    aliens: [],
    alienCounter: 0,
    streak: { category: "neutral", minutes: 0 },
    days: {},
    rules: [],
    settings: { openAtLogin: true, playAllowanceMinutes: 90, milestoneNotifications: true, autoUpdate: true, weeklyRecap: true },
    // the Monday (day key) of the last week a recap was sent for
    lastRecapWeek: null,
    pausedUntil: null,
    events: [],
    // plan: [{ index, points, name, detail, announce? }] from the renderer
    // reached: [{ index, at, approx? }]; at is null when it was reached before the daily records
    milestones: { plan: [], reached: [] }
  };
}

/** Fills in anything missing from a saved state (older or partial files). */
function reviveState(saved, now = Date.now()) {
  if (!saved || saved.version !== STATE_VERSION) {
    return null;
  }
  const base = createState({ seed: saved.seed, now });
  const { rogues, rogueCounter, ...rest } = saved; // names from the castle version
  return {
    ...base,
    ...rest,
    settings: { ...base.settings, ...(saved.settings ?? {}) },
    streak: saved.streak ?? base.streak,
    aliens: Array.isArray(saved.aliens) ? saved.aliens : Array.isArray(rogues) ? rogues : [],
    alienCounter: saved.alienCounter ?? rogueCounter ?? 0,
    rules: Array.isArray(saved.rules) ? saved.rules : [],
    days: saved.days ?? {},
    milestones: {
      plan: Array.isArray(saved.milestones?.plan) ? saved.milestones.plan : [],
      reached: Array.isArray(saved.milestones?.reached) ? saved.milestones.reached : []
    },
    events: Array.isArray(saved.events) ? saved.events.filter((event) => !/keep|castle|rogue|builders/i.test(event.text)) : []
  };
}

function dayKey(time) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyDay() {
  return { work: 0, play: 0, idle: 0, neutral: 0, labels: {}, aliensArrived: 0 };
}

function getDay(state, time) {
  const key = dayKey(time);
  if (!state.days[key]) {
    state.days[key] = emptyDay();
    pruneDays(state);
  }
  return state.days[key];
}

function pruneDays(state) {
  const keys = Object.keys(state.days).sort();
  while (keys.length > DAYS_KEPT) {
    delete state.days[keys.shift()];
  }
}

function pushEvent(state, text, now) {
  state.events.unshift({ text, at: now });
  state.events.length = Math.min(state.events.length, EVENTS_KEPT);
}

function isPaused(state, now = Date.now()) {
  if (state.pausedUntil === null || state.pausedUntil === undefined) {
    return false;
  }
  if (state.pausedUntil === -1) {
    return true; // until resumed
  }
  return now < state.pausedUntil;
}

/**
 * Advances the station by one tracked slice of time.
 * @param {object} state  mutated in place
 * @param {{ category: "work"|"play"|"idle"|"neutral", label?: string, minutes: number, now?: number }} slice
 */
function step(state, { category, label, minutes, now = Date.now() }) {
  if (!(minutes > 0)) {
    return state;
  }

  const day = getDay(state, now);
  day[category] = (day[category] ?? 0) + minutes;

  if (label && category !== "idle") {
    const entry = day.labels[label] ?? { minutes: 0, category };
    entry.minutes += minutes;
    entry.category = category;
    day.labels[label] = entry;
  }

  if (state.streak.category === category) {
    state.streak.minutes += minutes;
  } else {
    state.streak = { category, minutes };
  }

  if (category === "work") {
    applyWork(state, minutes, now);
  } else if (category === "play") {
    applyPlay(state, day, now);
  }

  return state;
}

function applyWork(state, minutes, now) {
  const streakMultiplier = state.streak.minutes > STREAK_BONUS_MINUTES ? STREAK_BONUS : 1;
  const alienMultiplier = Math.max(0.2, 1 - ALIEN_SLOWDOWN * state.aliens.length);
  let points = minutes * streakMultiplier * alienMultiplier;

  if (state.repairDebt > 0) {
    const repaired = Math.min(points, state.repairDebt);
    const before = damageCount(state);
    state.repairDebt -= repaired;
    points -= repaired;
    if (damageCount(state) < before) {
      pushEvent(state, "The crew patched up the hull.", now);
    }
  }
  if (state.mode === "upgrade") {
    state.upgradePoints += points;
  } else {
    state.buildPoints += points;
  }

  const alien = state.aliens[0];
  if (alien) {
    alien.workLeft -= minutes;
    if (alien.workLeft <= 0) {
      state.aliens.shift();
      pushEvent(state, `The crew pried ${alien.name} off the hull and sent it drifting.`, now);
    }
  }
}

function applyPlay(state, day, now) {
  const overflow = day.play - state.settings.playAllowanceMinutes;
  const due = Math.floor(overflow / ALIEN_EVERY_MINUTES) + 1;
  if (overflow < 0 || day.aliensArrived >= due || state.aliens.length >= MAX_ALIENS) {
    return;
  }

  day.aliensArrived += 1;
  const index = state.alienCounter;
  state.alienCounter += 1;
  const alien = {
    id: `alien-${index}`,
    name: ALIEN_NAMES[(state.seed + index) % ALIEN_NAMES.length],
    arrivedAt: now,
    workLeft: ALIEN_WORK_TO_EVICT
  };
  state.aliens.push(alien);
  state.repairDebt += DAMAGE_COST;
  pushEvent(state, `${alien.name} latched onto the station and ${MISCHIEF[index % MISCHIEF.length]}.`, now);
}

/** Switches where focused work goes: "build" adds modules, "upgrade" levels up existing ones. */
function setMode(state, mode, now = Date.now()) {
  if (mode !== "build" && mode !== "upgrade") {
    throw new Error("Invalid mode");
  }
  if (state.mode === mode) {
    return state;
  }
  if (mode === "upgrade") {
    state.upgradeLog.push({ buildPoints: state.buildPoints, upgradeFrom: state.upgradePoints });
    pushEvent(state, "The crew switched to upgrade mode, starting with the command core.", now);
  } else {
    pushEvent(state, "The crew went back to building new modules.", now);
  }
  state.mode = mode;
  return state;
}

/**
 * Picks a module to upgrade next (switching to upgrade mode if needed); null goes back to the
 * automatic core-outward order. `label` is the module's display name, for the event log.
 */
function setUpgradeFocus(state, pieceId, label, now = Date.now()) {
  if (pieceId !== null && !(Number.isInteger(pieceId) && pieceId >= 0)) {
    throw new Error("Invalid module");
  }
  if (state.mode !== "upgrade") {
    setMode(state, "upgrade", now);
  }
  const last = [...state.upgradeLog].reverse().find((entry) => entry.type === "focus");
  if (last && last.pieceId === pieceId) {
    return state;
  }
  state.upgradeLog.push({ type: "focus", pieceId, at: state.upgradePoints });
  if (pieceId !== null) {
    pushEvent(state, `The crew started upgrading the ${label || "module"} you picked.`, now);
  }
  return state;
}

// ---- milestones ------------------------------------------------------------------------

/** Noon (local time) on a day key, as a timestamp. */
function dayNoon(key) {
  return new Date(`${key}T12:00:00`).getTime();
}

/**
 * Roughly when the ship had `points` build points, from the daily work history: points are
 * spread over the recorded days in proportion to focused minutes. Returns null when that was
 * before the oldest record.
 */
function estimateReachedAt(state, points, now = Date.now()) {
  const keys = Object.keys(state.days).sort();
  const work = keys.map((key) => state.days[key].work ?? 0);
  const total = work.reduce((sum, minutes) => sum + minutes, 0);
  if (total <= 0 || state.buildPoints <= 0) {
    return points >= state.buildPoints - 1 ? now : null;
  }
  // Points per focused minute: between 1 and the streak bonus, or less while aliens slow things.
  const rate = Math.min(STREAK_BONUS, state.buildPoints / total);
  let cumulative = state.buildPoints - total * rate; // earned before the oldest record
  if (points <= cumulative) {
    return null;
  }
  for (let index = 0; index < keys.length; index += 1) {
    cumulative += work[index] * rate;
    if (cumulative >= points - 1e-6) {
      return Math.min(now, dayNoon(keys[index]));
    }
  }
  return now;
}

/** Takes a new milestone plan and backfills any milestones already passed (dated by estimate). */
function setMilestonePlan(state, plan, now = Date.now()) {
  state.milestones.plan = plan.map(({ index, points, name, detail, announce }) => ({ index, points, name, detail, announce }));
  const known = new Set(state.milestones.reached.map((entry) => entry.index));
  for (const entry of state.milestones.plan) {
    if (entry.points <= state.buildPoints && !known.has(entry.index)) {
      state.milestones.reached.push({ index: entry.index, at: estimateReachedAt(state, entry.points, now), approx: true });
      known.add(entry.index);
    }
  }
  state.milestones.reached.sort((a, b) => a.index - b.index);
  return state;
}

/** Records milestones the ship has just reached; returns their plan entries (to announce). */
function checkMilestones(state, now = Date.now()) {
  const known = new Set(state.milestones.reached.map((entry) => entry.index));
  const arrived = [];
  for (const entry of state.milestones.plan) {
    if (entry.points <= state.buildPoints && !known.has(entry.index)) {
      state.milestones.reached.push({ index: entry.index, at: now });
      known.add(entry.index);
      arrived.push(entry);
    }
  }
  if (arrived.length) {
    state.milestones.reached.sort((a, b) => a.index - b.index);
    const last = arrived[arrived.length - 1];
    pushEvent(state, last.announce ? `${last.announce} Arrived at ${last.name}.` : `Arrived at ${last.name}.`, now);
  }
  return arrived;
}

// ---- weekly recap ------------------------------------------------------------------------

const RECAP_HOUR = 9;
const FOCUSED_DAY_MINUTES = 30;

/** Midnight at the start of the week (Monday) containing `time`, local time. */
function weekStart(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

function addDays(time, days) {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** Totals for the seven days starting at `start` (a Monday midnight). */
function summarizeWeek(state, start) {
  const end = addDays(start, 7);
  const summary = { start: dayKey(start), work: 0, play: 0, focusedDays: 0, bestDay: null, bestWork: 0, places: [] };
  for (let offset = 0; offset < 7; offset += 1) {
    const key = dayKey(addDays(start, offset));
    const day = state.days[key];
    if (!day) {
      continue;
    }
    summary.work += day.work ?? 0;
    summary.play += day.play ?? 0;
    if ((day.work ?? 0) >= FOCUSED_DAY_MINUTES) {
      summary.focusedDays += 1;
    }
    if ((day.work ?? 0) > summary.bestWork) {
      summary.bestWork = day.work;
      summary.bestDay = key;
    }
  }
  const names = new Map(state.milestones.plan.map((entry) => [entry.index, entry.name]));
  summary.places = state.milestones.reached
    .filter((entry) => entry.at !== null && entry.at >= start && entry.at < end && names.has(entry.index))
    .map((entry) => names.get(entry.index));
  return summary;
}

/**
 * Once a week, from Monday 9am, a recap of the week before (and the one before that, for
 * comparison). Returns null when it isn't due, is turned off, or there's nothing to report.
 */
function dueWeeklyRecap(state, now = Date.now()) {
  const thisWeek = weekStart(now);
  const lastWeek = addDays(thisWeek, -7);
  const key = dayKey(lastWeek);
  if (!state.settings.weeklyRecap || state.lastRecapWeek === key || new Date(now).getHours() < RECAP_HOUR && now - thisWeek < 86400000) {
    return null;
  }
  state.lastRecapWeek = key;
  const week = summarizeWeek(state, lastWeek);
  if (week.work < 1 && week.play < 1) {
    return null; // the app wasn't running that week
  }
  return { week, previous: summarizeWeek(state, addDays(lastWeek, -7)) };
}

/** The last `count` days, oldest first, for charts (days with no record count as zero). */
function recentDays(state, now = Date.now(), count = 14) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const key = dayKey(addDays(today.getTime(), index - count + 1));
    const day = state.days[key] ?? emptyDay();
    return { date: key, work: Math.round(day.work), play: Math.round(day.play), idle: Math.round(day.idle), neutral: Math.round(day.neutral) };
  });
}

/** Top apps and sites over the last seven days. */
function weekTop(state, now = Date.now(), limit = 5) {
  const totals = new Map();
  for (const day of recentDays(state, now, 7)) {
    for (const [label, entry] of Object.entries(state.days[day.date]?.labels ?? {})) {
      const current = totals.get(label) ?? { label, minutes: 0, category: entry.category };
      current.minutes += entry.minutes;
      current.category = entry.category;
      totals.set(label, current);
    }
  }
  return [...totals.values()]
    .map((entry) => ({ ...entry, minutes: Math.round(entry.minutes) }))
    .filter((entry) => entry.minutes >= 1)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit);
}

function damageCount(state) {
  return Math.max(0, Math.ceil(state.repairDebt / DAMAGE_COST - 1e-9));
}

function today(state, now = Date.now()) {
  return state.days[dayKey(now)] ?? emptyDay();
}

module.exports = {
  dueWeeklyRecap,
  recentDays,
  summarizeWeek,
  weekStart,
  weekTop,
  checkMilestones,
  estimateReachedAt,
  setMilestonePlan,
  ALIEN_WORK_TO_EVICT,
  DAMAGE_COST,
  MAX_ALIENS,
  STATE_VERSION,
  createState,
  damageCount,
  dayKey,
  isPaused,
  pushEvent,
  reviveState,
  setMode,
  setUpgradeFocus,
  step,
  today
};
