import { useEffect, useRef, useState } from "react";
import { api, isPreview } from "../bridge.ts";
import type { Snapshot } from "../types.ts";
import { CATEGORY_LABEL, formatMinutes } from "./parts.tsx";

function pauseLabel(snapshot: Snapshot) {
  if (!snapshot.paused) {
    return "Tracking is on.";
  }
  if (snapshot.pausedUntil === -1 || snapshot.pausedUntil === null) {
    return "Paused until you resume.";
  }
  return `Paused until ${new Date(snapshot.pausedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
}

export function PrivacyNotice() {
  return (
    <div className="privacy">
      <p>
        Tiny Kingdom runs entirely on this computer. It has no account, sends nothing over the internet, and contains
        no analytics.
      </p>
      <h4>What it looks at</h4>
      <ul>
        <li>Which app is in front, every 2 seconds.</li>
        <li>For browsers, the site name at the end of the tab title (for example "YouTube").</li>
        <li>How long since you last touched the mouse or keyboard. It never sees what you type or click.</li>
      </ul>
      <h4>What it keeps</h4>
      <ul>
        <li>Minutes per day of work, play, break and neutral time, for the last 60 days.</li>
        <li>Minutes per app or recognised site per day. Unrecognised sites are grouped as "Other sites".</li>
        <li>Your rules, your settings, and the station's progress.</li>
      </ul>
      <h4>What it never keeps</h4>
      <ul>
        <li>Window or tab titles, page addresses, screenshots, keystrokes or file names.</li>
      </ul>
      <p className="privacy__small">
        Everything is stored in one file, <code>kingdom.json</code>, in your Windows app data folder. "Clear history"
        deletes the daily records; uninstalling the app and deleting that folder removes everything.
      </p>
    </div>
  );
}

export function Settings({ snapshot, onClose }: { snapshot: Snapshot; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [allowance, setAllowance] = useState(snapshot.settings.playAllowanceMinutes);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <aside className="sheet" ref={panel} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="sheet__head">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <section className="sheet__section">
          <h3>Tracking</h3>
          <p className="muted">{pauseLabel(snapshot)}</p>
          <div className="button-row">
            {snapshot.paused ? (
              <button type="button" className="button button--primary" onClick={() => void api.resume()}>
                Resume tracking
              </button>
            ) : (
              <>
                <button type="button" className="button" onClick={() => void api.pause(30)}>
                  Pause 30 min
                </button>
                <button type="button" className="button" onClick={() => void api.pause(60)}>
                  Pause 1 hour
                </button>
                <button type="button" className="button" onClick={() => void api.pause(null)}>
                  Pause until I resume
                </button>
              </>
            )}
          </div>
        </section>

        <section className="sheet__section">
          <h3>Startup</h3>
          <label className="toggle">
            <input
              type="checkbox"
              checked={snapshot.settings.openAtLogin}
              onChange={(event) => void api.setOpenAtLogin(event.target.checked)}
            />
            <span>Start Tiny Kingdom when Windows starts</span>
          </label>
          <p className="muted">It opens quietly in the system tray, by the clock.</p>
        </section>

        <section className="sheet__section">
          <h3>Free play time</h3>
          <p className="muted">
            Play up to <b>{formatMinutes(allowance)}</b> a day before aliens start latching on.
          </p>
          <input
            className="slider"
            type="range"
            min={0}
            max={240}
            step={15}
            value={allowance}
            aria-label="Free play minutes per day"
            onChange={(event) => setAllowance(Number(event.target.value))}
            onPointerUp={() => void api.setPlayAllowance(allowance)}
            onKeyUp={() => void api.setPlayAllowance(allowance)}
          />
        </section>

        <section className="sheet__section">
          <h3>Your rules</h3>
          {snapshot.rules.length === 0 ? (
            <p className="muted">None yet. Use the Work / Play / Neutral buttons when something is counted wrong.</p>
          ) : (
            <ul className="rules">
              {snapshot.rules.map((rule) => (
                <li key={rule.id}>
                  <span>
                    <b>{rule.pattern}</b>
                    <small>{rule.targetType === "site" ? "site" : "app"}</small>
                  </span>
                  <span className={`pill tone-${rule.category}`}>{CATEGORY_LABEL[rule.category]}</span>
                  <button type="button" className="icon-button" aria-label={`Remove rule for ${rule.pattern}`} onClick={() => void api.deleteRule(rule.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sheet__section">
          <h3>Privacy</h3>
          <PrivacyNotice />
          <div className="button-row">
            {confirmClear ? (
              <>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    void api.clearHistory();
                    setConfirmClear(false);
                  }}
                >
                  Yes, delete daily history
                </button>
                <button type="button" className="button" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="button" onClick={() => setConfirmClear(true)}>
                Clear history
              </button>
            )}
            {!isPreview ? (
              <button type="button" className="button" onClick={() => void api.openDataFolder()}>
                Show data folder
              </button>
            ) : null}
          </div>
          <p className="muted">Clearing history keeps your station and rules.</p>
        </section>
      </aside>
    </>
  );
}
