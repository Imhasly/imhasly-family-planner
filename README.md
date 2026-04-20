# The Imhasly Family Planner

A simple, fun kanban board for Orla (14), Eliza (12) and Maya (9).

Each girl has her own colour and her own board — **To Do**, **Doing**, **Done** — for
activities, jobs around the home, and home-ed learning. Drag cards between columns,
tag them by type, and pick an emoji. Everything is auto-saved in the browser.

## Running locally

No build step — open `index.html` in a browser, or serve the folder with any static
server (e.g. `python -m http.server`).

## Live site

Hosted via GitHub Pages — see the repo's **Settings → Pages** for the URL.

## Where your data lives

Cards, comments, photos and notes are saved in your **browser's localStorage**
for the site's origin. That means:

- Tasks **persist across site updates** — pushing new code doesn't wipe the board.
- Data is **per-browser and per-device** — Orla's iPad and Eliza's laptop each have
  their own copy.
- If you clear site data in your browser settings, or use a different browser, the
  board will be empty on that device.

Use **Export backup** (footer) to download a JSON file of the board, and
**Import backup** to restore it on another device or after clearing data.
