import { useCastleStore } from "../../store/useCastleStore";

function SimulationPanel() {
  const meta = useCastleStore((state) => state.meta);
  const snapshot = useCastleStore((state) => state.snapshot);
  const pauseSimulation = useCastleStore((state) => state.pauseSimulation);
  const resumeSimulation = useCastleStore((state) => state.resumeSimulation);
  const alerts = snapshot?.alerts ?? [];

  const handleClick = () => {
    if (snapshot?.isPaused) {
      void resumeSimulation();
      return;
    }

    void pauseSimulation();
  };

  return (
    <section className="panel">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">Command Center</p>
          <h3>Live loop and kingdom advisories</h3>
        </div>
        <div className={`dominant-pill ${snapshot?.isPaused ? "is-paused" : ""}`}>
          {snapshot?.isPaused ? "paused" : "running"}
        </div>
      </div>

      <div className="status-list">
        <div className="status-row">
          <span>Current app</span>
          <strong>{snapshot?.currentAppName ?? "Waiting"}</strong>
        </div>
        <div className="status-row">
          <span>Window title</span>
          <strong>{snapshot?.currentWindowTitle || "No active title"}</strong>
        </div>
        <div className="status-row">
          <span>Current label</span>
          <strong>{snapshot?.currentLabel ?? "Waiting"}</strong>
        </div>
        <div className="status-row">
          <span>Browser category</span>
          <strong>{snapshot?.currentBrowserCategory ?? "unknown"}</strong>
        </div>
        <div className="status-row">
          <span>Simulation tick</span>
          <strong>Every {meta?.cycleSeconds ?? 4}s</strong>
        </div>
        <div className="status-row">
          <span>Tracker status</span>
          <strong>{snapshot?.trackingStatusLabel ?? "Tracker starting"}</strong>
        </div>
        <div className="status-row">
          <span>Tracker detail</span>
          <strong>
            {snapshot?.trackingStatusDetail ??
              "Waiting for the desktop tracker to report its first stable observation."}
          </strong>
        </div>
        <div className="status-row">
          <span>Next project</span>
          <strong>{snapshot?.nextUnlock ?? "Waiting"}</strong>
        </div>
        <div className="status-row">
          <span>Project progress</span>
          <strong>{snapshot?.nextUnlockProgress ?? 0}%</strong>
        </div>
      </div>

      <div className="alert-list">
        {alerts.length === 0 ? (
          <article className="alert-card alert-card--good">
            <strong>Kingdom stable</strong>
            <p>No urgent advisories at the moment.</p>
          </article>
        ) : (
          alerts.map((alert) => (
            <article className={`alert-card alert-card--${alert.severity}`} key={alert.code}>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
            </article>
          ))
        )}
      </div>

      <button className="primary-button" onClick={handleClick} type="button">
        {snapshot?.isPaused ? "Resume simulation" : "Pause simulation"}
      </button>

      <p className="panel-note">
        The kingdom loop now reads local Windows activity directly and falls back
        to mock data only if the probe is unavailable.
      </p>
    </section>
  );
}

export default SimulationPanel;
