import { Suspense, lazy } from "react";
import { api, useSnapshot } from "../bridge.ts";
import type { Snapshot } from "../types.ts";
import { BuildStatus, NextStop, NowCard, StationChips, TodayBar, useMilestonePlan } from "./parts.tsx";

const StationView = lazy(() => import("../station/StationView.tsx"));

/** The small window that pops up from the tray icon. */
export default function PopupApp() {
  const snapshot = useSnapshot();
  if (!snapshot) {
    return <div className="popup popup--loading" />;
  }
  return <Popup snapshot={snapshot} />;
}

function Popup({ snapshot }: { snapshot: Snapshot }) {
  // The popup stays loaded in the background, so it keeps the milestone plan current.
  useMilestonePlan(snapshot);
  return (
    <div className="popup">
      <div className="popup__scene">
        <Suspense fallback={<div className="scene-fallback" />}>
          <StationView
            compact
            seed={snapshot.seed}
            buildPoints={snapshot.buildPoints}
            mode={snapshot.mode}
            upgradePoints={snapshot.upgradePoints}
            upgradeLog={snapshot.upgradeLog}
            damage={snapshot.damage}
            aliens={snapshot.aliens.length}
          />
        </Suspense>
        <header className="popup__bar">
          <span className="wordmark">Deep Space</span>
          <div className="popup__actions">
            <button
              type="button"
              className="icon-button icon-button--glass"
              onClick={() => void (snapshot.paused ? api.resume() : api.pause(null))}
              aria-label={snapshot.paused ? "Resume tracking" : "Pause tracking"}
              title={snapshot.paused ? "Resume tracking" : "Pause tracking"}
            >
              {snapshot.paused ? "▶" : "❚❚"}
            </button>
            <button
              type="button"
              className="icon-button icon-button--glass"
              onClick={() => void api.openMain()}
              aria-label="Open the full view"
              title="Open the full view"
            >
              ⤢
            </button>
          </div>
        </header>
        <StationChips snapshot={snapshot} />
      </div>
      <div className="popup__body">
        <BuildStatus snapshot={snapshot} />
        <NextStop snapshot={snapshot} />
        <NowCard snapshot={snapshot} />
        <TodayBar snapshot={snapshot} />
      </div>
    </div>
  );
}
