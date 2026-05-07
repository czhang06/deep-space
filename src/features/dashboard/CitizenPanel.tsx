import { useMemo } from "react";
import { useCastleStore } from "../../store/useCastleStore";
import type { CitizenType } from "../../types/models";

const citizenOrder: CitizenType[] = ["builder", "drifter", "rogue"];

function CitizenPanel() {
  const snapshot = useCastleStore((state) => state.snapshot);
  const districts = snapshot?.districts ?? [];
  const citizens = snapshot?.citizens ?? [];

  const counts = useMemo(() => {
    return citizenOrder.map((type) => ({
      type,
      count: citizens.filter((citizen) => citizen.type === type).length
    }));
  }, [citizens]);

  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Districts</p>
          <h3>Settlement health and population</h3>
        </div>
        <div className="progress-chip">
          Next unlock: {snapshot?.nextUnlock ?? "Loading"}
        </div>
      </div>

      <div className="district-list">
        {districts.map((district) => (
          <article className={`district-card district-card--${district.status}`} key={district.id}>
            <div className="district-card__header">
              <strong>{district.name}</strong>
              <span>{district.status}</span>
            </div>
            <p>{district.detail}</p>
          </article>
        ))}
      </div>

      <div className="citizen-list">
        {counts.map((entry) => (
          <article className="citizen-row" key={entry.type}>
            <span className={`citizen-swatch citizen-swatch--${entry.type}`} />
            <div>
              <strong>{entry.type}</strong>
              <p>{entry.count} active in the settlement</p>
            </div>
          </article>
        ))}
      </div>

      <div className="citizen-duty-list">
        {citizens.map((citizen) => (
          <article className="citizen-duty-card" key={citizen.id}>
            <div className="citizen-duty-card__header">
              <span className={`citizen-swatch citizen-swatch--${citizen.type}`} />
              <strong>{citizen.name}</strong>
              <span>{citizen.type}</span>
            </div>
            <p>{citizen.task}</p>
            <div className="citizen-duty-card__meta">
              <span>{citizen.districtId}</span>
              <span>{citizen.mood}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="status-list">
        <div className="status-row">
          <span>Build</span>
          <strong>{snapshot?.buildProgress ?? 0}%</strong>
        </div>
        <div className="status-row">
          <span>Order</span>
          <strong>{snapshot?.order ?? 0}</strong>
        </div>
        <div className="status-row">
          <span>Morale</span>
          <strong>{snapshot?.morale ?? 0}</strong>
        </div>
      </div>

      <div className="unlock-list">
        {(snapshot?.unlockedStructures ?? []).map((structure) => (
          <span className="unlock-pill" key={structure}>
            {structure}
          </span>
        ))}
      </div>
    </section>
  );
}

export default CitizenPanel;
