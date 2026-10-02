# inflow

**in flow** is a quiet timer for focused work, creativity, or meditation.

[Use the public app](https://in-flow.provatidis.chatgpt.site)

## Features

- Optional intention and help choosing a starting point
- 15, 25, and 45 minute presets, one and two hours, and custom durations
- A quiet session view with pause, resume, and a hideable clock
- An optional end chime, with Finish or Continue when time is complete
- Light and dark themes
- Browser-local saving for preferences and session recovery
- Confirmations and messages inside the page, without browser popups

## Run locally

The app uses plain HTML, CSS, and JavaScript modules. No package installation or build step is needed.

With Python 3 installed, run this command from the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8765 in a browser. Use an HTTP server rather than opening the HTML file directly, so JavaScript modules load correctly.

## Check the timer

With Node.js 18 or later:

```sh
node tests/timer.test.mjs
node --check dist/app.mjs
```

The timer checks cover duration validation, hour formatting, pause/resume, expiry, session restoration, continuation, and migration from the original 30-minute app.

## Project layout

- `dist/index.html`: page structure and logo
- `dist/styles.css`: responsive layouts and themes
- `dist/app.mjs`: interactions, persistence, and optional chime
- `dist/timer.mjs`: timer state and duration logic
- `tests/timer.test.mjs`: timer behavior checks
- `.openai/hosting.json`: existing Sites project identity and static output directory

`dist/` is the editable source as well as the published static site; it is intentionally committed.

## Publishing

This repository is the source for ongoing development. The public app is hosted on Sites. GitHub commits do not automatically deploy: publish a matching saved version through Sites to update the live app, preserving its current public audience and project ID.

## Local data and sound

Intentions, preferences, and session state stay in each browser's local storage. They are not committed to this repository or shared with other visitors. A browser or device going to sleep may delay the end chime.
