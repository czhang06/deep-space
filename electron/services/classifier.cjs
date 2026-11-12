// Turns "what's in the foreground right now" into work / play / neutral.
//
// Order of precedence:
//   1. the user's own rules (set with one click from the tray popup)
//   2. curated app list (exact process names)
//   3. game install folders (Steam, Epic, Riot, ...)
//   4. curated site list, matched against the site name browsers put in the tab title
//   5. neutral
//
// Window titles are only inspected here, in memory. Nothing in this file writes to disk.

const BROWSERS = {
  chrome: "Chrome",
  msedge: "Edge",
  brave: "Brave",
  firefox: "Firefox",
  opera: "Opera",
  opera_gx: "Opera GX",
  vivaldi: "Vivaldi",
  arc: "Arc",
  zen: "Zen"
};

// Exact process names (lowercase, no .exe).
const APPS = {
  work: [
    "code", "code - insiders", "cursor", "windsurf", "zed", "devenv", "idea64", "pycharm64",
    "webstorm64", "rider64", "clion64", "goland64", "datagrip64", "phpstorm64", "rustrover64",
    "studio64", "sublime_text", "notepad++", "windowsterminal", "wt", "powershell", "pwsh", "cmd",
    "wezterm-gui", "alacritty", "gitkraken", "githubdesktop", "postman", "insomnia", "figma",
    "notion", "obsidian", "winword", "excel", "powerpnt", "onenote", "acrobat", "blender",
    "unity", "unrealeditor", "godot", "docker desktop", "claude", "matlab", "rstudio", "tableau"
  ],
  play: [
    "steam", "steamwebhelper", "epicgameslauncher", "battle.net", "riotclientux",
    "leagueclientux", "league of legends", "valorant-win64-shipping", "robloxplayerbeta",
    "fortniteclient-win64-shipping", "cs2", "dota2", "overwatch", "genshinimpact",
    "minecraft.windows", "minecraftlauncher", "netflix", "xboxpcapp", "gamebar"
  ],
  // Explicitly neutral so they never get guessed at. Music and chat are fine during work.
  neutral: [
    "spotify", "discord", "slack", "teams", "ms-teams", "outlook", "olk", "zoom", "whatsapp",
    "telegram", "explorer", "taskmgr", "systemsettings", "applicationframehost", "searchhost",
    "shellexperiencehost", "startmenuexperiencehost", "vlc", "obs64", "snippingtool"
  ]
};

const GAME_FOLDERS = [
  "\\steamapps\\common\\",
  "\\epic games\\",
  "\\riot games\\",
  "\\xboxgames\\",
  "\\gog galaxy\\games\\",
  "\\ubisoft game launcher\\games\\",
  "\\battle.net\\"
];

// Site names as they appear as a segment of a tab title, e.g. "Some video - YouTube".
// Matching is on whole segments, never substrings, so "docs" inside a title can't trigger work.
const SITES = [
  { label: "YouTube", category: "play", names: ["youtube"] },
  { label: "Twitch", category: "play", names: ["twitch"] },
  { label: "Netflix", category: "play", names: ["netflix"] },
  { label: "Disney+", category: "play", names: ["disney+"] },
  { label: "Prime Video", category: "play", names: ["prime video", "amazon prime video"] },
  { label: "Hulu", category: "play", names: ["hulu"] },
  { label: "Crunchyroll", category: "play", names: ["crunchyroll"] },
  { label: "Reddit", category: "play", names: ["reddit"] },
  { label: "X", category: "play", names: ["x", "twitter"] },
  { label: "Instagram", category: "play", names: ["instagram"] },
  { label: "TikTok", category: "play", names: ["tiktok"] },
  { label: "Facebook", category: "play", names: ["facebook"] },
  { label: "Steam", category: "play", names: ["steam", "steam community"] },
  { label: "9GAG", category: "play", names: ["9gag"] },
  { label: "GitHub", category: "work", names: ["github"] },
  { label: "GitLab", category: "work", names: ["gitlab"] },
  { label: "Stack Overflow", category: "work", names: ["stack overflow"] },
  { label: "MDN", category: "work", names: ["mdn", "mdn web docs"] },
  { label: "Google Docs", category: "work", names: ["google docs"] },
  { label: "Google Sheets", category: "work", names: ["google sheets"] },
  { label: "Google Slides", category: "work", names: ["google slides"] },
  { label: "Notion", category: "work", names: ["notion"] },
  { label: "Figma", category: "work", names: ["figma"] },
  { label: "Linear", category: "work", names: ["linear"] },
  { label: "Jira", category: "work", names: ["jira"] },
  { label: "Confluence", category: "work", names: ["confluence"] },
  { label: "Claude", category: "work", names: ["claude"] },
  { label: "ChatGPT", category: "work", names: ["chatgpt"] },
  { label: "LeetCode", category: "work", names: ["leetcode"] },
  { label: "Overleaf", category: "work", names: ["overleaf", "overleaf, online latex editor"] },
  { label: "Vercel", category: "work", names: ["vercel"] },
  { label: "AWS", category: "work", names: ["aws management console"] },
  { label: "Gmail", category: "neutral", names: ["gmail"] },
  { label: "LinkedIn", category: "neutral", names: ["linkedin"] },
  { label: "Wikipedia", category: "neutral", names: ["wikipedia"] },
  { label: "Google Search", category: "neutral", names: ["google search"] },
  { label: "Amazon", category: "neutral", names: ["amazon.com"] }
];

const CATEGORIES = ["work", "play", "neutral"];

const appIndex = new Map();
for (const category of CATEGORIES) {
  for (const name of APPS[category]) {
    appIndex.set(name, category);
  }
}

const siteIndex = new Map();
for (const site of SITES) {
  for (const name of site.names) {
    siteIndex.set(name, site);
  }
}

function normalize(value) {
  return String(value ?? "")
    .replace(/[​-‏⁠﻿]/g, "") // Edge puts a zero-width space in its name
    .trim()
    .toLowerCase();
}

function prettifyProcess(processName) {
  const clean = String(processName ?? "").replace(/[_-]+/g, " ").trim();
  if (!clean) {
    return "Unknown app";
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// "Video title - YouTube - Google Chrome" -> "Video title - YouTube"
function stripBrowserSuffix(title) {
  return String(title ?? "")
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(
      /\s+[-–—]\s+(?:google chrome|microsoft edge|brave|mozilla firefox|firefox|opera|vivaldi|arc|zen browser)\s*$/i,
      ""
    )
    .replace(/\s+and \d+ more pages?$/i, "")
    .trim();
}

// Split a tab title into its separated parts. "/" only counts with spaces around it ("Home / X").
function titleSegments(title) {
  return title
    .replace(/^\(\d+\+?\)\s*/, "") // unread counters like "(3) "
    .split(/\s+[-–—|·•:]\s+|\s+\/\s+/)
    .map((segment) => normalize(segment))
    .filter(Boolean);
}

/**
 * Works out which site a browser tab is on from its title.
 * Returns { key, label, category, ruleId }; category is null when the site isn't recognized.
 */
function readSite(windowTitle, processName = "", rules = []) {
  const segments = titleSegments(stripBrowserSuffix(windowTitle));

  // The user's own site rules win, wherever the name sits in the title.
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const rule = matchRule(rules, "site", segments[index]);
    if (rule) {
      const known = siteIndex.get(segments[index]);
      return {
        key: rule.pattern,
        label: known?.label ?? titleCase(rule.pattern),
        category: rule.category,
        ruleId: rule.id
      };
    }
  }

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const site = siteIndex.get(segments[index]);
    if (site) {
      return { key: site.names[0], label: site.label, category: site.category, ruleId: null };
    }
  }

  // Edge shows the profile name before its own: "Page - Site - Personal - Microsoft Edge".
  if (processName === "msedge" && segments.length >= 3) {
    segments.pop();
  }

  // Most sites put their own name last. Only trust that when the title actually has parts,
  // otherwise "the last part" is the page title itself.
  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    if (last.length <= 32) {
      return { key: last, label: titleCase(last), category: null, ruleId: null };
    }
  }

  // Pages like "New Tab" or "Netflix" that are just a short name.
  if (segments.length === 1 && segments[0].length <= 24) {
    return { key: segments[0], label: titleCase(segments[0]), category: null, ruleId: null };
  }

  return { key: "", label: "", category: null, ruleId: null };
}

function titleCase(value) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function matchRule(rules, targetType, key) {
  if (!key) {
    return null;
  }
  return rules.find((rule) => rule.targetType === targetType && rule.pattern === key) ?? null;
}

/**
 * @param {{ processName?: string, appName?: string, windowTitle?: string, exePath?: string }} sample
 * @param {Array<{ id: string, targetType: "app" | "site", pattern: string, category: string }>} rules
 */
function classify(sample, rules = []) {
  const processName = normalize(sample?.processName);
  const exePath = normalize(sample?.exePath);
  const appLabel = String(sample?.appName || "").trim() || prettifyProcess(processName);

  if (!processName) {
    return {
      category: "neutral",
      source: "none",
      app: { key: "", label: "Nothing in focus" },
      site: null,
      display: "Nothing in focus"
    };
  }

  const app = { key: processName, label: appLabel };
  const isBrowser = Object.prototype.hasOwnProperty.call(BROWSERS, processName);

  if (isBrowser) {
    app.label = BROWSERS[processName];
    const site = readSite(sample?.windowTitle, processName, rules);
    const siteRef = site.key ? { key: site.key, label: site.label } : null;
    const appRule = matchRule(rules, "app", processName);

    if (site.category) {
      return result(site.category, site.ruleId ? "your rule" : "known site", app, siteRef);
    }
    if (appRule) {
      return result(appRule.category, "your app rule", app, siteRef);
    }
    return result("neutral", siteRef ? "unrecognized site" : "browser", app, siteRef);
  }

  const appRule = matchRule(rules, "app", processName);
  if (appRule) {
    return result(appRule.category, "your rule", app, null);
  }

  const known = appIndex.get(processName);
  if (known) {
    return result(known, "known app", app, null);
  }

  if (exePath && GAME_FOLDERS.some((folder) => exePath.includes(folder))) {
    return result("play", "game folder", app, null);
  }

  return result("neutral", "unrecognized app", app, null);
}

function result(category, source, app, site) {
  return {
    category,
    source,
    app,
    site,
    display: site?.label ? `${site.label} · ${app.label}` : app.label
  };
}

// The label to store in daily stats. Unrecognized sites are bucketed so page titles never hit disk.
function statLabel(classification) {
  const { site, app, source } = classification;
  if (site) {
    const trusted = source === "known site" || source === "your rule";
    return trusted ? site.label : `Other sites in ${app.label}`;
  }
  return app.label;
}

module.exports = {
  BROWSERS,
  CATEGORIES,
  classify,
  readSite,
  statLabel,
  stripBrowserSuffix
};
