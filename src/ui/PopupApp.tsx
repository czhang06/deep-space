import { Suspense, lazy } from "react";
import { api, useSnapshot } from "../bridge.ts";
import { BuildStatus, Kingdomfolk, NowCard, TodayBar } from "./parts.tsx";

const CastleView = lazy(() => import("../castle/CastleView.tsx"));

/** The small window that pops up from the tray icon. */
export default function PopupApp() {
  const snapshot = useSnapshot();
  if (!snapshot) {
    return <div className="popup popup--loading" />;
  }
  return (
    <div className="popup">
      <div className="popup__scene">
        <Suspense fallback={<div className="scene-fallback" />}>
          <CastleView
            compact
            seed={snapshot.seed}
            buildPoints={snapshot.buildPoints}
            damage={snapshot.damage}
            rogues={snapshot.rogues.length}
            builders={snapshot.builders}
          />
        </Suspense>
        <header className="popup__bar">
          <span className="wordmark">Tiny Kingdom</span>
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
              aria-label="Open the full kingdom"
              title="Open the full kingdom"
            >
              ⤢
            </button>
          </div>
        </header>
        <Kingdomfolk snapshot={snapshot} />
      </div>
      <div className="popup__body">
        <BuildStatus snapshot={snapshot} />
        <NowCard snapshot={snapshot} />
        <TodayBar snapshot={snapshot} />
      </div>
    </div>
  );
}
