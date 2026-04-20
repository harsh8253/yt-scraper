const LATEST_VIDEO_LINK_SELECTORS = [
  'ytd-rich-grid-media a#thumbnail[href*="/watch"]',
  'ytd-grid-video-renderer a#thumbnail[href*="/watch"]',
  'a.yt-simple-endpoint[href*="/watch"]'
];

const ASK_BUTTON_XPATHS = [
  "//button[.//span[contains(normalize-space(.), 'Ask')]]",
  "//yt-button-shape//button[.//*[contains(normalize-space(.), 'Ask')]]",
  "//*[self::button or @role='button'][contains(normalize-space(.), 'Ask')]"
];

const SUMMARISE_BUTTON_XPATHS = [
  "//*[self::button or @role='button'][contains(normalize-space(.), 'Summarise the video')]",
  "//*[self::button or @role='button'][contains(normalize-space(.), 'Summarize the video')]",
  "//button[.//span[contains(normalize-space(.), 'Summarise')]]",
  "//button[.//span[contains(normalize-space(.), 'Summarize')]]"
];

const SUMMARY_TEXT_SELECTORS = [
  'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"] #content-text',
  'ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"] yt-formatted-string',
  'ytd-engagement-panel-section-list-renderer[target-id*="engagement-panel"] #content-text',
  'ytd-engagement-panel-section-list-renderer[target-id*="engagement-panel"] yt-formatted-string'
];

module.exports = {
  ASK_BUTTON_XPATHS,
  LATEST_VIDEO_LINK_SELECTORS,
  SUMMARY_TEXT_SELECTORS,
  SUMMARISE_BUTTON_XPATHS
};
