# Single-screen pathway kiosk

Open https://ssolarii.github.io/school/kiosk_1screen/ on the touchscreen. Designed for 1920 × 1080; scales to smaller screens. Select **Full screen** for installation.

Choose a pathway to play its film on this same screen. Finished films play with sound and return to the menu at the end. Computer Science remains the muted sample, looping for 90 seconds. Back or Escape returns immediately and stops audio. There are no popups or pairing steps, and no video banners. If the browser blocks playback, tap the displayed play button.

This demo shares the existing kiosk’s config, logo, styles and media in `../kiosk/`; keep both folders together. Updating a film in `kiosk/config.js` also updates this demo. Serve the repository root over HTTP when running locally. Browser full screen and device volume still require operator setup. No offline cache is provided.
