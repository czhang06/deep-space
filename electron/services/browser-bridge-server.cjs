const http = require("node:http");

class BrowserBridgeServer {
  constructor({ host = "127.0.0.1", port = 38471, onEvent }) {
    this.host = host;
    this.port = port;
    this.onEvent = onEvent;
    this.server = null;
  }

  start() {
    if (this.server) {
      return;
    }

    this.server = http.createServer((request, response) => {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (request.method === "POST" && request.url === "/browser-event") {
        let body = "";
        request.on("data", (chunk) => {
          body += chunk.toString();
        });

        request.on("end", () => {
          try {
            const payload = JSON.parse(body);
            console.log("browser-event", payload);
            this.onEvent?.({
              ...payload,
              receivedAt: new Date().toISOString()
            });
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify({ ok: true }));
          } catch (error) {
            response.writeHead(400, { "Content-Type": "application/json" });
            response.end(
              JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : "Invalid payload"
              })
            );
          }
        });

        return;
      }

      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "Not found" }));
    });

    this.server.listen(this.port, this.host);
  }

  stop() {
    if (!this.server) {
      return;
    }

    this.server.close();
    this.server = null;
  }
}

module.exports = {
  BrowserBridgeServer
};
