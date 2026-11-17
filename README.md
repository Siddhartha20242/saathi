# Saathi

**Someone who has done it shows the way once. Everyone with the group code gets a patient guide that highlights each button, in their own language. Saathi highlights. You do it.**

Saathi is a Chrome extension for older parents, students and people far from home who get stuck on bill, bank and government websites. A son, a daughter or an experienced friend records the task once. After that, the person following it sees one step at a time, with the right button outlined on their own screen. If the website changes, the guide finds the button again. If they are still stuck, a helper on a phone can tap the right button from afar, and it lights up on the person's screen.

It never clicks, types or submits for anyone.

Built for the #BuildHybridAI hackathon with Firebase AI Logic. Licence: MIT.

## Try it in two minutes, no install

**https://paperwork-decoder.web.app/try.html**

The practice website (a made-up electricity board) is on the left and the real Saathi panel is on the right. A short guide at the top says what to press. The page stands in for the Chrome extension and runs the extension's own page script, so you are trying the real logic.

1. On the right, press **Start a new group**. Under *Show the way once*, name a path and press **Start**.
2. On the left, press *Pay your bill*, click the two boxes, press *Check bill*, then *Pay now*. Press **Finish and save**.
3. Above the website, choose **Labels renamed**. Under *Follow a path*, press **Start**. The guide finds each button even though its name changed, and tells you how it found it.
4. Switch the language to नेपाली or हिन्दी. Turn on large text or read-aloud.
5. Press **Ask my helper**, then open [/help.html](https://paperwork-decoder.web.app/help.html) on a phone, enter the group code and tap a control.

No login is needed. Nothing is paid and nothing on the practice website is real.

**On-device model:** it runs only in desktop Chrome with the built-in Gemini Nano model. Without it, everything still works except the last re-finding step (a button whose label *and* internal name both changed). The panel's header shows whether the model is available.

## Where each part runs

| Task | Runs | Why |
|---|---|---|
| Finding a recorded step again on the live page | On-device only | The page may be a bank or government page. It is read on the laptop and never sent anywhere. |
| Explaining what a page wants | On-device first, cloud fallback | The fallback sends only the page title and up to 60 button and box names. Never anything typed. |
| Translating a path's step sentences into Nepali and Hindi | Cloud only, once, when the path is saved | The on-device model writes only English, Spanish and Japanese. The cloud sees the path name and the step sentences, nothing else. |
| Helper taps a control on a phone | No model | The helper sees only the names of the controls, written to Firestore. |

Every model call goes through one file, [src/firebase.js](src/firebase.js), using Firebase AI Logic's hybrid modes. No other AI service is used. The cloud model is named explicitly (`gemini-3.5-flash-lite`).

**Why hybrid and not cloud only.** A cloud-only version would work, but it would have to upload the labels of the live page, which can be a bank or government page, at every step. Saathi keeps that on the laptop and uses the cloud only for what the small model cannot do (writing Nepali and Hindi) and only on the path's own written steps. This is a privacy argument. It is not a claim that the cloud is impossible.

### Verify the hybrid split yourself

1. Open the try page in desktop Chrome and expand **Developer checks** in the panel.
2. Press **Run on this laptop**. The result says *Ran: on this laptop*.
3. Press **Run in the cloud**. The result says *Ran: in the cloud*.
4. Record and save a path, then follow it on **Labels renamed**. Under the step card, the line says how each step was found: *by its label*, *by the link or box underneath*, or *by the on-device model*.
5. Press **Explain this page**. The result says *On this laptop. Nothing left it.* or, if the model is unavailable, *In the cloud. Sent: the page title and N labels, 0 typed values.*

## Firebase products used

| Product | Use |
|---|---|
| **AI Logic** | Every model call, on-device and cloud, in hybrid modes |
| **App Check** | Enforced. The hosted panel uses reCAPTCHA Enterprise. A local debug token exists only in development builds and is compiled out of the release build. |
| **Authentication** | Anonymous sign-in, so there are no names or passwords |
| **Firestore** | Shared paths and live help requests, with [security rules](firestore.rules) and an on-laptop cache |
| **Remote Config** | `cloud_enabled` (off-switch for every cloud call), `max_labels`, `languages` |
| **Hosting** | The panel, helper page, try page and practice website |

Toggle `cloud_enabled` to false in the Firebase console and the panel's cloud chip changes to *Cloud: switched off* on the next load. Translation is skipped and *Explain this page* stays on-device.

## What is saved and what is sent

| | Page addresses | Button and box names | What you typed | Pictures of the page |
|---|---|---|---|---|
| **Saved in a path** (Firestore) | Path only, no part after `?` or `#` | Yes, in order. A name that looks like an email or number is dropped. | Never | Never |
| **Sent to the cloud for translation** | No | The path name and the English step sentences | Never | Never |
| **Sent to a helper's phone** | No | Names only, and the person sees exactly what will be sent before pressing Send | Never | Never |
| **Sent anywhere when re-finding** | No | No. It stays on the laptop. | Never | Never |

The page script reads a field's label, never its value. A path step has no field that could hold a typed value ([src/path.js](src/path.js)), so one cannot be saved by mistake. Help requests are deleted when the person stops sharing.

## What we measured

All numbers are from the real on-device model in desktop Chrome. Reproduce them with the test pages and scripts below.

**Finding a step again** ([refindeval.html](refindeval.html)): five made-up sites, 25 recorded steps, each site changed four ways, 80 cases.

| Change | Result |
|---|---|
| Button moved, same label | 25 of 25, by plain code |
| Label renamed | 23 of 25 |
| Label renamed and button moved | 22 of 25 |
| Control removed (the right answer is "it's gone") | 4 of 5 |
| **Overall** | **74 or 75 of 80 across runs, with one wrong pick** |

Over the project the number went from 63 of 80 (first prompt) to 74 of 80 after three changes: remove controls that belong to other steps, ask in two different orders and require agreement, then check the pick with a yes/no question. Those changes trade a few "not sure" answers for far fewer wrong picks (17 down to 1). A wrong pick is the harmful failure, because it sends a person to the wrong button.

Caveats: the improvements were designed after looking at failures on these same five sites, so the real-world figure is likely a little lower. Each run takes a different path through the model, so results move by a case or two.

**Things we tried that did not help, and removed or did not adopt:**
- Structured (schema-constrained) output for the model's answers: 44 right against 49 for plain text on the 55 model cases, because the constrained model said "not sure" about twice as often. Plain text is used for re-finding. Structured output is used where an answer is a longer shape, for the cloud translation.
- Offering only same-kind controls first (buttons with buttons): slightly better on renamed-and-moved steps, but 3 wrong picks against 1 when a control was removed. Reverted.

**On a real website.** The extension read the page and drew the highlight on the right control on 5 of 6 real sites tried (Wikipedia, GitHub's sign-in page, Nepal Electricity Authority, Nepal Department of Passports, the Bangladesh national portal), including labels written in Devanagari and Bengali. The sixth refused the automated browser. On the passport site a pop-up notice covers the page, and Saathi says so.

**Explaining a page.** Checked on the practice site's bill page in both modes. With the on-device model it described the page correctly in plain words on the laptop (15 seconds on first use). In a browser with no model it fell back to the cloud and answered in 3 seconds, sending the page title and 8 labels and 0 typed values, as the result line states.

**Speed.** A model call takes about 0.4 to 0.6 seconds once the model is loaded (10 to 15 seconds the first time). A step that needs the model takes three calls, so about 1.5 seconds. Steps found by label or by link address take milliseconds.

**Tests.** 59 unit tests (`npm test`). Three end-to-end scripts drive a throwaway headless Chrome with the extension loaded and run against the live site: [tools/e2e.mjs](tools/e2e.mjs) (record, save, follow), [tools/e2e-help.mjs](tools/e2e-help.mjs) (ask for help, a phone-sized helper taps, the highlight moves, the request is deleted) and [tools/e2e-try.mjs](tools/e2e-try.mjs) (the same flow on the judge demo page). The on-device model is not available in that headless Chrome, so the model path was checked separately in a normal Chrome.

## Known limits

- **Laptop only.** The on-device model runs in desktop Chrome, not on phones. The helper page does work on a phone, because the helper needs no model.
- **The on-device model reads only English, Spanish and Japanese.** On a website in Nepali or Bengali, a renamed button can still be found by its link address or internal name, but not by the model. Saathi then says it is not sure.
- **The hardest case is not solved.** On the practice site's `?v=3` copy (labels and internal names both renamed), the model found one of two steps and declined the other. Declining is the safe failure.
- **Practice website only for a full run.** Real sites with logins, pop-ups and multi-page forms were checked for reading and highlighting, but not for full record and follow.
- **Nepali and Hindi were not reviewed by a native speaker.** One early Nepali translation added a detail that was not in the step. The prompt now forbids that, and later samples did not repeat it, but review is still needed.
- **Read-aloud was not tested with Nepali or Hindi voices.** It uses the browser's own voices, and many computers have no Nepali voice. The step card is always shown on screen.
- **A group code is the only key.** Anyone who learns it can read that group's paths and help requests. That suits a family, not a public community.
- **Security rules:** the allowed actions are tested. The refusals (for example a helper trying to change the list of controls) are not tested against the Firebase emulator.
- **Not an offline app.** The websites Saathi guides need the internet anyway.
- **No real user yet.** This was built and tested by one person on practice sites and public pages. It has not been used by a parent, student or migrant worker.
- **The helper page is heavy** (about 200 KB compressed) because it shares code with the panel.

## Install the extension

The try page needs no install. To use the extension itself:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Choose **Load unpacked** and select the [extension](extension) folder.
3. Open any website and click the Saathi icon. The side panel loads the hosted panel, so it works with App Check.

## Run it yourself

You need Node 20.19 or newer and your own Firebase project with AI Logic (Gemini Developer API), App Check, anonymous Authentication, Firestore and Remote Config enabled.

```bash
npm install
cp .env.example .env     # fill in your own Firebase web config and reCAPTCHA key
npm test
npm run dev              # http://localhost:5173/try.html
npm run build:prod       # release build; the App Check debug token is compiled out
npx firebase-tools deploy --only firestore:rules,remoteconfig,hosting
```

For local development set `VITE_APPCHECK_DEBUG=true`, copy the debug token the console prints, and register it under App Check, Apps, Manage debug tokens. Never commit it. `.env` is git-ignored and `.env.example` is blank. The Firebase web API key is public by design in any web app and appears in the deployed pages. App Check and the security rules protect the project.

The Firebase project is named `paperwork-decoder`, from an earlier idea. It is only a name.

## Where things are

| | |
|---|---|
| [src/firebase.js](src/firebase.js) | The only file that calls a model |
| [src/refind.js](src/refind.js) | Finding a step again: label, then link or name, then the on-device model |
| [src/path.js](src/path.js) | What a path is; what is dropped before saving |
| [src/backend.js](src/backend.js) | Auth, Firestore, Remote Config, live help, cloud translation |
| [src/panel.js](src/panel.js), [panel.html](panel.html) | The side panel |
| [src/helper.js](src/helper.js), [help.html](help.html) | The helper's phone page |
| [src/try.js](src/try.js), [try.html](try.html) | The judge demo that stands in for the extension |
| [extension](extension) | The Chrome extension (page script, side panel shell) |
| [public/demo](public/demo) | The practice website |
| [docs/test-shots](docs/test-shots) | Screenshots from the test runs |
