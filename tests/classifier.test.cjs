const test = require("node:test");
const assert = require("node:assert/strict");
const { classify, statLabel } = require("../electron/services/classifier.cjs");

const chrome = (title) => ({ processName: "chrome", appName: "Google Chrome", windowTitle: `${title} - Google Chrome` });

test("music and chat apps are neutral, not play", () => {
  assert.equal(classify({ processName: "Spotify", windowTitle: "Daft Punk - One More Time" }).category, "neutral");
  assert.equal(classify({ processName: "Discord", windowTitle: "#general | My Server - Discord" }).category, "neutral");
});

test("editors and terminals are work", () => {
  assert.equal(classify({ processName: "Code", windowTitle: "app.ts - tiny-kingdom - Visual Studio Code" }).category, "work");
  assert.equal(classify({ processName: "WindowsTerminal", windowTitle: "PowerShell" }).category, "work");
});

test("a stray word in a title doesn't decide the category", () => {
  // The old classifier matched "docs" anywhere in a title.
  assert.equal(classify({ processName: "notepad", windowTitle: "groceries and docs to print.txt - Notepad" }).category, "neutral");
  assert.equal(classify(chrome("Why the docs are wrong - Some Blog")).category, "neutral");
  // "YouTube" mentioned in a page title isn't YouTube.
  assert.equal(classify(chrome("How to download YouTube videos - Stack Overflow")).category, "work");
});

test("browser tabs are classified by the site name in the title", () => {
  assert.equal(classify(chrome("lofi hip hop radio - YouTube")).category, "play");
  assert.equal(classify(chrome("(3) YouTube")).category, "play");
  assert.equal(classify(chrome("GitHub - czhang06/deep-space: a space station")).category, "work");
  assert.equal(classify(chrome("Quarterly plan - Google Docs")).category, "work");
  assert.equal(classify(chrome("(12) Home / X")).category, "play");
  assert.equal(classify(chrome("r/programming - Reddit")).category, "play");
});

test("Edge titles with a profile name and zero-width space still work", () => {
  const sample = {
    processName: "msedge",
    windowTitle: "lofi beats - YouTube - Personal - Microsoft\u200b Edge"
  };
  const result = classify(sample);
  assert.equal(result.category, "play");
  assert.equal(result.site.label, "YouTube");
});

test("unknown sites are neutral and expose the site name for a one-click rule", () => {
  const result = classify(chrome("Some article title - The Verge"));
  assert.equal(result.category, "neutral");
  assert.equal(result.site.key, "the verge");
});

test("user rules win over the built-in lists", () => {
  const rules = [
    { id: "1", targetType: "site", pattern: "youtube", category: "work" },
    { id: "2", targetType: "app", pattern: "discord", category: "play" },
    { id: "3", targetType: "site", pattern: "the verge", category: "play" }
  ];
  assert.equal(classify(chrome("Lecture 4: Graphs - YouTube"), rules).category, "work");
  assert.equal(classify({ processName: "Discord", windowTitle: "Discord" }, rules).category, "play");
  assert.equal(classify(chrome("Some article - The Verge"), rules).category, "play");
});

test("games are detected by their install folder", () => {
  const sample = {
    processName: "SomeIndieGame",
    exePath: "D:\\SteamLibrary\\steamapps\\common\\Some Indie Game\\SomeIndieGame.exe",
    windowTitle: "Some Indie Game"
  };
  assert.equal(classify(sample).category, "play");
});

test("stats never store a page title for unrecognized sites", () => {
  const result = classify(chrome("My bank statement - Example Bank Online"));
  assert.equal(statLabel(result), "Other sites in Chrome");
  assert.equal(statLabel(classify(chrome("video - YouTube"))), "YouTube");
});
