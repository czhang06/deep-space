const IDLE_THRESHOLD_SECONDS = 300;
const browserProcesses = new Set([
  "chrome",
  "msedge",
  "brave",
  "firefox",
  "opera",
  "arc"
]);

const workProcesses = new Set([
  "code",
  "cursor",
  "devenv",
  "webstorm64",
  "idea64",
  "pycharm64",
  "notion",
  "figma",
  "obsidian",
  "slack",
  "teams",
  "terminal",
  "windowsterminal",
  "powershell",
  "pwsh",
  "cmd",
  "wezterm",
  "gitkraken",
  "postman",
  "notepad++",
  "excel",
  "winword"
]);

const playProcesses = new Set([
  "steam",
  "epicgameslauncher",
  "discord",
  "leagueclientux",
  "leagueclient",
  "riotclientservices",
  "battle.net",
  "battlenet",
  "obs64",
  "spotify"
]);

const workKeywords = [
  "github",
  "docs",
  "documentation",
  "notion",
  "figma",
  "linear",
  "jira",
  "confluence",
  "stack overflow",
  "stackoverflow",
  "chatgpt",
  "openai",
  "cursor",
  "visual studio code",
  "vscode",
  "pull request",
  "electron",
  "tiny kingdom"
];

const playKeywords = [
  "youtube",
  "twitch",
  "netflix",
  "reddit",
  "twitter",
  "x.com",
  "steam",
  "discord",
  "spotify",
  "hulu",
  "prime video"
];

function normalize(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(needle));
}

function prettifyProcessName(processName) {
  if (!processName) {
    return "Unknown app";
  }

  return processName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function domainMatches(pattern, domain) {
  if (!pattern || !domain) {
    return false;
  }

  return domain === pattern || domain.endsWith(`.${pattern}`);
}

function appMatches(pattern, values) {
  if (!pattern) {
    return false;
  }

  return values.some((value) => normalize(value).includes(pattern));
}

function matchOverrideRule(observation, rules = []) {
  const processName = normalize(observation?.processName);
  const appName = normalize(observation?.appName);
  const windowTitle = normalize(observation?.windowTitle);
  const browserDomain = normalize(observation?.browserDomain);
  const browserTitle = normalize(observation?.browserTitle);

  for (const rule of rules) {
    const pattern = normalize(rule?.pattern);

    if (!pattern) {
      continue;
    }

    if (rule?.targetType === "domain" && domainMatches(pattern, browserDomain)) {
      return rule;
    }

    if (
      rule?.targetType === "app" &&
      appMatches(pattern, [processName, appName, windowTitle, browserTitle])
    ) {
      return rule;
    }
  }

  return null;
}

function classifyObservation(observation, rules = []) {
  const idleSeconds = Number(observation?.idleSeconds ?? 0);
  const processName = normalize(observation?.processName);
  const windowTitle = normalize(observation?.windowTitle);
  const browserCategory = normalize(observation?.browserCategory);
  const browserDomain = normalize(observation?.browserDomain);
  const browserTitle = normalize(observation?.browserTitle);

  if (idleSeconds >= IDLE_THRESHOLD_SECONDS) {
    return {
      category: "idle",
      label: `Idle for ${Math.floor(idleSeconds / 60)} minutes`,
      appName: "System Idle",
      confidence: "high",
      source: "idle-threshold"
    };
  }

  const overrideRule = matchOverrideRule(observation, rules);

  if (overrideRule) {
    return {
      category: overrideRule.category,
      label:
        observation?.browserTitle ||
        observation?.windowTitle ||
        `Matched ${overrideRule.targetType} rule: ${overrideRule.pattern}`,
      appName: observation?.appName || prettifyProcessName(processName),
      confidence: "high",
      source: "override-rule",
      matchedRule: {
        id: overrideRule.id,
        targetType: overrideRule.targetType,
        pattern: overrideRule.pattern,
        category: overrideRule.category
      }
    };
  }

  if (browserProcesses.has(processName) && browserCategory) {
    const category =
      browserCategory === "work" || browserCategory === "play"
        ? browserCategory
        : "unknown";

    return {
      category,
      label:
        observation?.browserTitle ||
        observation?.windowTitle ||
        `Browsing ${observation?.browserDomain || "the web"}`,
      appName: observation?.appName || prettifyProcessName(processName),
      confidence: category === "unknown" ? "low" : "medium",
      source: "browser-bridge"
    };
  }

  if (workProcesses.has(processName) || includesAny(windowTitle, workKeywords)) {
    return {
      category: "work",
      label: observation?.windowTitle || `Working in ${prettifyProcessName(processName)}`,
      appName: observation?.appName || prettifyProcessName(processName),
      confidence: "medium",
      source: "default-work"
    };
  }

  if (playProcesses.has(processName) || includesAny(windowTitle, playKeywords)) {
    return {
      category: "play",
      label: observation?.windowTitle || `Playing in ${prettifyProcessName(processName)}`,
      appName: observation?.appName || prettifyProcessName(processName),
      confidence: "medium",
      source: "default-play"
    };
  }

  if (processName) {
    return {
      category: "unknown",
      label:
        observation?.windowTitle ||
        browserTitle ||
        browserDomain ||
        `Watching ${prettifyProcessName(processName)}`,
      appName: observation?.appName || prettifyProcessName(processName),
      confidence: "low",
      source: "fallback-unknown"
    };
  }

  return {
    category: "unknown",
    label: "Waiting for foreground window",
    appName: "Unknown app",
    confidence: "low",
    source: "waiting"
  };
}

module.exports = {
  IDLE_THRESHOLD_SECONDS,
  classifyObservation
};
