# inflow

**in flow** is a quiet companion for solo writing and study, with room for meditation or time to yourself. Begin with a small step, stay with it, and leave a place to pick up next time.

[Use the public app](https://provatidis.github.io/inflow/)

## Features

- Optional intention and help choosing a starting point
- 15, 25, and 45 minute presets, one and two hours, and custom durations
- Open-ended sessions that count time spent until you choose to finish
- A gentle time marker that keeps your session open, with an optional firm ending
- A quiet session view with pause, resume, and a hideable clock
- An optional end chime that sounds once at your chosen time
- An optional next-time note, brought back as your starting point for the same activity
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
node tests/app.test.mjs
node --check dist/app.mjs
```

The checks cover duration validation, timed and open-ended sessions, gentle and firm endings, precise pause/resume, alarm scheduling, next-time notes, session restoration, and migration from earlier versions. App checks use a small DOM harness against the shipped HTML and event handlers; device and visual testing are separate.

## Project layout

- `dist/index.html`: page structure and logo
- `dist/styles.css`: responsive layouts and themes
- `dist/app.mjs`: interactions, persistence, and optional chime
- `dist/timer.mjs`: timer state and duration logic
- `tests/timer.test.mjs`: timer behavior checks
- `tests/app.test.mjs`: app interaction and persistence checks
- `.openai/hosting.json`: existing Sites project identity and static output directory
- `.github/workflows/pages.yml`: checks and publishes the app on GitHub Pages

`dist/` is the editable source as well as the published static site; it is intentionally committed.

## Publishing

### GitHub Pages

The `Publish GitHub Pages` workflow checks the timer and publishes `dist/` whenever changes are pushed to `main`. It can also be run manually from the repository's Actions tab. No build step is needed.

The Pages address is https://provatidis.github.io/inflow/.

For the one-time setup, open the repository's **Settings → Pages** and choose **GitHub Actions** under **Build and deployment → Source**. If a workflow ran before Pages was enabled, re-run it from the Actions tab after choosing that source.

### Sites

The original public app remains at https://in-flow.provatidis.chatgpt.site. Sites publishing is separate: publish a matching saved version through Sites to update that address, preserving its current public audience and project ID.

## Local data and sound

Intentions, preferences, and session state stay in each browser's local storage. They are not committed to this repository or shared with other visitors. A browser or device going to sleep may delay the end chime.

Choose **Open ended** to count active time without an alarm. For a timed session, **When time is up** contains the chime and ending options. **Keep going when time is up** is on by default for new sessions; the clock shows additional time without moving you to another screen. Switch it off for a firm ending.

When finishing, you can leave an optional starting point. Saving it brings that note back on your next visit for the same activity. Finishing without a note clears the previous starting point. Existing sessions from earlier app versions are migrated with their original timing behavior.
