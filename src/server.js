const express = require("express");
const path = require("node:path");

const {
  CHROME_PROFILE_MODE,
  CHROME_PROFILE_DIRECTORY,
  OUTPUT_PATH,
  PERSISTENT_PROFILE_ROOT,
  VIDEO_LINKS_OUTPUT_PATH
} = require("./config");
const { collectAllVideoLinks, scrapeChannels } = require("./scraper");
const { normalizeChannelInput, writeJson } = require("./utils");

const PORT = Number(process.env.PORT || 3000);
const app = express();

let activeRun = null;

if (process.argv.includes("--check")) {
  console.log("server syntax check ok");
  process.exit(0);
}

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(process.cwd(), "public")));
app.get("/favicon.ico", (_request, response) => {
  response.status(204).end();
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    profileMode: CHROME_PROFILE_MODE,
    profileDirectory: CHROME_PROFILE_DIRECTORY || "auto-detect",
    persistentProfileRoot: PERSISTENT_PROFILE_ROOT,
    outputPath: OUTPUT_PATH,
    videoLinksOutputPath: VIDEO_LINKS_OUTPUT_PATH,
    runInProgress: Boolean(activeRun)
  });
});

app.post("/api/scrape", async (request, response) => {
  if (activeRun) {
    response.status(409).json({
      error: "A scrape is already running. Wait for it to finish before starting another one."
    });
    return;
  }

  const rawChannels = Array.isArray(request.body?.channels) ? request.body.channels : [];
  if (rawChannels.length === 0) {
    response.status(400).json({
      error: "Send a JSON body with a non-empty channels array."
    });
    return;
  }

  let channels;
  try {
    channels = rawChannels
      .map((channel) => normalizeChannelInput(String(channel)))
      .filter(Boolean);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  activeRun = (async () => {
    const results = await scrapeChannels(channels);
    await writeJson(OUTPUT_PATH, results);
    return results;
  })();

  try {
    const results = await activeRun;
    response.json({
      results,
      savedTo: OUTPUT_PATH
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    activeRun = null;
  }
});

app.post("/api/video-links", async (request, response) => {
  if (activeRun) {
    response.status(409).json({
      error: "A scrape is already running. Wait for it to finish before starting another one."
    });
    return;
  }

  const rawChannels = Array.isArray(request.body?.channels) ? request.body.channels : [];
  if (rawChannels.length === 0) {
    response.status(400).json({
      error: "Send a JSON body with a non-empty channels array."
    });
    return;
  }

  let channels;
  try {
    channels = rawChannels
      .map((channel) => normalizeChannelInput(String(channel)))
      .filter(Boolean);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  activeRun = (async () => {
    const results = await collectAllVideoLinks(channels);
    await writeJson(VIDEO_LINKS_OUTPUT_PATH, results);
    return results;
  })();

  try {
    const results = await activeRun;
    response.json({
      results,
      savedTo: VIDEO_LINKS_OUTPUT_PATH
    });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    activeRun = null;
  }
});

app.listen(PORT, () => {
  console.log(`Web UI running at http://localhost:${PORT}`);
});
