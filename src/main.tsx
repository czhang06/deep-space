import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

// One build serves both windows: index.html#popup for the tray popup, anything else for the main window.
const isPopup = window.location.hash === "#popup";
document.documentElement.dataset.view = isPopup ? "popup" : "main";

async function boot() {
  const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
  try {
    const { default: App } = isPopup ? await import("./ui/PopupApp.tsx") : await import("./ui/MainApp.tsx");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    root.render(
      <pre className="boot-error">{error instanceof Error ? error.stack ?? error.message : String(error)}</pre>
    );
  }
}

void boot();
