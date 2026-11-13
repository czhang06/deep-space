import { useEffect, useState } from "react";
import { api } from "../bridge.ts";
import { PIECES } from "../station/catalog.ts";
import { resolveStation } from "../station/generator.ts";
import { MAX_LEVEL, costToMax, resolveUpgrades, upgradeCost } from "../station/upgrades.ts";
import type { Snapshot } from "../types.ts";
import { formatMinutes } from "./parts.tsx";

/** Details for the module you clicked, with a button to upgrade it next. */
export function ModulePanel({ snapshot, pieceId, onClose }: { snapshot: Snapshot; pieceId: number; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const piece = resolveStation(snapshot.seed, snapshot.buildPoints).pieces.find((candidate) => candidate.id === pieceId);
  const upgrades = resolveUpgrades(snapshot.seed, snapshot.upgradeLog, snapshot.upgradePoints);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!piece) {
    return null;
  }

  const name = PIECES[piece.kind].name;
  const level = upgrades.levels.get(piece.id) ?? 1;
  const maxed = level >= MAX_LEVEL;
  const upgrading = snapshot.mode === "upgrade" && upgrades.current?.pieceId === piece.id;
  const picked = upgrades.focusId === piece.id;
  const progress = upgrading ? upgrades.current?.progress ?? 0 : 0;
  const nextCost = maxed ? 0 : upgradeCost(piece.kind, level) * (1 - progress);
  const toMax = maxed ? 0 : costToMax(piece.kind, level) - upgradeCost(piece.kind, level) * progress;

  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await action();
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="card module-panel" aria-label={`${name} details`}>
      <div className="module-panel__head">
        <span className="eyebrow">{piece.id === 0 ? "Flagship" : "Module"}</span>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close module details">
          ✕
        </button>
      </div>
      <strong className="module-panel__name">{name}</strong>
      <div className="pips" aria-label={`Level ${level} of ${MAX_LEVEL}`}>
        {Array.from({ length: MAX_LEVEL }, (_, index) => (
          <span key={index} className={index < level ? "pip is-on" : "pip"} />
        ))}
        <span className="pips__label">
          Lv {level}/{MAX_LEVEL}
        </span>
      </div>

      {maxed ? (
        <p className="muted">Fully upgraded.</p>
      ) : (
        <>
          {upgrading ? (
            <div className="meter" role="progressbar" aria-valuenow={Math.floor(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="meter__fill" style={{ width: `${Math.floor(progress * 100)}%` }} />
            </div>
          ) : null}
          <p className="muted">
            Lv {level + 1} in about {formatMinutes(nextCost)} of focused work; maxed in about {formatMinutes(toMax)}.
          </p>
          {picked ? (
            <div className="button-row">
              <span className="module-panel__status">Upgrading this one first</span>
              <button type="button" className="button" disabled={saving} onClick={() => void run(() => api.setUpgradeFocus(null))}>
                Back to automatic
              </button>
            </div>
          ) : (
            <button type="button" className="button button--primary" disabled={saving} onClick={() => void run(() => api.setUpgradeFocus(piece.id, name))}>
              {upgrading ? "Keep upgrading this one" : "Upgrade this"}
            </button>
          )}
        </>
      )}
    </aside>
  );
}
