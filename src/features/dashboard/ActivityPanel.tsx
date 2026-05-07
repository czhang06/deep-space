import { useCastleStore } from "../../store/useCastleStore";

function formatMinutes(value: number) {
  if (value <= 0) {
    return "0m";
  }

  if (value < 1) {
    return "<1m";
  }

  return `${Math.round(value)}m`;
}

function ActivityPanel() {
  const snapshot = useCastleStore((state) => state.snapshot);

  const activity = snapshot?.activity;
  const totalMinutes = activity
    ? activity.workMinutes +
      activity.playMinutes +
      activity.idleMinutes +
      activity.unknownMinutes
    : 0;

  const slices = activity
    ? [
        { label: "Work", value: activity.workMinutes, tone: "work" },
        { label: "Play", value: activity.playMinutes, tone: "play" },
        { label: "Idle", value: activity.idleMinutes, tone: "idle" },
        { label: "Unknown", value: activity.unknownMinutes, tone: "unknown" }
      ]
    : [];

  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Activity</p>
          <h3>Today's classification</h3>
        </div>
        <div className="dominant-pill">
          {activity?.dominantCategory ?? "loading"}
        </div>
      </div>

      <div className="status-list">
        <div className="status-row">
          <span>Current mode</span>
          <strong>{snapshot?.currentCategory ?? "waiting"}</strong>
        </div>
        <div className="status-row">
          <span>Foreground app</span>
          <strong>{snapshot?.currentAppName ?? "waiting"}</strong>
        </div>
        <div className="status-row">
          <span>Browser domain</span>
          <strong>{snapshot?.currentBrowserDomain || "not in browser"}</strong>
        </div>
        <div className="status-row">
          <span>Idle time</span>
          <strong>{snapshot ? `${snapshot.currentIdleSeconds}s` : "waiting"}</strong>
        </div>
      </div>

      <div className="stacked-bar" aria-hidden="true">
        {slices.map((slice) => (
          <div
            key={slice.label}
            className={`stacked-segment stacked-segment--${slice.tone}`}
            style={{
              width: totalMinutes ? `${(slice.value / totalMinutes) * 100}%` : "0%"
            }}
          />
        ))}
      </div>

      <div className="metric-grid">
        {slices.map((slice) => (
          <article className="metric-card" key={slice.label}>
            <span>{slice.label}</span>
            <strong>{formatMinutes(slice.value)}</strong>
          </article>
        ))}
      </div>

      <p className="panel-note">
        Browser domain tracking is still a future step, but Windows app and idle
        detection can now drive this panel locally.
      </p>
    </section>
  );
}

export default ActivityPanel;
