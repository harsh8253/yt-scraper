const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const {
  ASK_PANEL_TIMEOUT_MS,
  CHROME_EXECUTABLE_CANDIDATES,
  CHROME_PROFILE_DIRECTORY,
  CHROME_PROFILE_MODE,
  CHROME_USER_DATA_DIR,
  DEFAULT_TIMEOUT_MS,
  KEEP_PROFILE_COPY,
  NAVIGATION_TIMEOUT_MS,
  PROFILE_COPY_ROOT,
  PERSISTENT_PROFILE_ROOT,
  SUMMARY_TIMEOUT_MS
} = require("./config");
const {
  ASK_BUTTON_XPATHS,
  LATEST_VIDEO_LINK_SELECTORS,
  SUMMARY_TEXT_SELECTORS,
  SUMMARISE_BUTTON_XPATHS
} = require("./selectors");
const { fileExists, getTimestamp, sleep, toVideosUrl } = require("./utils");

async function resolveChromeExecutablePath() {
  for (const candidate of CHROME_EXECUTABLE_CANDIDATES) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Google Chrome executable was not found. Checked: ${CHROME_EXECUTABLE_CANDIDATES.join(", ")}`
  );
}

async function createBrowser() {
  const launchContext = await prepareChromeLaunchContext();

  try {
    const browser = await puppeteer.launch({
      executablePath: launchContext.executablePath,
      headless: false,
      defaultViewport: null,
      userDataDir: launchContext.userDataDir,
      args: ["--start-maximized", `--profile-directory=${launchContext.profileDirectory}`]
    });

    return {
      browser,
      launchContext
    };
  } catch (error) {
    await cleanupLaunchContext(launchContext);
    throw error;
  }
}

const EXCLUDED_DIRECTORY_NAMES = new Set([
  "Cache",
  "Code Cache",
  "Crashpad",
  "DawnGraphiteCache",
  "DawnWebGPUCache",
  "GPUCache",
  "GrShaderCache",
  "Media Cache",
  "ShaderCache"
]);

const EXCLUDED_FILE_NAMES = new Set([
  "lockfile",
  "singletoncookie",
  "singletonlock",
  "singletonsocket"
]);

const ROOT_FILES_TO_COPY = ["Local State", "Last Version", "First Run"];

function shouldSkipCopyEntry(entryName, entryPath, isDirectory) {
  const lowerName = entryName.toLowerCase();

  if (isDirectory && EXCLUDED_DIRECTORY_NAMES.has(entryName)) {
    return true;
  }

  if (EXCLUDED_FILE_NAMES.has(lowerName)) {
    return true;
  }

  if (lowerName.endsWith(".lock") || lowerName.endsWith(".tmp")) {
    return true;
  }

  if (entryPath.includes(`${path.sep}Cache${path.sep}`)) {
    return true;
  }

  return false;
}

async function safeCopyRecursive(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (shouldSkipCopyEntry(entry.name, sourcePath, entry.isDirectory())) {
      continue;
    }

    if (entry.isDirectory()) {
      await safeCopyRecursive(sourcePath, targetPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    try {
      await fs.copyFile(sourcePath, targetPath);
    } catch {
      // Best-effort copy mode intentionally skips locked or transient files.
    }
  }
}

async function createTemporaryProfileCopy() {
  const sourceProfileDir = path.join(CHROME_USER_DATA_DIR, await resolveProfileDirectory(CHROME_USER_DATA_DIR));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tempUserDataDir = path.join(PROFILE_COPY_ROOT, `profile-copy-${timestamp}`);
  const tempProfileDir = path.join(tempUserDataDir, CHROME_PROFILE_DIRECTORY);

  if (!(await fileExists(sourceProfileDir))) {
    throw new Error(`Chrome profile directory not found: ${sourceProfileDir}`);
  }

  await fs.mkdir(tempUserDataDir, { recursive: true });

  for (const fileName of ROOT_FILES_TO_COPY) {
    const sourcePath = path.join(CHROME_USER_DATA_DIR, fileName);
    const targetPath = path.join(tempUserDataDir, fileName);
    if (!(await fileExists(sourcePath))) {
      continue;
    }

    try {
      await fs.copyFile(sourcePath, targetPath);
    } catch {
      // Best-effort root file copy.
    }
  }

  await safeCopyRecursive(sourceProfileDir, tempProfileDir);

  return {
    cleanup: async () => {
      if (!KEEP_PROFILE_COPY) {
        await fs.rm(tempUserDataDir, { recursive: true, force: true }).catch(() => {});
      }
    },
    isTemporaryCopy: true,
    userDataDir: tempUserDataDir
  };
}

async function prepareChromeLaunchContext() {
  const executablePath = await resolveChromeExecutablePath();

  if (!(await fileExists(CHROME_USER_DATA_DIR)) && CHROME_PROFILE_MODE !== "persistent") {
    throw new Error(`Chrome user data directory not found: ${CHROME_USER_DATA_DIR}`);
  }

  const normalizedMode = String(CHROME_PROFILE_MODE || "copy").toLowerCase();
  if (normalizedMode === "direct") {
    const profileDirectory = await resolveProfileDirectory(CHROME_USER_DATA_DIR);
    return {
      cleanup: async () => {},
      executablePath,
      isTemporaryCopy: false,
      profileDirectory,
      userDataDir: CHROME_USER_DATA_DIR
    };
  }

  if (normalizedMode === "persistent") {
    await fs.mkdir(PERSISTENT_PROFILE_ROOT, { recursive: true });
    const profileDirectory = await resolveProfileDirectory(PERSISTENT_PROFILE_ROOT);
    return {
      cleanup: async () => {},
      executablePath,
      isTemporaryCopy: false,
      isPersistentProfile: true,
      profileDirectory,
      userDataDir: PERSISTENT_PROFILE_ROOT
    };
  }

  if (normalizedMode !== "copy") {
    throw new Error(
      `Unsupported CHROME_PROFILE_MODE "${CHROME_PROFILE_MODE}". Use "persistent", "copy" or "direct".`
    );
  }

  const copyContext = await createTemporaryProfileCopy();
  return {
    ...copyContext,
    executablePath,
    isPersistentProfile: false
  };
}

async function readLocalState(userDataDir) {
  const localStatePath = path.join(userDataDir, "Local State");
  if (!(await fileExists(localStatePath))) {
    return null;
  }

  try {
    const content = await fs.readFile(localStatePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function chooseProfileFromInfoCache(infoCache) {
  const entries = Object.entries(infoCache || {});
  if (entries.length === 0) {
    return null;
  }

  const signedIn = entries
    .filter(([, value]) => value && (value.user_name || value.gaia_name || value.gaia_id))
    .sort((a, b) => {
      const aTime = Number(a[1].active_time || 0);
      const bTime = Number(b[1].active_time || 0);
      return bTime - aTime;
    });

  if (signedIn.length > 0) {
    return signedIn[0][0];
  }

  const nonDefault = entries.find(([key]) => key !== "Default");
  if (nonDefault) {
    return nonDefault[0];
  }

  return entries[0][0];
}

async function resolveProfileDirectory(userDataDir) {
  if (CHROME_PROFILE_DIRECTORY) {
    return CHROME_PROFILE_DIRECTORY;
  }

  const localState = await readLocalState(userDataDir);
  const inferred =
    chooseProfileFromInfoCache(localState?.profile?.info_cache) ||
    localState?.profile?.last_used ||
    "Default";

  return inferred;
}

async function cleanupLaunchContext(launchContext) {
  if (launchContext && typeof launchContext.cleanup === "function") {
    await launchContext.cleanup();
  }
}

async function gotoWithRetry(page, url, attempts = 2) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: NAVIGATION_TIMEOUT_MS
      });
      await page.waitForNetworkIdle({ idleTime: 800, timeout: DEFAULT_TIMEOUT_MS }).catch(() => {});
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(1500);
      }
    }
  }

  throw lastError;
}

async function clickElementHandle(handle) {
  await handle.evaluate((element) => {
    element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
  });
  await sleep(300);
  await handle.click();
}

async function findFirstXPath(page, xpaths) {
  for (const xpath of xpaths) {
    const handle = await page.evaluateHandle((expression) => {
      const result = document.evaluate(
        expression,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    }, xpath);

    const element = handle.asElement();
    if (element) {
      return element;
    }
  }
  return null;
}

async function waitForAnySelector(page, selectors, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    for (const selector of selectors) {
      const handle = await page.$(selector);
      if (handle) {
        return handle;
      }
    }

    await sleep(500);
  }

  return null;
}

async function extractTextFromSelectors(page, selectors) {
  for (const selector of selectors) {
    const text = await page
      .$eval(selector, (element) => element.innerText.trim())
      .catch(() => null);

    if (text) {
      return text;
    }
  }

  return null;
}

async function getLatestVideoUrl(page, channelVideosUrl) {
  await gotoWithRetry(page, channelVideosUrl);

  for (const selector of LATEST_VIDEO_LINK_SELECTORS) {
    const handle = await page.waitForSelector(selector, {
      timeout: DEFAULT_TIMEOUT_MS
    }).catch(() => null);

    if (!handle) {
      continue;
    }

    const href = await handle.evaluate((element) => element.href || element.getAttribute("href"));
    if (!href) {
      continue;
    }

    return href.startsWith("http") ? href : new URL(href, "https://www.youtube.com").toString();
  }

  return null;
}

async function clickAskButton(page) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < ASK_PANEL_TIMEOUT_MS) {
    const askButton = await findFirstXPath(page, ASK_BUTTON_XPATHS);
    if (askButton) {
      await clickElementHandle(askButton);
      return true;
    }

    await page.evaluate(() => window.scrollBy(0, 500)).catch(() => {});
    await sleep(700);
  }

  return false;
}

async function clickSummariseButton(page) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < ASK_PANEL_TIMEOUT_MS) {
    const button = await findFirstXPath(page, SUMMARISE_BUTTON_XPATHS);
    if (button) {
      await clickElementHandle(button);
      return true;
    }

    await sleep(700);
  }

  return false;
}

async function waitForSummaryText(page) {
  const startedAt = Date.now();
  let previousText = null;
  let stableCount = 0;

  while (Date.now() - startedAt < SUMMARY_TIMEOUT_MS) {
    const text = await extractSummaryFromAskPanel(page);
    if (text) {
      if (text === previousText) {
        stableCount += 1;
      } else {
        stableCount = 0;
        previousText = text;
      }

      if (stableCount >= 1 || text.length > 120) {
        return text;
      }
    }

    await sleep(1500);
  }

  return extractSummaryFromAskPanel(page);
}

async function extractSummaryFromAskPanel(page) {
  const messageText = await page.evaluate(() => {
    const panel =
      document.querySelector('ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]') ||
      document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="engagement-panel"]');

    if (!panel) {
      return null;
    }

    const assistantMessages = Array.from(
      panel.querySelectorAll("you-chat-item-view-model markdown-div, you-chat-item-view-model .ytwMarkdownDivHost")
    )
      .map((node) => (node.innerText || "").trim())
      .filter(Boolean)
      .filter((text) => !/^Hello! Curious about what you're watching/i.test(text))
      .filter((text) => !/^Not sure what to ask\\?/i.test(text))
      .filter((text) => text.length > 80);

    if (assistantMessages.length === 0) {
      return null;
    }

    return assistantMessages[assistantMessages.length - 1];
  }).catch(() => null);

  if (messageText) {
    return cleanupSummaryText(messageText);
  }

  const fallback = await extractTextFromSelectors(page, SUMMARY_TEXT_SELECTORS);
  return cleanupSummaryText(fallback);
}

function cleanupSummaryText(text) {
  if (!text) {
    return null;
  }

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^Ask about this video\s*/i, "");
  cleaned = cleaned.replace(/^Summari[sz]e the video\s*/i, "");
  cleaned = cleaned.replace(/\n?AI can make mistakes, so double-check it\.[\s\S]*$/i, "");
  cleaned = cleaned.replace(/\n?Made with Gemini\s*$/i, "");
  cleaned = cleaned.trim();

  return cleaned || null;
}

async function scrapeChannel(page, channelInput) {
  const scrapedAt = getTimestamp();
  const channelVideosUrl = toVideosUrl(channelInput);
  const result = {
    channelInput,
    channelVideosUrl,
    videoUrl: null,
    videoTitle: null,
    summaryText: null,
    status: "pending",
    errorMessage: null,
    scrapedAt
  };

  try {
    const latestVideoUrl = await getLatestVideoUrl(page, channelVideosUrl);
    if (!latestVideoUrl) {
      result.status = "latest_video_not_found";
      result.errorMessage = "Could not find a latest video link on the channel videos page.";
      return result;
    }

    result.videoUrl = latestVideoUrl;
    await gotoWithRetry(page, latestVideoUrl);

    result.videoTitle = await page.title().catch(() => null);

    const askClicked = await clickAskButton(page);
    if (!askClicked) {
      result.status = "ask_not_available";
      result.errorMessage = "Ask button was not found on the video page.";
      return result;
    }

    const summariseClicked = await clickSummariseButton(page);
    if (!summariseClicked) {
      result.status = "summary_not_available";
      result.errorMessage = "Summarise the video button was not found after opening Ask.";
      return result;
    }

    const summaryText = await waitForSummaryText(page);
    if (!summaryText) {
      result.status = "summary_not_available";
      result.errorMessage = "Summary text did not appear in the Ask panel.";
      return result;
    }

    result.summaryText = summaryText;
    result.status = "success";
    return result;
  } catch (error) {
    result.status = "navigation_failed";
    result.errorMessage = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function saveDebugSnapshot(page, channelInput) {
  const safeName = channelInput.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "channel";
  const snapshotDir = "output";
  await fs.mkdir(snapshotDir, { recursive: true });
  await page.screenshot({
    path: `${snapshotDir}\\${safeName}.png`,
    fullPage: false
  }).catch(() => {});
}

async function scrapeChannels(channelUrls) {
  let browser;
  let launchContext;
  try {
    const browserSession = await createBrowser();
    browser = browserSession.browser;
    launchContext = browserSession.launchContext;
    if (launchContext.isTemporaryCopy) {
      console.log(`Using temporary Chrome profile copy: ${launchContext.userDataDir}`);
    }
    if (launchContext.isPersistentProfile) {
      console.log(`Using persistent Puppeteer profile: ${launchContext.userDataDir}`);
    }
    console.log(`Using Chrome profile directory: ${launchContext.profileDirectory}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("The browser is already running for")
    ) {
      throw new Error(
        `Chrome profile is locked because Chrome is already running. Close Chrome and retry, or set CHROME_USER_DATA_DIR / CHROME_PROFILE_DIRECTORY to a different profile copy. Original error: ${error.message}`
      );
    }
    throw error;
  }
  const page = await browser.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

  const results = [];

  try {
    for (const channelUrl of channelUrls) {
      const result = await scrapeChannel(page, channelUrl);
      if (result.status !== "success") {
        await saveDebugSnapshot(page, channelUrl);
      }
      results.push(result);
    }
  } finally {
    await browser.close();
    await cleanupLaunchContext(launchContext);
  }

  return results;
}

async function openPersistentLoginSetup() {
  const previousMode = process.env.CHROME_PROFILE_MODE;
  process.env.CHROME_PROFILE_MODE = "persistent";

  let browser;
  try {
    const browserSession = await createBrowser();
    browser = browserSession.browser;
    const pages = await browser.pages();
    const page = pages[0] || (await browser.newPage());
    page.setDefaultTimeout(DEFAULT_TIMEOUT_MS);

    console.log(`Using persistent Puppeteer profile: ${PERSISTENT_PROFILE_ROOT}`);
    console.log(`Using Chrome profile directory: ${browserSession.launchContext.profileDirectory}`);
    console.log("A Chrome window is opening for manual sign-in.");
    console.log("Sign in to YouTube there, confirm the Ask button appears on a video, then press Enter here to save the session.");

    await gotoWithRetry(page, "https://www.youtube.com/");

    await new Promise((resolve) => {
      process.stdin.resume();
      process.stdout.write("\nPress Enter after you finish signing in inside the Puppeteer browser...\n");
      process.stdin.once("data", () => {
        process.stdin.pause();
        resolve();
      });
    });
  } finally {
    if (typeof previousMode === "undefined") {
      delete process.env.CHROME_PROFILE_MODE;
    } else {
      process.env.CHROME_PROFILE_MODE = previousMode;
    }

    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

module.exports = {
  createTemporaryProfileCopy,
  createBrowser,
  openPersistentLoginSetup,
  prepareChromeLaunchContext,
  resolveChromeExecutablePath,
  scrapeChannels
};
