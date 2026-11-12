import { Suspense, lazy, useState } from "react";
import { isPreview, useSnapshot } from "../bridge.ts";
import { BuildStatus, LatestEvent, NowCard, StationChips, TodayBar } from "./parts.tsx";
import { Settings } from "./Settings.tsx";

const StationView = lazy(() => import("../station/StationView.tsx"));

/** The full window: the station fills it, with a few quiet cards on top. */
export default function MainApp() {
  const snapshot = useSnapshot();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!snapshot) {
    return <main className="main main--loading" />;
  }
  return (
    <main className="main">
      <div className="main__scene">
        <Suspense fallback={<div className="scene-fallback" />}>
          <StationView
            seed={snapshot.seed}
            buildPoints={snapshot.buildPoints}
            mode={snapshot.mode}
            upgradePoints={snapshot.upgradePoints}
            upgradeLog={snapshot.upgradeLog}
            damage={snapshot.damage}
            aliens={snapshot.aliens.length}
          />
        </Suspense>
      </div>

      <header className="main__top">
        <div className="card card--title">
          <span className="wordmark wordmark--large">Deep Space</span>
          <StationChips snapshot={snapshot} />
        </div>
        <button type="button" className="icon-button icon-button--glass icon-button--large" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
          ⚙
        </button>
      </header>

      <div className="main__cards">
        <div className="card">
          <BuildStatus snapshot={snapshot} />
          <LatestEvent snapshot={snapshot} />
        </div>
        <div className="card">
          <NowCard snapshot={snapshot} />
        </div>
        <div className="card">
          <TodayBar snapshot={snapshot} detailed />
        </div>
      </div>

      {isPreview ? <p className="preview-note">Browser preview with sample data</p> : null}
      {settingsOpen ? <Settings snapshot={snapshot} onClose={() => setSettingsOpen(false)} /> : null}
    </main>
  );
}
