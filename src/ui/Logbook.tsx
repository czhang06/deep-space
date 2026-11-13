import { useEffect, useRef } from "react";
import { resolveStation } from "../station/generator.ts";
import { destination, journeyAt } from "../station/journey.ts";
import { REGION_TITLES, milestoneDetail, milestonePoints, placeTitle, regionOf } from "../station/milestones.ts";
import type { Snapshot } from "../types.ts";
import { formatMinutes } from "./parts.tsx";

/** How many places past the next stop the logbook shows. */
const LOOK_AHEAD = 4;

function formatReached(entry: { at: number | null; approx?: boolean } | undefined, start: boolean): string {
  if (start && (!entry || entry.at === null)) {
    return "Where the journey began";
  }
  if (!entry) {
    return "Reached";
  }
  if (entry.at === null) {
    return "Before your records began";
  }
  const date = new Date(entry.at);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const text = date.toLocaleDateString([], { day: "numeric", month: "short", year: sameYear ? undefined : "numeric" });
  return entry.approx ? `About ${text}` : `${text}, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/** Every place the ship has passed, the next stop with a progress bar, and the few after it. */
export function Logbook({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    // Open on the next stop rather than at Mercury.
    panel.current?.querySelector(".logbook__entry--next")?.scrollIntoView({ block: "center" });
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const station = resolveStation(snapshot.seed, snapshot.buildPoints);
  const journey = journeyAt(station.builtSteps, station.progress);
  const reached = new Map(snapshot.milestones.map((entry) => [entry.index, entry]));
  const last = journey.index + 1 + LOOK_AHEAD;
  const passed = journey.index + 1;

  // Group the route by region, in order.
  const groups: Array<{ region: string; indexes: number[] }> = [];
  for (let index = 0; index <= last; index += 1) {
    const region = regionOf(index);
    if (groups[groups.length - 1]?.region !== region) {
      groups.push({ region, indexes: [] });
    }
    groups[groups.length - 1].indexes.push(index);
  }

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet logbook" ref={panel} role="dialog" aria-modal="true" aria-labelledby="logbook-title">
        <header className="sheet__head">
          <div>
            <h2 id="logbook-title">Logbook</h2>
            <p className="muted logbook__summary">
              {passed} place{passed === 1 ? "" : "s"} visited {"·"} now in {journey.region}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close logbook">
            ✕
          </button>
        </header>

        {groups.map((group) => (
          <section key={group.region} className="sheet__section">
            <h3>{REGION_TITLES[group.region] ?? group.region}</h3>
            <ol className="logbook__list">
              {group.indexes.map((index) => {
                const place = placeTitle(destination(index).name);
                if (index <= journey.index) {
                  return (
                    <li key={index} className="logbook__entry logbook__entry--done">
                      <span className="logbook__mark" aria-hidden="true">
                        ✓
                      </span>
                      <span className="logbook__text">
                        <b>{place}</b>
                        <small>{milestoneDetail(index)}</small>
                      </span>
                      <span className="logbook__when">{formatReached(reached.get(index), index === 0)}</span>
                    </li>
                  );
                }
                const toGo = Math.max(0, milestonePoints(snapshot.seed, index) - snapshot.buildPoints);
                if (index === journey.index + 1) {
                  const percent = Math.min(99, Math.floor(journey.leg * 100));
                  return (
                    <li key={index} className="logbook__entry logbook__entry--next">
                      <span className="logbook__mark" aria-hidden="true">
                        ➜
                      </span>
                      <span className="logbook__text">
                        <span className="eyebrow">Next stop</span>
                        <b>{place}</b>
                        <small>{milestoneDetail(index)}</small>
                        <span className="meter meter--journey" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                          <span className="meter__fill" style={{ width: `${percent}%` }} />
                        </span>
                        <small>
                          {percent}% of the way {"·"} about {formatMinutes(toGo)} of focus to go
                        </small>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={index} className="logbook__entry logbook__entry--ahead">
                    <span className="logbook__mark" aria-hidden="true">
                      ·
                    </span>
                    <span className="logbook__text">
                      <b>{place}</b>
                      <small>{milestoneDetail(index)}</small>
                    </span>
                    <span className="logbook__when">About {formatMinutes(toGo)} away</span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <p className="muted logbook__more">…and the rest of the universe beyond.</p>
      </aside>
    </>
  );
}
