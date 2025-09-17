#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const type = process.argv[2];
if (!["patch", "minor", "major"].includes(type)) {
  console.error("Usage: node version-bump.js [patch|minor|major]");
  process.exit(1);
}

// Read current version
const versionFile = path.join(__dirname, "..", "VERSION");
const currentVersion = fs.readFileSync(versionFile, "utf8").trim();
const [major, minor, patch] = currentVersion.split(".").map(Number);

// Calculate new version
let newVersion;
switch (type) {
  case "patch":
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
  case "minor":
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case "major":
    newVersion = `${major + 1}.0.0`;
    break;
}

// Update VERSION file
fs.writeFileSync(versionFile, newVersion);

// Update app.json
const appJsonPath = path.join(__dirname, "..", "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
appJson.expo.version = newVersion;

// Generate build number (timestamp)
const now = new Date();
const buildNumber = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
appJson.expo.ios = appJson.expo.ios || {};
appJson.expo.ios.buildNumber = buildNumber;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");

// Update package.json version
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

// Update CHANGELOG.md with new version placeholder
const changelogPath = path.join(__dirname, "..", "CHANGELOG.md");
const changelog = fs.readFileSync(changelogPath, "utf8");
const today = new Date().toISOString().split("T")[0];
const newEntry = `## [${newVersion}] - ${today}\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n\n`;
const updatedChangelog = changelog.replace("## [", newEntry + "## [");
fs.writeFileSync(changelogPath, updatedChangelog);

console.log(`✅ Version bumped from ${currentVersion} to ${newVersion}`);
console.log(`📝 Build number: ${buildNumber}`);
console.log(`\nNext steps:`);
console.log(`1. Update CHANGELOG.md with your changes`);
console.log(
  `2. Commit: git add . && git commit -m "chore: bump version to ${newVersion}"`,
);
console.log(
  `3. Tag: git tag -a v${newVersion} -m "Release version ${newVersion}"`,
);
console.log(`4. Push: git push origin main --tags`);
console.log(`5. Deploy: npm run deploy`);
