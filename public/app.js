const channelsInput = document.querySelector("#channels");
const runButton = document.querySelector("#run-button");
const linksButton = document.querySelector("#links-button");
const sampleButton = document.querySelector("#sample-button");
const healthPill = document.querySelector("#health-pill");
const resultsMeta = document.querySelector("#results-meta");
const resultsRoot = document.querySelector("#results");
const resultTemplate = document.querySelector("#result-template");
const videoLinksTemplate = document.querySelector("#video-links-template");

function setHealth(text, className = "") {
  healthPill.textContent = text;
  healthPill.className = `status-pill ${className}`.trim();
}

function setRunning(isRunning) {
  runButton.disabled = isRunning;
  linksButton.disabled = isRunning;
  runButton.textContent = isRunning ? "Running browser flow..." : "Get Summaries";
  linksButton.textContent = isRunning ? "Collecting links..." : "Get All Video Links";
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

function renderVideoLinkResults(results) {
  if (!results.length) {
    resultsRoot.className = "results-empty";
    resultsRoot.textContent = "No video links returned.";
    return;
  }

  resultsRoot.className = "results-grid";
  resultsRoot.innerHTML = "";

  for (const result of results) {
    const fragment = videoLinksTemplate.content.cloneNode(true);
    const statusNode = fragment.querySelector(".result-status");
    const titleNode = fragment.querySelector(".result-title");
    const channelNode = fragment.querySelector(".result-channel");
    const errorNode = fragment.querySelector(".result-error");
    const listNode = fragment.querySelector(".video-links-list");
    const copyButton = fragment.querySelector(".copy-links-button");

    const success = result.status === "success";
    statusNode.textContent = `${result.status} | ${result.totalVideos || 0} videos`;
    statusNode.classList.add(success ? "success" : "failure");
    titleNode.textContent = "Collected Video Links";
    channelNode.textContent = result.channelInput;
    errorNode.textContent = result.errorMessage || "";

    const linksText = formatVideoLinksForCopy(result.videos || []);
    copyButton.disabled = !linksText;
    copyButton.addEventListener("click", async () => {
      try {
        await copyTextToClipboard(linksText);
        copyButton.textContent = "Copied";
        setTimeout(() => {
          copyButton.textContent = "Copy Links";
        }, 1400);
      } catch (error) {
        copyButton.textContent = "Copy Failed";
        setTimeout(() => {
          copyButton.textContent = "Copy Links";
        }, 1800);
      }
    });

    for (const video of result.videos || []) {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      const title = document.createElement("small");

      anchor.href = video.url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = video.url;
      title.textContent = video.title || "Untitled video";

      item.append(anchor, title);
      listNode.appendChild(item);
    }

    if (!listNode.children.length) {
      const item = document.createElement("li");
      item.textContent = "No links found.";
      listNode.appendChild(item);
    }

    resultsRoot.appendChild(fragment);
  }
}

function formatVideoLinksForCopy(videos) {
  return videos
    .map((video, index) => {
      const title = video.title || "Untitled video";
      return `${index + 1}. ${title}\n${video.url}`;
    })
    .join("\n\n");
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Clipboard copy was blocked by the browser.");
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

async function runVideoLinks() {
  const channels = parseChannels();
  if (channels.length === 0) {
    setHealth("Add at least one channel", "error");
    resultsMeta.textContent = "Waiting for input.";
    return;
  }

  setRunning(true);
  resultsMeta.textContent = `Collecting video links from ${channels.length} channel${channels.length === 1 ? "" : "s"}...`;

  try {
    const response = await fetch("/api/video-links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ channels })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Video link collection failed.");
    }

    renderVideoLinkResults(data.results || []);
    const total = (data.results || []).reduce((sum, result) => sum + (result.totalVideos || 0), 0);
    resultsMeta.textContent = `Collected ${total} video link${total === 1 ? "" : "s"}. Saved to ${data.savedTo}`;
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

linksButton.addEventListener("click", () => {
  runVideoLinks().catch(() => {});
});

loadHealth().catch(() => {});
