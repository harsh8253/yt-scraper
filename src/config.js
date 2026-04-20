const path = require("node:path");
const os = require("node:os");

const DEFAULT_TIMEOUT_MS = 30000;
const ASK_PANEL_TIMEOUT_MS = 45000;
const SUMMARY_TIMEOUT_MS = 60000;
const NAVIGATION_TIMEOUT_MS = 45000;
const OUTPUT_PATH = path.join(process.cwd(), "output", "results.json");
const CHROME_PROFILE_DIRECTORY = process.env.CHROME_PROFILE_DIRECTORY || "";
const CHROME_PROFILE_MODE = process.env.CHROME_PROFILE_MODE || "persistent";
const KEEP_PROFILE_COPY = process.env.KEEP_PROFILE_COPY === "1";
const PROFILE_COPY_ROOT =
  process.env.PROFILE_COPY_ROOT || path.join(os.tmpdir(), "youtube-ask-scraper");
const PERSISTENT_PROFILE_ROOT =
  process.env.PERSISTENT_PROFILE_ROOT || path.join(process.cwd(), ".puppeteer-profile");

function getChromeExecutableCandidates() {
  const candidates = [process.env.CHROME_EXECUTABLE_PATH];

  if (process.platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe")
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      path.join(os.homedir(), "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome")
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/snap/bin/chromium",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium"
    );
  }

  return candidates.filter(Boolean);
}

const CHROME_EXECUTABLE_CANDIDATES = getChromeExecutableCandidates();

function getDefaultChromeUserDataDir() {
  if (process.platform === "win32") {
    return path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome");
  }

  return path.join(os.homedir(), ".config", "google-chrome");
}

const CHROME_USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR || getDefaultChromeUserDataDir();

module.exports = {
  ASK_PANEL_TIMEOUT_MS,
  CHROME_EXECUTABLE_CANDIDATES,
  CHROME_PROFILE_DIRECTORY,
  CHROME_PROFILE_MODE,
  CHROME_USER_DATA_DIR,
  DEFAULT_TIMEOUT_MS,
  KEEP_PROFILE_COPY,
  NAVIGATION_TIMEOUT_MS,
  OUTPUT_PATH,
  PERSISTENT_PROFILE_ROOT,
  PROFILE_COPY_ROOT,
  SUMMARY_TIMEOUT_MS
};
