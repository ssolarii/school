# Optional leaderboard

The leaderboard is an optional addition to Deep Dive. It uses anonymous Firebase Authentication and Cloud Firestore REST calls directly from the browser. No email, legal name, or other profile information is requested. The shipped configuration is enabled for project `deepdive-fdc89`, after live Console setup and a successful save/read test. Set `enabled: false` in `leaderboard-config.js` to remove the feature. The single `Booth check` entry is an actual setup playtest (1,500 m), not a sample player.

This is an exhibition feature, not a tamper-proof contest system. A determined visitor can alter browser code or submit a plausible score directly using anonymous Auth, so the displayed depths are not independently verified. Do not use these entries to award prizes, certify results, or make other consequential decisions. Server-side score adjudication is intentionally out of scope.

## What players choose to share

Only a completed timed run with six answers can be submitted. A player must explicitly select **Save to leaderboard**, review or change the suggested nickname, then select **Save score**. Untimed runs are not eligible. A score contains only an anonymous Firebase UID, a 1–20 character nickname, the integer depth, a random run ID, and a server timestamp. Each save creates a new entry; there is no profile or score editing flow.

Aliases accept ASCII letters, digits, spaces, periods, underscores, and hyphens. They are displayed as text, never interpreted as markup. Do not put a real name or private information in a nickname. Scores and aliases in this collection are publicly readable, as required for a public leaderboard.

## Firebase setup

1. In Firebase project `deepdive-fdc89`, add a Web app and copy its **public web configuration**. The web API key is intended for browser configuration; Firebase Security Rules, not secrecy of that key, protect Firestore.
2. Enable **Authentication → Sign-in method → Anonymous**.
3. Create the default Cloud Firestore database if needed. In **Firestore Database → Rules**, deploy the contents of `firestore.rules`. These rules permit public reads from only `deepDiveScores`, restrict creates to an authenticated user's exact five-field score shape, and deny all updates, deletes, and access to other document paths.
4. Set `apiKey` in `leaderboard-config.js` to the Web app API key. Keep `enabled: false` during setup and rule deployment. The `projectId` should remain `deepdive-fdc89`.
5. After completing the live checks below, change `enabled` to `true` to expose the feature.

The API key is public Firebase client configuration, not a service-account key. Never put a service-account credential, private key, or admin SDK secret in this folder or browser code.

## Live checks before enabling

- With `enabled: false`, verify no score write occurs. Untimed and incomplete runs must not submit.
- With the intended project config enabled, open the board and verify it handles an empty collection and then lists scores in descending depth order.
- Complete a timed six-answer run. Confirm nothing is written before the player explicitly saves, then save using a nickname and verify the resulting document has only the documented fields.
- In Firestore Rules Playground or a disposable authenticated test client, confirm unauthenticated creates, mismatched `playerId`, extra/missing fields, unsafe or long aliases, out-of-range/non-integer depths, malformed session IDs, non-server timestamps, updates, deletes, and writes to other paths are denied. Confirm a valid anonymous create and public collection read succeed.
- Try offline or blocked-network behavior and a narrow mobile viewport. The game should remain playable if the optional service is unavailable.

## REST requests and document shape

Anonymous identity is created only after the player opts in, through Firebase Auth `accounts:signUp` with `returnSecureToken: true`. The ID token and expiry are cached in memory and `sessionStorage` for the current browser tab. If that token expires, another anonymous identity may be created on the next save; there is no account-recovery promise.

Firestore reads use a single `depth DESCENDING` order with a limit of ten, avoiding a composite index. Writes use the Firestore `documents:commit` endpoint with a server-side `REQUEST_TIME` transform for `createdAt`. Each in-page save attempt keeps a stable random document and run ID; on a timeout it checks that document before retrying and uses a create-only precondition to avoid an accidental duplicate from an ambiguous response. The dialog requests can time out after twelve seconds and offer retry.

```text
deepDiveScores/{random document ID}
  playerId: string       // Firebase anonymous UID
  alias: string          // chosen nickname
  depth: integer         // 0–6000
  sessionId: string      // random UUID for this submitted run
  createdAt: timestamp   // server request time
```

Firebase references: [anonymous Authentication REST API](https://firebase.google.com/docs/reference/rest/auth), [Firestore `runQuery`](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/runQuery), [Firestore `commit`](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit), [server timestamp write transform](https://firebase.google.com/docs/firestore/reference/rest/v1/Write), and [field validation in Security Rules](https://firebase.google.com/docs/firestore/security/rules-fields).
