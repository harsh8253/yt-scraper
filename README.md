# YouTube Ask-Panel Scraper

This project uses `puppeteer-core` to open one or more YouTube channel pages, visit the latest video for each channel, open the `Ask` panel, click `Summarise the video`, and capture the returned summary text.

## Requirements

- Node.js 20+
- Google Chrome installed locally
- A Chrome profile that is already signed in to YouTube and has access to the `Ask about this video` feature

## Install

```powershell
npm install
```

## Usage

```powershell
node src/index.js https://www.youtube.com/@CleoAbram https://www.youtube.com/@Veritasium
```

You can also pass handles directly:

```powershell
node src/index.js @CleoAbram @Veritasium
```

Set up a dedicated Puppeteer login session once:

```powershell
node src/index.js --login-setup
```

## Web UI

Start the frontend and API:

```powershell
npm run web
```

Then open:

```text
http://localhost:3000
```

Paste one channel per line and click **Get Summaries**. The page calls the same Puppeteer scraper used by the CLI and saves results to `output/results.json`.

## Output

- Console output with one result block per channel
- JSON output written to `output/results.json`
- Debug screenshots for failures written into `output\`

## Optional Environment Overrides

```powershell
$env:CHROME_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:CHROME_USER_DATA_DIR = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$env:CHROME_PROFILE_DIRECTORY = "Profile 1"
$env:PERSISTENT_PROFILE_ROOT = "D:\New folder (2)\.puppeteer-profile"
$env:CHROME_PROFILE_MODE = "copy"
$env:KEEP_PROFILE_COPY = "0"
```

## Profile Modes

- `persistent` mode:
  - Default mode.
  - Uses a dedicated Puppeteer browser profile stored in `.puppeteer-profile`.
  - Best option when you want to sign in once inside the Puppeteer browser and reuse that session later.
- `copy` mode:
  - Creates a temporary copy of your selected Chrome profile and launches Puppeteer against that copy.
  - This is the safer option when your normal Chrome window is still open.
- `direct` mode:
  - Launches Puppeteer against the live Chrome user data directory.
  - Faster, but it usually requires Chrome to be closed first because the profile is locked.

## Notes

- The script runs Chrome in headed mode because the YouTube Ask UI is interactive and often session-dependent.
- For the most reliable setup, run `node src/index.js --login-setup`, sign in to YouTube inside that Puppeteer browser, then use normal scraper runs afterward.
- If `CHROME_PROFILE_DIRECTORY` is not set, the scraper tries to auto-select the most likely signed-in Chrome profile from the browser's `Local State` file.
- The web UI allows only one active scrape run at a time so multiple browser sessions do not collide.
- The scraper reuses the default Chrome user data directory from Windows:
  - `C:\Users\<you>\AppData\Local\Google\Chrome\User Data`
- In `copy` mode the scraper copies the selected profile into a temporary folder, skips volatile cache/lock files, and cleans that temp folder up after the run unless `KEEP_PROFILE_COPY=1`.
- Because Chrome may keep some SQLite files open, copy mode is best-effort. If your login state does not come across cleanly, point the script at a quieter dedicated Chrome profile with `CHROME_PROFILE_DIRECTORY`.
- YouTube changes its DOM frequently, so the selectors in `src/selectors.js` may need updates over time.
- If `Ask` or `Summarise the video` is missing, the script skips that video and records the failure in the output JSON.
