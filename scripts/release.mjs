// Publishes this version as a GitHub release, which installed copies then update to.
//
//   1. Tags the current commit v<version> (from package.json) and pushes the tag: GitHub only
//      publishes releases for tags that already exist.
//   2. Creates the release as a draft, so electron-builder never has to create it. (It can race
//      itself doing that and leave a half-made release behind.)
//   3. Has electron-builder build the installer and upload it with latest.yml into the draft.
//   4. Checks the draft has everything an update needs, then publishes it.
//
// Run through `npm run release`, which checks, tests and builds first. Needs GH_TOKEN: a GitHub
// token that can write this repo's contents.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const OWNER = "czhang06";
const REPO = "deep-space";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

const fail = (message) => {
  console.error(`\nrelease: ${message}\n`);
  process.exit(1);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const token = process.env.GH_TOKEN;
if (!token) {
  fail('GH_TOKEN is not set. In PowerShell: $env:GH_TOKEN = "<your token>", then run npm run release again.');
}

async function github(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    fail(`GitHub said ${response.status} to ${method} ${path}: ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tag = `v${version}`;
const installer = `Deep-Space-Setup-${version}.exe`;

// ---- 1. tag ------------------------------------------------------------------------------
if (git("status", "--porcelain")) {
  fail("there are uncommitted changes. Commit them first, so the release matches its tag.");
}
const head = git("rev-parse", "HEAD");
const remoteTag = git("ls-remote", "--tags", "origin", `refs/tags/${tag}^{}`) || git("ls-remote", "--tags", "origin", `refs/tags/${tag}`);
if (remoteTag && !remoteTag.startsWith(head)) {
  fail(`${tag} already exists on GitHub for a different commit. Bump "version" in package.json for a new release.`);
}
if (!git("tag", "--list", tag)) {
  git("tag", "-a", tag, "-m", `Deep Space ${version}`);
  console.log(`release: tagged ${tag}`);
} else if (git("rev-list", "-n", "1", tag) !== head) {
  fail(`the local tag ${tag} points at a different commit. Bump "version" in package.json for a new release.`);
}
if (!remoteTag) {
  execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
  console.log(`release: pushed ${tag}`);
}

// ---- 2. draft ----------------------------------------------------------------------------
const releases = await github("GET", "/releases?per_page=100");
let release = releases.find((candidate) => candidate.tag_name === tag);
if (release && !release.draft) {
  fail(
    `a published release for ${tag} already exists (https://github.com/${OWNER}/${REPO}/releases/tag/${tag}). ` +
      'If it is incomplete, delete it on GitHub and run this again; otherwise bump "version" in package.json.'
  );
}
if (!release) {
  release = await github("POST", "/releases", { tag_name: tag, name: version, draft: true, generate_release_notes: true });
  console.log(`release: created draft ${tag}`);
}

// ---- 3. upload ---------------------------------------------------------------------------
// Without npm's "release" lifecycle name, electron-builder publishes once, as asked, instead of
// also publishing implicitly; package.json sets releaseType "draft", so it uploads into the
// draft above.
const env = { ...process.env };
delete env.npm_lifecycle_event;
execFileSync("npx", ["electron-builder", "--win", "--publish", "always"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32"
});

// ---- 4. check and publish ----------------------------------------------------------------
const uploaded = (await github("GET", `/releases/${release.id}`)).assets.map((asset) => asset.name);
const missing = ["latest.yml", installer, `${installer}.blockmap`].filter((name) => !uploaded.includes(name));
if (missing.length) {
  fail(`the draft is missing ${missing.join(", ")}, so it was left unpublished. Run npm run release again to retry the upload.`);
}
await github("PATCH", `/releases/${release.id}`, { draft: false, make_latest: "true" });
console.log(`\nrelease: published ${tag}. Installed copies pick it up within a few hours, or with Settings > Updates > Check now.`);
