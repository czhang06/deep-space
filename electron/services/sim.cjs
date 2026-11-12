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
    settings: { openAtLogin: true, playAllowanceMinutes: 90 },
    pausedUntil: null,
    events: []
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

function damageCount(state) {
  return Math.max(0, Math.ceil(state.repairDebt / DAMAGE_COST - 1e-9));
}

function today(state, now = Date.now()) {
  return state.days[dayKey(now)] ?? emptyDay();
}

module.exports = {
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
  step,
  today
};
