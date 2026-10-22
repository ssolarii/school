# Itz'at Pathways Kiosk

A browser-only, two-screen kiosk. The touchscreen uses `index.html`; the TV uses a popup at `display.html`. The two windows coordinate through `BroadcastChannel`, `localStorage` events, and `window.postMessage` when the popup has an opener. There are no Electron, Windows, or device-specific dependencies.

## First-run checklist

1. The pathways are **Science + Tech**, **Computer Science**, and **Engineering & Manufacturing**. All three play their finished school films. The files are connected in [`config.js`](./config.js).
2. When school videos are ready, add them in `media/`, update the relative `video` and poster `image` paths, and set that pathway's `sample` to `false`. [Media credits and sources](./MEDIA-CREDITS.md) document the current samples.
3. Finished films (`sample: false`) play once with sound and return both screens home when they end. Samples loop muted for `presentationSeconds` (90 seconds). This setting is also the maximum session length; increase it if a future finished film is longer.
4. Serve this folder over a local or HTTPS static web server. Do not rely on double-clicking the HTML files: browsers can restrict JavaScript module loading from `file:` URLs.

For a local Windows setup with Python installed, open a terminal in this folder and run:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8080/` in Chrome. Keep both windows on exactly the same address and port. For a Chromebook, put the complete folder on any HTTPS static host approved by the school, then open that hosted address in Chrome.

## Published kiosk

The GitHub Pages address is `https://ssolarii.github.io/school/kiosk/`.
Operator settings are at `https://ssolarii.github.io/school/kiosk/settings/`.
Keep `/school/kiosk/` in these addresses: `/settings` at the domain root is a different location.
No Python server is needed for the hosted version. It needs internet access to load the site and media; this is not an offline-installed app.

## Operating the kiosk

1. Open the kiosk normally. If its second browser window is missing, an **Open window 2** button appears. Select it to open the TV window. Browsers require a direct user action to open this popup.
2. Move the new display window to the TV/extended screen, maximize it, and press its **Fullscreen** button. Fullscreen is intentionally requested from the TV itself because browsers do not permit a remote page to force it.
3. Once window 2 connects, the launch button disappears automatically. Tap a pathway: its icon moves into the selected layout and the text reveals on a deep ink-to-blue/teal surface. The TV shows the full film without added banners, logo overlays, or shading; the original film's own subtitles remain visible.
4. The finished film returns both windows home when it ends. If Chrome blocks sound, tap **Tap to play with sound** in the TV window. This grants the required gesture for playback in that window. The touchscreen also resets after the configured idle time.

Tap the selected-pathway panel or press Escape to return early. Press R to restart. If window 2 closes, **Open window 2** returns; reopening it restores the active presentation. "Connected" refers to the paired browser window: move that window to the extended TV display manually.

## Hidden settings

Open `/settings` on the same address and port as the kiosk, for example `http://127.0.0.1:8080/settings`. The static server redirects this to `/settings/`. No settings link is shown on the visitor screens. This is a hidden operator page, not a password-protected page.

- TV idle screen: switch to an edge-to-edge muted looping video. Place a video in `media/` and enter `./media/filename.mp4`, or use a direct HTTPS MP4 URL. The default sample is already available. An unavailable video displays a recovery message.
- Edit the TV idle heading/subtitle, touchscreen selection heading, selected-pathway instruction, and return hint.

Save settings to update open windows immediately. Settings persist in this browser for this exact origin (host and port); a different browser, port, or device has its own settings. Restore defaults resets these customizations.

Video banners have been removed, including the old banner settings; saved banner preferences are ignored. The touchscreen keeps its “Tap to return” hint. Reduced motion skips the icon movement and text reveal. The TV has no return button. Its Fullscreen button hides when fullscreen is active or the content area is approximately 16:9, and updates on resize.

## Browser behaviour

- If the display window is blocked, the touchscreen says so and lets the operator retry. Allow popups for the kiosk address.
- All three finished school films play once with audio and return home at the end.
- Audible autoplay depends on browser permission. If needed, the TV offers **Tap to play with sound**. The idle film and stock sample stay muted. Leaving a film stops its audio immediately.
- If Chrome pauses the video when changing windows or displays, the TV attempts to resume it. A failed media request shows **Video could not load. Tap to retry**, rather than mislabelling it an autoplay permission problem.
- If the TV popup is closed, use the **Open window 2** button that reappears on the touchscreen. Reloading either window reconnects automatically.
- `BroadcastChannel` is the primary pairing mechanism. `localStorage` and opener messaging are fallbacks; private browsing and strict storage settings may reduce the fallback options.

## Assets included

- `assets/itzat-steam-academy-logo-white.png`: supplied high-resolution white logo lockup, used on dark screens.
- `assets/itzat-steam-academy-logo-colour.png`: supplied coloured alternative logo.
- `assets/itzat-mascot-mark-white.png`: supplied mascot mark, used only as the browser tab icon.
- `assets/1.png` and `assets/2.png`: supplied pathway mockup artwork.
- `media/*-sample.mp4` and matching JPG posters: three downloaded 720p stock samples. See `MEDIA-CREDITS.md`.
- `media/healthscience_final.mp4` (66.605 seconds) and `media/engineering_final.mp4` (52.949 seconds): the supplied 1080p films, copied without transcoding, with extracted poster frames.
- `media/science-tech-loop.mp4`: the supplied 7.8-second reference clip, retained as an unused original.

## Test

```powershell
node --test tests/*.test.mjs
```

The built-in tests cover selection, timed return, idle reset, failed-channel fallback, and invalid saved settings.
For browser tests, install Playwright (`npm install --no-save playwright`) and Chrome, serve the folder, then run:

```powershell
$env:KIOSK_URL = 'http://127.0.0.1:8080/'
$env:KIOSK_TEST_PAUSE = '1'
node tests/browser-smoke.cjs
```

The same tests accept the published URL. They check all three videos actually advance, the three connection modes, 720p layout, reload/reconnect, early return and interrupted-playback recovery. Settings are local to the current browser profile, not shared with other devices.
