const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

class StaticFileServer {
  constructor({ rootDir, host = "127.0.0.1", port = 38470 }) {
    this.rootDir = rootDir;
    this.host = host;
    this.port = port;
    this.server = null;
  }

  start() {
    if (this.server) {
      return;
    }

    this.server = http.createServer((request, response) => {
      const requestPath = request.url === "/" ? "/index.html" : request.url || "/index.html";
      const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
      const filePath = path.join(this.rootDir, safePath);

      if (!filePath.startsWith(this.rootDir)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      fs.readFile(filePath, (error, fileBuffer) => {
        if (error) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
          "Content-Type": mimeTypes[ext] || "application/octet-stream",
          "Cache-Control": "no-store"
        });
        response.end(fileBuffer);
      });
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

  get url() {
    return `http://${this.host}:${this.port}`;
  }
}

module.exports = {
  StaticFileServer
};
