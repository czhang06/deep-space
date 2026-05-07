const BRIDGE_URL = "http://127.0.0.1:38471/browser-event";
const HEARTBEAT_ALARM = "tiny-kingdom-heartbeat";

const workDomains = [
  "github.com",
  "docs.github.com",
  "stackoverflow.com",
  "chat.openai.com",
  "openai.com",
  "developer.mozilla.org",
  "docs.microsoft.com",
  "learn.microsoft.com",
  "notion.so",
  "figma.com",
  "linear.app",
  "atlassian.net"
];

const playDomains = [
  "youtube.com",
  "twitch.tv",
  "reddit.com",
  "x.com",
  "twitter.com",
  "netflix.com",
  "spotify.com"
];

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function categorizeDomain(domain) {
  if (!domain) {
    return "unknown";
  }

  if (workDomains.some((entry) => domain === entry || domain.endsWith(`.${entry}`))) {
    return "work";
  }

  if (playDomains.some((entry) => domain === entry || domain.endsWith(`.${entry}`))) {
    return "play";
  }

  return "unknown";
}

async function postTabEvent(tab) {
  const domain = domainFromUrl(tab.url);
  const payload = {
    title: tab.title ?? "",
    url: tab.url ?? "",
    domain,
    category: categorizeDomain(domain),
    browserName: "chrome",
    sentAt: new Date().toISOString()
  };

  try {
    await fetch(BRIDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // Ignore bridge failures until the desktop app is running.
  }
}

async function pushActiveTab(tabId) {
  if (!tabId || tabId < 0) {
    return;
  }

  const tab = await chrome.tabs.get(tabId);

  if (!tab.active || !tab.url?.startsWith("http")) {
    return;
  }

  await postTabEvent(tab);
}

async function pushLastFocusedActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });

  const tab = tabs[0];

  if (!tab?.id || !tab.url?.startsWith("http")) {
    return;
  }

  await postTabEvent(tab);
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await pushActiveTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.active) {
    return;
  }

  if (changeInfo.status === "complete" || changeInfo.url || changeInfo.title) {
    await postTabEvent(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return;
  }

  await pushLastFocusedActiveTab();
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(HEARTBEAT_ALARM, {
    periodInMinutes: 0.5
  });

  await pushLastFocusedActiveTab();
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create(HEARTBEAT_ALARM, {
    periodInMinutes: 0.5
  });

  await pushLastFocusedActiveTab();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) {
    return;
  }

  await pushLastFocusedActiveTab();
});
