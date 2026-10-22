# Booth release check — 21 October 2026

Fresh Chrome browser walkthrough at 1280 × 570 viewport (the available desktop window), with screenshots retained in the accompanying audit folder. This is a focused design/interaction check, not full WCAG conformance certification.

1. Start and question flow: healthy. Three complete timed, six-question runs reached results. Enter submitted and advanced; clicking the question before typing focused the answer automatically.
2. Scoring and depth: healthy. Live DeepSeek accepted an unfamiliar scientific tool. Curated answers produced the four expected bands; the same interface visibly transitioned through reef, twilight and abyss. Editorial depths are not measured answer rarity.
3. Visual finish: addressed. Removed the generated backdrop from the live design. Real public-domain USGS photography, Bitter headings, Atkinson Hyperlegible body, readable 14px supporting labels, stage-aware text colors, and purposeful reward/descent motion replace the previous treatment.
4. Fullscreen: verified theatre fallback hides the masthead, fills the viewport, and exits with Escape. The automated browser does not grant native fullscreen activation; a physical click/native fullscreen should still be checked on the event laptop. Exit control is positioned away from the status text.
5. Optional leaderboard: healthy live save and public read after reload. Anonymous Authentication enabled and collection-specific rules published through Firebase Console. One real test run is saved as `Booth check`, 1,500 m. No email or legal name collected. Entries are not tamper-proof; do not use for prizes.
6. Accessibility boundaries: labels, keyboard flow, native dialogs, focus rings, mute and reduced-motion handling retained. No complete screen-reader, manual contrast, event-laptop or sound audibility audit is claimed.

The independent auditor raised a possible timer concern but could not establish that the timer counted down while review was still pending. Source review confirms submission stops its interval and rejection restarts from the remaining time; no unsupported timer defect was reported as fixed.

## Repeatable checks

From this folder:

    node --test tests/leaderboard.test.cjs
    python -m unittest discover -s tests
    node --check app.js
    node --check leaderboard.js

The leaderboard regression was observed failing before the Firestore document resource-name correction, then passing. Eleven local adapter tests cover trusted catalog usage, validation, review thresholds, caching, request boundaries and service failure fallback. These use controlled upstream responses rather than spending model calls.

Before the event, check a physical fullscreen click, speaker volume, untimed play and the exact event Wi-Fi. The game keeps guide review when automatic judging fails, and the leaderboard remains optional.
