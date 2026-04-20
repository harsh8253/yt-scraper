const {
  CHROME_PROFILE_MODE,
  CHROME_PROFILE_DIRECTORY,
  CHROME_USER_DATA_DIR,
  OUTPUT_PATH,
  PERSISTENT_PROFILE_ROOT
} = require("./config");
const { openPersistentLoginSetup, scrapeChannels } = require("./scraper");
const { normalizeChannelInput, writeJson } = require("./utils");

function printHelp() {
  console.log(`
Usage:
  node src/index.js <channel-url> [more-channel-urls...]
  node src/index.js --login-setup

Examples:
  node src/index.js https://www.youtube.com/@CleoAbram
  node src/index.js @CleoAbram https://www.youtube.com/@Veritasium
  node src/index.js --login-setup

Notes:
  - The script launches your installed Google Chrome with your existing user profile.
  - Default profile mode is "${CHROME_PROFILE_MODE}".
  - "persistent" mode reuses a dedicated Puppeteer profile folder and is best for logging in once.
  - "copy" mode creates a temporary profile snapshot so Chrome can stay open.
  - "direct" mode launches the real profile and requires Chrome to be closed.
  - Stay signed in to YouTube in Chrome so the Ask feature is available.
  - CHROME_PROFILE_DIRECTORY is optional; when omitted, the scraper auto-picks the most likely signed-in Chrome profile.
  - Override CHROME_USER_DATA_DIR / CHROME_PROFILE_DIRECTORY if needed.
  - Current Chrome user data dir: ${CHROME_USER_DATA_DIR}
  - Current Chrome profile directory: ${CHROME_PROFILE_DIRECTORY}
  - Persistent Puppeteer profile dir: ${PERSISTENT_PROFILE_ROOT}
  - Results are written to ${OUTPUT_PATH}
`);
}

function printResult(result) {
  console.log("=".repeat(80));
  console.log(`Channel: ${result.channelInput}`);
  console.log(`Videos Page: ${result.channelVideosUrl}`);
  console.log(`Status: ${result.status}`);
  if (result.videoTitle) {
    console.log(`Video Title: ${result.videoTitle}`);
  }
  if (result.videoUrl) {
    console.log(`Video URL: ${result.videoUrl}`);
  }
  if (result.errorMessage) {
    console.log(`Error: ${result.errorMessage}`);
  }
  if (result.summaryText) {
    console.log("Summary:");
    console.log(result.summaryText);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--login-setup")) {
    await openPersistentLoginSetup();
    console.log("Persistent Puppeteer login session saved.");
    return;
  }

  const normalizedInputs = args.map(normalizeChannelInput);
  const results = await scrapeChannels(normalizedInputs);

  for (const result of results) {
    printResult(result);
  }

  await writeJson(OUTPUT_PATH, results);
  console.log("=".repeat(80));
  console.log(`Saved ${results.length} result(s) to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Fatal error while running the YouTube scraper.");
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
