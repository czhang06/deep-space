// The kingdom's rules, as pure functions over a plain state object (easy to test and to save).
//
//   work   -> build points (1 per focused minute, 1.5x once a streak passes 25 min)
//   breaks -> nothing lost
//   play   -> free up to the daily allowance; past it, rogues show up (max 3)
//   rogues -> slow building by 20% each and knock something over (repair debt);
//             builders chase one out after 30 more minutes of work
//
// The castle layout itself is derived in the renderer from (seed, buildPoints), so it never
// reshuffles and the main process doesn't need to know about pieces.

const STATE_VERSION = 2;
const STREAK_BONUS_MINUTES = 25;
const STREAK_BONUS = 1.5;
const ROGUE_SLOWDOWN = 0.2;
const MAX_ROGUES = 3;
const ROGUE_EVERY_MINUTES = 45; // of play past the allowance
const ROGUE_WORK_TO_EVICT = 30;
const MISCHIEF_COST = 12; // build points to repair one bit of damage
const DAYS_KEPT = 60;
const EVENTS_KEPT = 20;

const ROGUE_NAMES = ["Wick", "Sly Tam", "Nettle", "Crow", "Pip the Quick", "Mags", "Dunny", "Rook"];
const MISCHIEF = [
  "knocked over a scaffold",
  "made off with a banner",
  "pried loose some stones",
  "tipped a cart of timber into the moat",
  "painted a silly face on the wall"
];

function createState({ seed = Math.floor(Math.random() * 2 ** 31), now = Date.now() } = {}) {
  return {
    version: STATE_VERSION,
    seed,
    createdAt: now,
    buildPoints: 0,
    repairDebt: 0,
    rogues: [],
    rogueCounter: 0,
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
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings ?? {}) },
    streak: saved.streak ?? base.streak,
    rogues: Array.isArray(saved.rogues) ? saved.rogues : [],
    rules: Array.isArray(saved.rules) ? saved.rules : [],
    days: saved.days ?? {},
    events: Array.isArray(saved.events) ? saved.events : []
  };
}

function dayKey(time) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptyDay() {
  return { work: 0, play: 0, idle: 0, neutral: 0, labels: {}, roguesArrived: 0 };
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
 * Advances the kingdom by one tracked slice of time.
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
  const rogueMultiplier = Math.max(0.2, 1 - ROGUE_SLOWDOWN * state.rogues.length);
  let points = minutes * streakMultiplier * rogueMultiplier;

  if (state.repairDebt > 0) {
    const repaired = Math.min(points, state.repairDebt);
    const before = damageCount(state);
    state.repairDebt -= repaired;
    points -= repaired;
    if (damageCount(state) < before) {
      pushEvent(state, "Your builders patched up the damage.", now);
    }
  }
  state.buildPoints += points;

  const rogue = state.rogues[0];
  if (rogue) {
    rogue.workLeft -= minutes;
    if (rogue.workLeft <= 0) {
      state.rogues.shift();
      pushEvent(state, `The builders chased ${rogue.name} out of the castle.`, now);
    }
  }
}

function applyPlay(state, day, now) {
  const overflow = day.play - state.settings.playAllowanceMinutes;
  const due = Math.floor(overflow / ROGUE_EVERY_MINUTES) + 1;
  if (overflow < 0 || day.roguesArrived >= due || state.rogues.length >= MAX_ROGUES) {
    return;
  }

  day.roguesArrived += 1;
  const index = state.rogueCounter;
  state.rogueCounter += 1;
  const rogue = {
    id: `rogue-${index}`,
    name: ROGUE_NAMES[(state.seed + index) % ROGUE_NAMES.length],
    arrivedAt: now,
    workLeft: ROGUE_WORK_TO_EVICT
  };
  state.rogues.push(rogue);
  state.repairDebt += MISCHIEF_COST;
  pushEvent(state, `${rogue.name} slipped in and ${MISCHIEF[index % MISCHIEF.length]}.`, now);
}

function damageCount(state) {
  return Math.max(0, Math.ceil(state.repairDebt / MISCHIEF_COST - 1e-9));
}

function today(state, now = Date.now()) {
  return state.days[dayKey(now)] ?? emptyDay();
}

/** Builders on site: one, plus one per hour of work today, up to six. */
function builderCount(state, now = Date.now()) {
  return Math.min(6, 1 + Math.floor(today(state, now).work / 60));
}

module.exports = {
  MAX_ROGUES,
  MISCHIEF_COST,
  ROGUE_WORK_TO_EVICT,
  STATE_VERSION,
  builderCount,
  createState,
  damageCount,
  dayKey,
  isPaused,
  pushEvent,
  reviveState,
  step,
  today
};
