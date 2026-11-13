import { useEffect, useState } from "react";
import { api } from "../bridge.ts";
import { PIECES } from "../station/catalog.ts";
import { resolveStation, stepLabel } from "../station/generator.ts";
import { journeyAt } from "../station/journey.ts";
import { resolveUpgrades } from "../station/upgrades.ts";
import type { Category, Snapshot } from "../types.ts";

export const CATEGORY_LABEL: Record<Category | "paused", string> = {
  work: "Work",
  play: "Play",
  idle: "Break",
  neutral: "Neutral",
  paused: "Paused"
};

export function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) {
    return `${rounded}m`;
  }
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function useBuildStatus(snapshot: Snapshot) {
  const station = resolveStation(snapshot.seed, snapshot.buildPoints);
  const upgrades = resolveUpgrades(snapshot.seed, snapshot.upgradeLog, snapshot.upgradePoints);
  const built = station.pieces.length;
  if (snapshot.mode === "upgrade" && upgrades.current) {
    const { current } = upgrades;
    return {
      upgrading: true,
      label: `${PIECES[current.kind].name} → Lv ${current.toLevel}`,
      picked: upgrades.focusId === current.pieceId,
      progress: current.progress,
      built,
      coreLevel: upgrades.coreLevel,
      fullyUpgraded: false,
      remaining: Math.max(0, current.cost * (1 - current.progress))
    };
  }
  return {
    upgrading: false,
    picked: false,
    label: stepLabel(station.current, station.planner),
    progress: station.progress,
    built,
    coreLevel: upgrades.coreLevel,
    fullyUpgraded: upgrades.fullyUpgraded,
    remaining: station.current ? Math.max(0, station.current.total - snapshot.buildPoints) : 0
  };
}

/** Build new modules, or level up the ones you have. */
export function ModeSwitch({ snapshot, compact = false }: { snapshot: Snapshot; compact?: boolean }) {
  const [saving, setSaving] = useState(false);
  const choose = async (mode: "build" | "upgrade") => {
    if (mode === snapshot.mode || saving) {
      return;
    }
    setSaving(true);
    try {
      await api.setMode(mode);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={`segmented segmented--two ${compact ? "segmented--compact" : ""}`} role="group" aria-label="What focused work does">
      {(["build", "upgrade"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          className={snapshot.mode === mode ? "is-on" : ""}
          aria-pressed={snapshot.mode === mode}
          disabled={saving}
          onClick={() => void choose(mode)}
        >
          {mode === "build" ? "Build" : "Upgrade"}
        </button>
      ))}
    </div>
  );
}

export function BuildStatus({ snapshot }: { snapshot: Snapshot }) {
  const status = useBuildStatus(snapshot);
  const percent = Math.floor(status.progress * 100);
  const slowed = snapshot.aliens.length > 0 || snapshot.damage > 0;

  // Once every module is maxed, upgrade mode has nothing to do, so go back to building.
  useEffect(() => {
    if (snapshot.mode === "upgrade" && status.fullyUpgraded && !snapshot.paused) {
      void api.setMode("build");
    }
  }, [snapshot.mode, status.fullyUpgraded, snapshot.paused]);

  const eyebrow = snapshot.damage > 0 ? "Repairing first" : status.upgrading ? (status.picked ? "Upgrading your pick" : "Upgrading") : "Now building";
  return (
    <section className="build" aria-label="Construction">
      <div className="build__row">
        <span className="eyebrow">{eyebrow}</span>
        <ModeSwitch snapshot={snapshot} compact />
      </div>
      <div className="build__row">
        <strong className="build__name">{status.label}</strong>
        <span className="build__percent">{percent}%</span>
      </div>
      <div className="meter" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="meter__fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="build__hint">
        {snapshot.paused
          ? "Paused. The station is drifting quietly."
          : `About ${formatMinutes(status.remaining)} of focused work to finish`}
        {slowed && !snapshot.paused ? ", slowed by aliens" : ""}.
      </p>
    </section>
  );
}

export function TodayBar({ snapshot, detailed = false }: { snapshot: Snapshot; detailed?: boolean }) {
  const { today } = snapshot;
  const parts: Array<{ key: Category; minutes: number }> = [
    { key: "work", minutes: today.work },
    { key: "play", minutes: today.play },
    { key: "idle", minutes: today.idle },
    { key: "neutral", minutes: today.neutral }
  ];
  const total = parts.reduce((sum, part) => sum + part.minutes, 0);
  const playLeft = Math.max(0, today.playAllowance - today.play);
  return (
    <section className="today" aria-label="Today">
      <div className="today__head">
        <span className="eyebrow">Today</span>
        <span className="today__note">
          {today.play > today.playAllowance ? "Free play time used up" : `${formatMinutes(playLeft)} of free play left`}
        </span>
      </div>
      <div className="stack" aria-hidden="true">
        {total === 0 ? <span className="stack__empty" /> : null}
        {parts.map((part) =>
          part.minutes > 0 ? <span key={part.key} className={`stack__part tone-${part.key}`} style={{ flexGrow: part.minutes }} /> : null
        )}
      </div>
      <ul className="legend">
        {parts.map((part) => (
          <li key={part.key}>
            <i className={`dot tone-${part.key}`} />
            {CATEGORY_LABEL[part.key]} <b>{formatMinutes(part.minutes)}</b>
          </li>
        ))}
      </ul>
      {detailed && today.top.length > 0 ? (
        <ul className="top">
          {today.top.map((entry) => (
            <li key={entry.label}>
              <i className={`dot tone-${entry.category}`} />
              <span className="top__label">{entry.label}</span>
              <span className="top__time">{formatMinutes(entry.minutes)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** What's in focus right now, with one-click corrections that save a rule. */
export function NowCard({ snapshot }: { snapshot: Snapshot }) {
  const [saving, setSaving] = useState(false);
  const { now } = snapshot;
  const target = now.target;
  const active = now.category === "paused" ? null : now.rawCategory;
  const canCorrect = Boolean(target) && !snapshot.paused && now.rawCategory !== "idle";

  const choose = async (category: "work" | "play" | "neutral") => {
    if (!target || saving) {
      return;
    }
    setSaving(true);
    try {
      await api.setRule({ targetType: target.targetType, pattern: target.pattern, category });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="now" aria-label="Right now">
      <div className="now__head">
        <span className="eyebrow">Right now</span>
        <span className={`pill tone-${now.category}`}>{CATEGORY_LABEL[now.category]}</span>
      </div>
      <p className="now__what" title={now.display}>
        {now.display}
      </p>
      {canCorrect ? (
        <>
          <div className="segmented" role="group" aria-label={`Count ${target!.label} as`}>
            {(["work", "play", "neutral"] as const).map((category) => (
              <button
                key={category}
                type="button"
                className={active === category ? "is-on" : ""}
                aria-pressed={active === category}
                disabled={saving}
                onClick={() => void choose(category)}
              >
                {CATEGORY_LABEL[category]}
              </button>
            ))}
          </div>
          <p className="now__hint">
            Wrong? Pick one to always count <b>{target!.label}</b> that way.
          </p>
        </>
      ) : null}
    </section>
  );
}

export function StationChips({ snapshot }: { snapshot: Snapshot }) {
  const station = resolveStation(snapshot.seed, snapshot.buildPoints);
  const journey = journeyAt(station.builtSteps, station.progress);
  const { coreLevel } = resolveUpgrades(snapshot.seed, snapshot.upgradeLog, snapshot.upgradePoints);
  const modules = station.pieces.length;
  return (
    <ul className="folk" aria-label="Station status">
      <li className="folk__level" title={`${modules} module${modules === 1 ? "" : "s"}; command core at level ${coreLevel}`}>
        Lv {coreLevel} {"·"} {modules} module{modules === 1 ? "" : "s"}
      </li>
      <li title={journey.lap > 1 ? `Lap ${journey.lap} of the solar system` : undefined}>
        <i className="dot tone-work" /> {journey.label}
      </li>
      {snapshot.aliens.length > 0 ? (
        <li className="folk__aliens">
          <i className="dot tone-alien" /> {snapshot.aliens.length} alien{snapshot.aliens.length === 1 ? "" : "s"} on the hull
        </li>
      ) : null}
      {snapshot.streakMinutes >= 25 ? <li className="folk__streak">Focus streak {formatMinutes(snapshot.streakMinutes)} · 1.5×</li> : null}
    </ul>
  );
}

export function LatestEvent({ snapshot }: { snapshot: Snapshot }) {
  const event = snapshot.events[0];
  return event ? <p className="event">{event.text}</p> : null;
}
