import { useCastleStore } from "../../store/useCastleStore";

function EventPanel() {
  const snapshot = useCastleStore((state) => state.snapshot);

  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Kingdom Log</p>
          <h3>Recent events</h3>
        </div>
      </div>

      <div className="event-list">
        {(snapshot?.eventLog ?? []).map((entry) => (
          <article className="event-card" key={entry}>
            {entry}
          </article>
        ))}
      </div>
    </section>
  );
}

export default EventPanel;
