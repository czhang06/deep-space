const fs = require("node:fs");
const path = require("node:path");

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
  return targetPath;
}

function readJson(filePath, fallbackValue) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallbackValue;
    }

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallbackValue;
  }
}

class PersistenceService {
  constructor(rootPath) {
    this.rootPath = ensureDir(rootPath);
    this.stateFilePath = path.join(this.rootPath, "kingdom-state.json");
    this.activityLogPath = path.join(this.rootPath, "activity-log.json");
    this.browserEventLogPath = path.join(this.rootPath, "browser-event-log.json");
    this.rulesFilePath = path.join(this.rootPath, "classification-rules.json");
  }

  loadState() {
    return readJson(this.stateFilePath, null);
  }

  loadActivityLog() {
    return readJson(this.activityLogPath, []);
  }

  loadBrowserEventLog() {
    return readJson(this.browserEventLogPath, []);
  }

  loadRules() {
    return readJson(this.rulesFilePath, []);
  }

  saveState(state) {
    fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), "utf8");
  }

  appendActivity(entry) {
    const existing = this.loadActivityLog();
    const next = [entry, ...existing].slice(0, 250);
    fs.writeFileSync(this.activityLogPath, JSON.stringify(next, null, 2), "utf8");
  }

  appendBrowserEvent(entry) {
    const existing = this.loadBrowserEventLog();
    const next = [entry, ...existing].slice(0, 100);
    fs.writeFileSync(this.browserEventLogPath, JSON.stringify(next, null, 2), "utf8");
  }

  saveRules(rules) {
    fs.writeFileSync(this.rulesFilePath, JSON.stringify(rules, null, 2), "utf8");
  }
}

module.exports = {
  PersistenceService
};
