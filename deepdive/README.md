# Deep Dive

A six-question, 16:9-friendly browser game for the Itz’at STEAM Academy showcase. The [hosted game](https://ssolarii.github.io/school/deepdive/) supports password-unlocked, free-only OpenRouter review on modern browsers without a local server. See **Staff access in the hosted game** below.

For optional local DeepSeek review, double-click **Start Deep Dive.cmd**, or run `python serve.py --open` in this folder and use `http://127.0.0.1:8765/`. This requires Python 3.9+ and your existing DeepSeek bridge running on `http://127.0.0.1:8000` with a valid signed-in session. Keep both servers running while playing. The game and bundled fonts also work offline by opening `index.html`, with guide review for answers outside the starter chart.

## At the booth

1. Use the full-screen button in the top bar to hide the header and fill the display. Escape or **Exit full screen** returns to normal. Use 1280×720 or larger, ideally 16:9.
2. Let a visitor choose timed or untimed play, then start. Each run selects six from an eighteen-question bank and favors unseen prompts on replay.
3. Familiar answers score instantly from the starter chart. Other answers go to the configured AI reviewer while the timer is paused. If it is uncertain, locked or unavailable, a guide can click **Ask a guide** and assign 100, 300, 600, or 1,000 metres. That guide decision is remembered on this laptop for future rounds. Rejected AI answers can also be sent to a guide for a second opinion.
4. **Guide tools** also let staff clear those additions. They do not change the built-in starter chart.

The optional Firebase leaderboard saves only after a visitor explicitly chooses to save a timed six-question run. It uses an anonymous account and a short alias, not an email or real name. See `README-leaderboard.md` for setup, limits and disabling it. No advertising or required sound. The last six questions and guide-added answers are saved in this browser’s local storage. Typing is captured automatically on questions; Enter submits or continues, while dialogs and functional controls keep normal keyboard behavior.

## Scoring and AI

The starter depths and AI depths are editorial estimates for gameplay, **not measured rarity**. The reviewer sees the trusted question and starter examples so it can map synonyms, judge validity and assign one of the four depth bands. Low-confidence judgments, uncertain rejections and uncertain 1,000 m awards go to a guide. A valid response must pass strict JSON, boolean, score-band and explanation checks before the game uses it.

### Staff access in the hosted game

1. Open **Table settings** on the start screen.
2. Choose **Free OpenRouter review**, enter the shared staff passphrase, and select **Unlock free AI**. Unlocking also saves this review mode for this browser.
3. Select **Test connection** to make a real, non-seeded model request before the event. Close settings to play.
4. Select **Lock free AI** when leaving the screen unattended. Reloading, closing or navigating away also clears the unlocked key; staff must unlock each device separately. The review-mode preference persists, but the password and decrypted key do not.

The browser derives an AES-256-GCM key from the passphrase using PBKDF2-HMAC-SHA-256 with 600,000 iterations and a random 16-byte salt. Each vault uses a random 12-byte IV and an authentication tag. Only `ai-key.vault.json`, the encrypted key, is published. Decryption happens locally using Web Crypto on HTTPS or localhost. The decrypted key remains in page memory and is sent only in an authorization header to OpenRouter's exact official HTTPS chat-completions endpoint. Redirects are rejected. The password is not transmitted, saved in browser storage or included in model requests.

Free review tries `nvidia/nemotron-3.5-lightning:free`, then `cohere/north-mini-code:free` if the first request fails. Each attempt has an 8-second total deadline, including response reading. All provider price caps are zero, paid models are excluded, and web-search plugins are disabled. Definite or low-confidence verdicts are not sent to another model for a different opinion. Rate limits, removed models, network errors and locked access fall back to guide review. The question, starter examples and visitor answer are sent to OpenRouter; avoid entering personal information.

This is an encrypted shared credential, **not a staff login or a server-side secret vault**. Anyone with the passphrase can recover and use the API key. Public ciphertext can be downloaded for offline password guessing, so use a long, unique passphrase and share it privately. Browser extensions or injected page scripts can access an unlocked key. Keep the provider account on a free-only/dedicated key, revoke exposed keys, and do not use the staff passphrase elsewhere.

To create a replacement vault, revoke the old provider key first, back up the existing encrypted JSON outside this published folder, and explicitly remove the old file. Run `python tools/protect-key.py --port 18973`, then open the complete private loopback URL it prints. Choose and confirm a passphrase of at least 14 characters and optionally enter the replacement OpenRouter key. The browser encrypts and checks a round trip before sending only ciphertext to the helper. Alternatively, the helper can take its key from `OPENROUTER_API_KEY` in its process environment. Stop the helper after saving and publish the new encrypted JSON. Never commit a plaintext key, password or `.env` file. Lost passphrases cannot be recovered; replace the vault instead.

The default `/api/judge` endpoint is supplied by `serve.py`. It calls your existing bridge at `http://127.0.0.1:8000/v1/chat/completions` using `deepseek-chat` with thinking and search disabled. Accepted judgments are cached in memory for up to thirty minutes to avoid repeat model calls. Guide additions are still separate, and take priority in the game.

To use another bridge address, set `DEEP_DIVE_DEEPSEEK_URL` to its full chat-completions URL before starting the game server. To change models, set `DEEP_DIVE_MODEL`. No changes to the Verity bridge are required.

### Free-only OpenRouter fallback

Set `OPENROUTER_API_KEY` in the local server's environment, then restart the Deep Dive launcher. The key stays on the server; never put it in a browser setting, URL, JavaScript file, or published repository. Deep Dive does not read `.env` files automatically. If you use one to set the environment, keep it outside the served game folder.

When the local DeepSeek bridge fails, the adapter tries `nvidia/nemotron-3.5-lightning:free`, then the independent `cohere/north-mini-code:free` pool if needed. Reasoning is disabled to keep reviews fast; prompt-directed JSON is checked against the same local review schema. An optional `DEEP_DIVE_OPENROUTER_MODEL` override must be `openrouter/free` or end in `:free` (for example `recursive/flint-v1.0:free`); paid model names are rejected. Provider price caps for prompt, completion, request, and image are all zero, and the web-search plugin is explicitly disabled. There is no escalation to a paid model. [Lightning model](https://openrouter.ai/nvidia/nemotron-3.5-lightning:free), [backup model](https://openrouter.ai/cohere/north-mini-code:free).

The adapter allows 6 seconds for DeepSeek and 8 seconds per free fallback, at most 22 seconds in total. Body reads share an absolute deadline, so periodic keepalive bytes cannot extend the wait beyond the browser's 35-second limit. A low-confidence verdict still goes to a guide; it does not ask another model to obtain a more favorable answer. Free-model availability and rate limits can still send a review to a guide.

The Table settings connection test uses an answer outside the built-in chart so it actually exercises the model. `/api/health` now separates bridge reachability from tested model readiness and reports `login_required` when the saved DeepSeek token has expired. A listening bridge alone is not reported as a working AI reviewer.

Before a game, table staff can open **Table settings** at the bottom of the start screen. Enter an AI endpoint URL, choose **Deep Dive reviewer** or **OpenAI-compatible**, and optionally test the connection before selecting **Save settings**. The URL, format and model are saved in this browser's local storage, survive new games/reloads/browser restarts, and remain until **Use default** or site data is cleared. They are specific to this browser and site, not shared with other laptops. Existing endpoint overrides are migrated automatically. No staff authentication is claimed; this is a booth convenience, not an access-control system.

For the supplied local launcher, use `http://127.0.0.1:8765/api/judge` (replace the port with the game port printed by the launcher) and **Deep Dive reviewer**. Leave the URL blank for the same-origin `/api/judge` default. The local review adapter permits requests from `https://ssolarii.github.io`, not arbitrary websites. Restart an older adapter after updating `serve.py`. Chrome may ask the staff member to allow local-network access; they must allow that themselves. [Chrome's local-network permission guidance](https://developer.chrome.com/blog/local-network-access) explains the prompt. HTTPS remote endpoints must also allow this game's origin through CORS; the setting cannot override browser security protections.

A **Deep Dive reviewer** receives a POST body like:

```json
{"questionId":"language","prompt":"Name a programming language.","answer":"Erlang","allowedDepths":[100,300,600,1000]}
```

It must respond with JSON like `{"valid":true,"depth":600,"explanation":"Erlang is a programming language."}` or `{"valid":false,"explanation":"That is not a programming language."}`. A response with `"needsReview":true` opens guide review. **OpenAI-compatible** sends chat-completions messages to the full URL (for example `https://your-router.example/v1/chat/completions`), using the saved model (default `deepseek-chat`) and requesting structured review JSON. Malformed or low-confidence model output falls back to a guide. Custom routers must allow browser requests without a private API key; keep those provider keys and account sessions on the server. The separate **Free OpenRouter review** mode uses the encrypted staff vault described above. The local adapter allows at most 22 seconds across its model attempts; the browser falls back to a guide on failures or after thirty-five seconds. Only question and answer data go to the bridge; the browser never accesses its session files.

## Editing the starter chart

`questions.js` holds all eighteen prompts and their answer bands. Each question has an `id`, `group`, `prompt`, one-sentence `fact`, and four answer lists ending in the awarded depth. Keep the assignment JSON-compatible: double-quoted keys and strings, with no trailing commas. Both the browser and local adapter read this same catalog. Restart the local game server after editing it. Keep at least one computing, science, and Belize-group prompt for balanced runs. Short aliases and likely spellings can be added to each band.

## Visual and research notes

The visual language borrows a field log and depth gauge, not a nautical chart’s navigational authority. [Smithsonian’s exhibit guidance](https://www.sifacilities.si.edu/sites/default/files/Files/Accessibility/accessible-exhibition-design1.pdf) informed large, plain-language prompts and optional sound; the [school information package](https://www.itzat.edu.bz/wp-content/uploads/2024/02/Itzat-STEAM-Academy-Information-Package-2024.pdf) informed the Itz’at/Belize context. The real reef photograph is by Curt Storlazzi / USGS, Public Domain; provenance is in `assets/ARTWORK.md`. The interface shifts from warm paper to reef green, twilight blue and abyss navy at 600, 1,800 and 3,600 m. All questions, controls, scores, gauge markings and the vehicle remain live HTML/CSS/SVG. Bitter and Atkinson Hyperlegible Next are bundled locally with their licenses. A brief vignette and sonar pulse reward rare answers, with a stronger treatment for 1,000 m. Reduced-motion mode disables expressive movement. Short synthesized sounds distinguish starting, submitting, rejecting, timing out and completing a dive; mute is remembered.

## Before the event

- Have a teacher or student reviewer check the prompt and answer lists for local fit, synonyms, and any answers that should change depth.
- Run at least one full timed and untimed round on the event laptop; test F11, the keyboard, sound on/off, and the guide decision flow.
- If using an online AI judge, test it on the exact event network and keep a guide at the booth as fallback.
