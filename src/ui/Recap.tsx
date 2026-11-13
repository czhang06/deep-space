import { useEffect, useRef } from "react";
import { destination } from "../station/journey.ts";
import { placeTitle } from "../station/milestones.ts";
import type { Snapshot } from "../types.ts";
import { CATEGORY_LABEL, formatMinutes } from "./parts.tsx";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FOCUSED_DAY_MINUTES = 30;

function parseDay(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The seven day keys of the week (Monday first) containing `date`, shifted by `weeks`. */
function weekKeys(date: Date, weeks = 0): string[] {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weeks * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return dayKey(day);
  });
}

/** This week at a glance: focus per day, how it compares with last week, and what happened. */
export function Recap({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const now = new Date();
  const todayKey = dayKey(now);
  const byDate = new Map(snapshot.history.map((day) => [day.date, day]));
  const thisWeek = weekKeys(now).map((key) => ({ key, day: byDate.get(key), future: key > todayKey }));
  const lastWeek = weekKeys(now, -1).map((key) => byDate.get(key));
  const elapsed = thisWeek.filter((entry) => !entry.future).length;

  const work = thisWeek.reduce((sum, entry) => sum + (entry.day?.work ?? 0), 0);
  // Compare with the same days of last week, so a Wednesday isn't measured against a whole week.
  const lastSoFar = lastWeek.slice(0, elapsed).reduce((sum, day) => sum + (day?.work ?? 0), 0);
  const lastTotal = lastWeek.reduce((sum, day) => sum + (day?.work ?? 0), 0);
  const change = lastSoFar >= 30 ? Math.round(((work - lastSoFar) / lastSoFar) * 100) : null;
  const focusedDays = thisWeek.filter((entry) => (entry.day?.work ?? 0) >= FOCUSED_DAY_MINUTES).length;
  const best = thisWeek.reduce((top, entry) => ((entry.day?.work ?? 0) > (top?.day?.work ?? 0) ? entry : top), thisWeek[0]);
  const bestWork = best?.day?.work ?? 0;
  const max = Math.max(60, ...thisWeek.map((entry) => entry.day?.work ?? 0));
  const allowance = snapshot.settings.playAllowanceMinutes;
  const withinPlay = thisWeek.filter((entry) => !entry.future && (entry.day?.play ?? 0) <= allowance).length;

  const weekStart = parseDay(thisWeek[0].key).getTime();
  const places = snapshot.milestones
    .filter((entry) => entry.at !== null && !entry.approx && entry.at >= weekStart)
    .map((entry) => placeTitle(destination(entry.index).name));

  const range = `${parseDay(thisWeek[0].key).toLocaleDateString([], { day: "numeric", month: "short" })} – ${parseDay(thisWeek[6].key).toLocaleDateString([], { day: "numeric", month: "short" })}`;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet recap" ref={panel} role="dialog" aria-modal="true" aria-labelledby="recap-title">
        <header className="sheet__head">
          <div>
            <h2 id="recap-title">This week</h2>
            <p className="muted logbook__summary">{range}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close weekly recap">
            ✕
          </button>
        </header>

        <section className="sheet__section">
          <span className="eyebrow">Focused work</span>
          <p className="recap__hero">{formatMinutes(work)}</p>
          <p className="muted">
            {change === null
              ? "Not enough last week to compare with yet."
              : `${change >= 0 ? "+" : ""}${change}% on the same days last week (${formatMinutes(lastSoFar)}).`}
          </p>

          <figure className="recap-chart" aria-label="Focused minutes per day this week">
            <div className="recap-chart__plot">
              {thisWeek.map((entry, index) => {
                const minutes = entry.day?.work ?? 0;
                const height = entry.future ? 0 : Math.max(minutes > 0 ? 3 : 0, (minutes / max) * 100);
                const label = `${DAY_NAMES[index]}: ${entry.future ? "still to come" : `${formatMinutes(minutes)} of focus`}`;
                return (
                  <div key={entry.key} className={entry.key === todayKey ? "recap-chart__col recap-chart__col--today" : "recap-chart__col"} title={label} aria-label={label}>
                    {entry === best && bestWork > 0 ? (
                      <span className="recap-chart__value" style={{ bottom: `calc(${height}% + 4px)` }}>
                        {formatMinutes(bestWork)}
                      </span>
                    ) : null}
                    <span className={entry.future ? "recap-chart__bar recap-chart__bar--future" : "recap-chart__bar"} style={{ height: `${height}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="recap-chart__axis" aria-hidden="true">
              {DAY_NAMES.map((name, index) => (
                <span key={name} className={thisWeek[index].key === todayKey ? "recap-chart__day recap-chart__day--today" : "recap-chart__day"}>
                  {name}
                </span>
              ))}
            </div>
          </figure>
        </section>

        <section className="sheet__section">
          <dl className="recap__stats">
            <div>
              <dt>Focused days</dt>
              <dd>
                {focusedDays} <small>of {elapsed}</small>
              </dd>
            </div>
            <div>
              <dt>Best day</dt>
              <dd>{bestWork > 0 ? `${DAY_NAMES[thisWeek.indexOf(best)]}, ${formatMinutes(bestWork)}` : "–"}</dd>
            </div>
            <div>
              <dt>Play kept in check</dt>
              <dd>
                {withinPlay} <small>of {elapsed} days</small>
              </dd>
            </div>
            <div>
              <dt>New places</dt>
              <dd>{places.length}</dd>
            </div>
          </dl>
          {places.length ? <p className="muted">Reached {places.join(", ")}.</p> : <p className="muted">No new places yet this week.</p>}
        </section>

        <section className="sheet__section">
          <h3>Where the time went</h3>
          {snapshot.weekTop.length === 0 ? (
            <p className="muted">Nothing recorded yet this week.</p>
          ) : (
            <ul className="recap__top">
              {snapshot.weekTop.map((entry) => (
                <li key={entry.label}>
                  <i className={`dot tone-${entry.category}`} aria-hidden="true" />
                  <span>{entry.label}</span>
                  <small>{CATEGORY_LABEL[entry.category as keyof typeof CATEGORY_LABEL] ?? ""}</small>
                  <b>{formatMinutes(entry.minutes)}</b>
                </li>
              ))}
            </ul>
          )}
          <p className="muted">Last 7 days.</p>
        </section>

        <section className="sheet__section">
          <p className="muted">
            Last week: {formatMinutes(lastTotal)} of focus over {lastWeek.filter((day) => (day?.work ?? 0) >= FOCUSED_DAY_MINUTES).length} focused days.
          </p>
        </section>
      </aside>
    </>
  );
}
