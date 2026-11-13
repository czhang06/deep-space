import { Suspense, lazy, useEffect, useState } from "react";
import { api, isPreview, useSnapshot } from "../bridge.ts";
import type { Snapshot } from "../types.ts";
import { Logbook } from "./Logbook.tsx";
import { Recap } from "./Recap.tsx";
import { BuildStatus, LatestEvent, NextStop, NowCard, StationChips, TodayBar, useMilestonePlan } from "./parts.tsx";
import { ModulePanel } from "./ModulePanel.tsx";
import { Settings } from "./Settings.tsx";

const StationView = lazy(() => import("../station/StationView.tsx"));

/** The full window: the station fills it, with a few quiet cards on top. */
export default function MainApp() {
  const snapshot = useSnapshot();
  if (!snapshot) {
    return <main className="main main--loading" />;
  }
  return <Main snapshot={snapshot} />;
}

function Main({ snapshot }: { snapshot: Snapshot }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Preview knob (?logbook) opens the logbook straight away.
  const [logbookOpen, setLogbookOpen] = useState(() => isPreview && new URLSearchParams(window.location.search).has("logbook"));
  // Preview knob (?recap) opens the weekly recap straight away.
  const [recapOpen, setRecapOpen] = useState(() => isPreview && new URLSearchParams(window.location.search).has("recap"));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useMilestonePlan(snapshot);
  // A milestone or weekly recap notification was clicked.
  useEffect(() => api.onOpenLogbook?.(() => setLogbookOpen(true)), []);
  useEffect(() => api.onOpenRecap?.(() => setRecapOpen(true)), []);
  // Preview knob (?bare): just the ship, no cards, for concept screenshots.
  const bare = isPreview && new URLSearchParams(window.location.search).has("bare");
  return (
    <main className={bare ? "main main--bare" : "main"}>
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
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </Suspense>
      </div>

      {selectedId !== null ? <ModulePanel snapshot={snapshot} pieceId={selectedId} onClose={() => setSelectedId(null)} /> : null}

      <header className="main__top">
        {/* Kept to one slim line with no panel, so the scenery stays visible. */}
        <div className="main__title">
          <span className="wordmark wordmark--large">Deep Space</span>
          <StationChips snapshot={snapshot} />
        </div>
        <div className="main__actions">
          <button type="button" className="button button--glass" onClick={() => setRecapOpen(true)}>
            This week
          </button>
          <button type="button" className="button button--glass" onClick={() => setLogbookOpen(true)}>
            Logbook
          </button>
          <button type="button" className="icon-button icon-button--glass icon-button--large" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
            ⚙
          </button>
        </div>
      </header>

      <div className="main__cards">
        <div className="card">
          <BuildStatus snapshot={snapshot} />
          {snapshot.mode === "upgrade" ? <p className="build__hint">Click any module on the ship to pick what gets upgraded next.</p> : null}
          <NextStop snapshot={snapshot} onOpen={() => setLogbookOpen(true)} />
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
      {logbookOpen ? <Logbook snapshot={snapshot} onClose={() => setLogbookOpen(false)} /> : null}
      {recapOpen ? <Recap snapshot={snapshot} onClose={() => setRecapOpen(false)} /> : null}
    </main>
  );
}
