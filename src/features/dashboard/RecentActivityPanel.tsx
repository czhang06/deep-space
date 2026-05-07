import { useCastleStore } from "../../store/useCastleStore";

function RecentActivityPanel() {
  const snapshot = useCastleStore((state) => state.snapshot);
  const recentActivity = snapshot?.recentActivity ?? [];

  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Recent Activity</p>
          <h3>Live tracker history</h3>
        </div>
      </div>

      <div className="recent-activity-list">
        {recentActivity.length === 0 ? (
          <article className="event-card">Waiting for tracked activity.</article>
        ) : (
          recentActivity.slice(0, 5).map((entry) => (
            <article className="recent-activity-card" key={`${entry.timestamp}-${entry.appName}`}>
              <div className="recent-activity-card__header">
                <strong>{entry.appName}</strong>
                <span>{entry.timestampLabel ?? "Unknown time"}</span>
              </div>
              <p>{entry.windowTitle || "No active window title recorded."}</p>
              {entry.label ? <p className="recent-activity-card__reason">{entry.label}</p> : null}
              <div className="recent-activity-card__meta">
                <span>{entry.categoryLabel ?? entry.category}</span>
                {entry.browserDomain ? <span>{entry.browserDomain}</span> : null}
                <span>{entry.sourceLabel ?? "Waiting for data"}</span>
                {entry.rulePattern ? <span>Rule {entry.rulePattern}</span> : null}
                <span>Idle {entry.idleSeconds}s</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default RecentActivityPanel;
