// Publishes this version as a GitHub release, which installed copies then update to.
//
// GitHub only accepts a published release for a tag that already exists, so this tags the
// current commit as v<version> (from package.json) and pushes that tag first, then has
// electron-builder build the installer and upload it with latest.yml. Run through
// `npm run release`, which checks, tests and builds before getting here.
//
// Needs GH_TOKEN in the environment: a GitHub token that can write this repo's contents.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const fail = (message) => {
  console.error(`\nrelease: ${message}\n`);
  process.exit(1);
};
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

if (!process.env.GH_TOKEN) {
  fail('GH_TOKEN is not set. In PowerShell: $env:GH_TOKEN = "<your token>", then run npm run release again.');
}

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tag = `v${version}`;

// The tag should point at exactly the code being released.
if (git("status", "--porcelain")) {
  fail("there are uncommitted changes. Commit them first, so the release matches its tag.");
}

const localTag = git("tag", "--list", tag);
if (localTag) {
  const tagged = git("rev-list", "-n", "1", tag);
  if (tagged !== git("rev-parse", "HEAD")) {
    fail(`${tag} already exists on another commit. Bump "version" in package.json for a new release.`);
  }
} else {
  git("tag", "-a", tag, "-m", `Deep Space ${version}`);
  console.log(`release: tagged ${tag}`);
}

if (!git("ls-remote", "--tags", "origin", `refs/tags/${tag}`)) {
  execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
  console.log(`release: pushed ${tag}`);
}

execFileSync("npx", ["electron-builder", "--win", "--publish", "always"], { stdio: "inherit", shell: process.platform === "win32" });
console.log(`\nrelease: published ${tag}. Installed copies pick it up within a few hours, or with Settings > Updates > Check now.`);
