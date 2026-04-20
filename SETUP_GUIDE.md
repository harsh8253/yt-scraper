# YouTube Ask Scraper Setup Guide

This guide explains how to clone the project on another PC, install dependencies, sign in once, and run both the CLI and frontend.

## 1. Requirements

- Node.js 20 or newer
- Google Chrome installed
- A Google/YouTube account that can see the **Ask** button on supported videos
- Windows, macOS, or Linux

Check versions:

```powershell
node -v
npm -v
```

## 2. Clone The Project

```powershell
git clone https://github.com/harsh8253/yt-scraper.git
cd yt-scraper
```

## 3. Install Packages

```powershell
npm install
```

## 4. Sign In Once In The Puppeteer Browser

This project uses a dedicated persistent browser profile stored inside the project folder so future runs can reuse the same signed-in session.

Run:

```powershell
node src\index.js --login-setup
```

Then:

1. A Chrome window will open.
2. Go to YouTube and click **Sign in**.
3. Complete Google sign-in in that Puppeteer-opened browser.
4. Open any supported video and confirm the **Ask** button is visible.
5. Return to the terminal and press `Enter`.

Your session will be stored in:

```text
.puppeteer-profile
```

Do not commit that folder to GitHub.

## 5. Run From The Command Line

One channel:

```powershell
node src\index.js https://www.youtube.com/@CleoAbram
```

Multiple channels:

```powershell
node src\index.js https://www.youtube.com/@CleoAbram https://www.youtube.com/@Veritasium
```

Results are saved to:

```text
output/results.json
```

## 6. Run The Frontend

Start the local web app:

```powershell
npm run web
```

Open this in your browser:

```text
http://localhost:3000
```

Then:

1. Paste one channel per line.
2. Click **Get Summaries**.
3. Wait for Puppeteer to open YouTube and scrape each latest video.

## 7. Useful Environment Variables

Only use these if you need to override the defaults.

```powershell
$env:CHROME_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:CHROME_USER_DATA_DIR = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$env:CHROME_PROFILE_DIRECTORY = "Profile 1"
$env:CHROME_PROFILE_MODE = "persistent"
$env:PERSISTENT_PROFILE_ROOT = "$PWD\.puppeteer-profile"
```

Profile modes:

- `persistent`: best default, saves a dedicated Puppeteer login
- `copy`: copies an existing Chrome profile into a temp folder
- `direct`: uses the live Chrome profile directly, usually requires Chrome to be fully closed

## 8. Common Problems

### Ask button is missing

- Make sure you are logged in inside the Puppeteer browser profile, not only in your normal Chrome
- Some accounts or videos may not have the feature
- The scraper will report `ask_not_available` when YouTube does not expose it

### It still shows Sign in

- Run `node src\index.js --login-setup` again
- Finish sign-in inside the Puppeteer browser window
- Press `Enter` in the terminal only after you can see your YouTube profile avatar

### Chrome path not found

Set `CHROME_EXECUTABLE_PATH` manually for that machine.

### Browser opens but wrong profile is used

Set `CHROME_PROFILE_DIRECTORY` manually, for example:

```powershell
$env:CHROME_PROFILE_DIRECTORY = "Profile 1"
```

## 9. Publish Changes

If this is a fresh clone and you want to commit:

```powershell
git add .
git commit -m "Add YouTube scraper frontend and setup guide"
git push origin main
```
