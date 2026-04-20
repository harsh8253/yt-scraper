const fs = require("node:fs/promises");

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeChannelInput(input) {
  if (!input || typeof input !== "string") {
    throw new Error("Channel input must be a non-empty string.");
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Channel input must not be empty.");
  }

  if (trimmed.startsWith("@")) {
    return `https://www.youtube.com/${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  }

  return `https://www.youtube.com/${trimmed.replace(/^\/+/, "")}`;
}

function toVideosUrl(channelUrl) {
  const url = new URL(channelUrl);
  const pathWithoutVideos = url.pathname.replace(/\/videos\/?$/, "");
  url.pathname = `${pathWithoutVideos}/videos`;
  return url.toString();
}

async function ensureDirectoryForFile(filePath) {
  const directory = require("node:path").dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
}

async function writeJson(filePath, data) {
  await ensureDirectoryForFile(filePath);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  fileExists,
  getTimestamp,
  normalizeChannelInput,
  sleep,
  toVideosUrl,
  writeJson
};
