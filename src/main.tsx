import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/app.css";

function showBootError(message: string, detail?: string) {
  const root = document.getElementById("root");

  if (!root) {
    return;
  }

  root.innerHTML = `
    <main style="min-height:100vh;padding:24px;background:#0f1712;color:#f7f2e8;font-family:Georgia,serif;">
      <section style="max-width:900px;margin:0 auto;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:20px;background:rgba(255,255,255,0.04);">
        <p style="margin:0 0 8px;color:#d4b06f;text-transform:uppercase;letter-spacing:0.12em;font-size:12px;">Tiny Kingdom Boot Error</p>
        <h1 style="margin:0 0 12px;font-size:28px;">${message}</h1>
        <pre style="white-space:pre-wrap;word-break:break-word;background:#0a120d;padding:14px;border-radius:14px;color:#f3d2c9;">${detail ?? ""}</pre>
      </section>
    </main>
  `;
}

window.addEventListener("error", (event) => {
  showBootError("Renderer error", event.error?.stack || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason =
    event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
  showBootError("Unhandled promise rejection", reason);
});

async function boot() {
  try {
    const [{ default: App }] = await Promise.all([import("./App")]);

    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    showBootError(
      "Failed to mount the app",
      error instanceof Error ? error.stack || error.message : String(error)
    );
  }
}

void boot();
