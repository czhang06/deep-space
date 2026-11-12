const fs = require("node:fs");
const path = require("node:path");

// Files written by the first prototype. They held full window and tab titles, so they're removed.
const LEGACY_FILES = [
  "activity-log.json",
  "browser-event-log.json",
  "kingdom-state.json",
  "classification-rules.json"
];

class Store {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.filePath = path.join(rootPath, "kingdom.json");
    fs.mkdirSync(rootPath, { recursive: true });
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      return null;
    }
  }

  // Write to a temp file and rename, so a crash mid-write can't corrupt the station.
  save(state) {
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state));
    fs.renameSync(tempPath, this.filePath);
  }

  removeLegacyData(legacyDir) {
    const removed = [];
    for (const name of LEGACY_FILES) {
      const target = path.join(legacyDir, name);
      try {
        fs.rmSync(target);
        removed.push(name);
      } catch {
        // Not there; nothing to do.
      }
    }
    return removed;
  }
}

module.exports = { Store };
