const channelsInput = document.querySelector("#channels");
const runButton = document.querySelector("#run-button");
const sampleButton = document.querySelector("#sample-button");
const healthPill = document.querySelector("#health-pill");
const resultsMeta = document.querySelector("#results-meta");
const resultsRoot = document.querySelector("#results");
const resultTemplate = document.querySelector("#result-template");

function setHealth(text, className = "") {
  healthPill.textContent = text;
  healthPill.className = `status-pill ${className}`.trim();
}

function setRunning(isRunning) {
  runButton.disabled = isRunning;
  runButton.textContent = isRunning ? "Running browser flow..." : "Get Summaries";
  setHealth(isRunning ? "Scrape in progress..." : healthPill.textContent, isRunning ? "busy" : healthPill.classList.contains("ready") ? "ready" : "");
}

function parseChannels() {
  return channelsInput.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function renderResults(results) {
  if (!results.length) {
    resultsRoot.className = "results-empty";
    resultsRoot.textContent = "No results returned.";
    return;
  }

  resultsRoot.className = "results-grid";
  resultsRoot.innerHTML = "";

  for (const result of results) {
    const fragment = resultTemplate.content.cloneNode(true);
    const statusNode = fragment.querySelector(".result-status");
    const videoLink = fragment.querySelector(".result-video-link");
    const titleNode = fragment.querySelector(".result-title");
    const channelNode = fragment.querySelector(".result-channel");
    const errorNode = fragment.querySelector(".result-error");
    const summaryNode = fragment.querySelector(".result-summary");

    const success = result.status === "success";
    statusNode.textContent = result.status;
    statusNode.classList.add(success ? "success" : "failure");

    titleNode.textContent = result.videoTitle || "No video title found";
    channelNode.textContent = result.channelInput;
    errorNode.textContent = result.errorMessage || "";
    summaryNode.textContent = result.summaryText || "No summary text returned.";

    if (result.videoUrl) {
      videoLink.href = result.videoUrl;
      videoLink.hidden = false;
    } else {
      videoLink.hidden = true;
    }

    resultsRoot.appendChild(fragment);
  }
}

async function loadHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    const suffix = data.profileDirectory ? `Profile: ${data.profileDirectory}` : "Profile ready";
    setHealth(suffix, "ready");
  } catch {
    setHealth("Server unavailable", "error");
  }
}

async function runScrape() {
  const channels = parseChannels();
  if (channels.length === 0) {
    setHealth("Add at least one channel", "error");
    resultsMeta.textContent = "Waiting for input.";
    return;
  }

  setRunning(true);
  resultsMeta.textContent = `Running ${channels.length} channel${channels.length === 1 ? "" : "s"}...`;

  try {
    const response = await fetch("/api/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ channels })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Scrape failed.");
    }

    renderResults(data.results || []);
    resultsMeta.textContent = `Finished ${data.results.length} channel${data.results.length === 1 ? "" : "s"}. Saved to ${data.savedTo}`;
    setHealth("Profile ready", "ready");
  } catch (error) {
    resultsRoot.className = "results-empty";
    resultsRoot.textContent = error.message;
    resultsMeta.textContent = "Run failed.";
    setHealth("Run failed", "error");
  } finally {
    setRunning(false);
    if (!healthPill.classList.contains("error")) {
      setHealth("Profile ready", "ready");
    }
  }
}

sampleButton.addEventListener("click", () => {
  channelsInput.value = ["https://www.youtube.com/@CleoAbram", "https://www.youtube.com/@Veritasium"].join("\n");
});

runButton.addEventListener("click", () => {
  runScrape().catch(() => {});
});

loadHealth().catch(() => {});
