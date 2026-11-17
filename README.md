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
4. Press **Speak** and say, in Nepali, Hindi or English, what you need, for example "I need to pay the electricity bill". Saathi understands you, picks the matching path and starts guiding. It asks for the microphone; the recording goes to the cloud only when you press Speak.
5. Switch the language to नेपाली or हिन्दी. Turn on large text or read-aloud.
6. Press **Ask my helper**, then open [/help.html](https://paperwork-decoder.web.app/help.html) on a phone, enter the group code and tap a control.

No login is needed. Nothing is paid and nothing on the practice website is real. It works on a phone too: the website sits above Saathi, so both are on screen at once (see below).

**On-device model:** it runs only in desktop Chrome with the built-in Gemini Nano model. Without it, everything still works except the last re-finding step (a button whose label *and* internal name both changed). The panel's header shows whether the model is available.

## Where each part runs

| Task | Runs | Why |
|---|---|---|
| Finding a recorded step again on the live page | On-device only | The page may be a bank or government page. It is read on the laptop and never sent anywhere. |
| Explaining what a page wants | On-device first, cloud fallback | The fallback sends only the page title and up to 60 button and box names. Never anything typed. |
| Translating a path's step sentences into Nepali and Hindi | Cloud only, once, when the path is saved | The on-device model writes only English, Spanish and Japanese. The cloud sees the path name and the step sentences, nothing else. |
| Understanding a spoken request (Nepali, Hindi or English) | Cloud only, when the person presses Speak | The on-device model does not understand Nepali speech. The cloud hears the recording and sees the titles of the group's paths, nothing from the website. |
| Finding a step when the on-device model is unsure, or there is none | Cloud, only if the person presses a button after seeing what would be sent | The cloud sees the old label and the names of up to 60 buttons and links near the step. A label with a personal detail is replaced first. Nothing typed. |
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
| **Sent to the cloud when you press Speak** | No | Only the titles of your group's paths, which the group wrote | Never | Never. A short voice recording is sent, once, and not stored. |
| **Sent to the cloud when you agree to "Ask the cloud to look"** | No | The old label and up to 60 button and link names near the step, with personal ones replaced. The panel lists examples first. | Never | Never |
| **Sent anywhere when re-finding on this computer** | No | No. It stays on the laptop. | Never | Never |

The page script reads a field's label, never its value. A path step has no field that could hold a typed value ([src/path.js](src/path.js)), so one cannot be saved by mistake. A step also stores a small number, its position among the page's controls, to help find it again on a long page. Help requests are deleted when the person stops sharing.

## What we measured

All numbers are from the real on-device model in desktop Chrome. Reproduce them with the test pages and scripts below.

**Finding a step again on the practice sites** ([refindeval.html](refindeval.html)): five made-up sites, 25 recorded steps, each site changed four ways, 80 cases. Two configurations, measured on the same cases:

| Change | Earlier setting: every control offered, looser check | Current setting: same section first, then every control, stricter check |
|---|---|---|
| Button moved, same label | 25 of 25 (plain code) | 25 of 25 (plain code) |
| Label renamed | 23 of 25 | 17 of 25 |
| Label renamed and button moved | 22 of 25 | 15 of 25 |
| Control removed (the right answer is "it's gone") | 4 of 5 | 5 of 5 |
| **Overall** | **74 or 75 of 80, one wrong pick** | **62 of 80, no wrong pick** |

The first prompt scored 63 of 80 with 17 wrong picks on the model cases. Asking in two orders, taking out controls that belong to other steps, and checking the pick with a yes/no question brought it to 74 or 75. Real pages then showed that the earlier setting was too eager (next section), so the current setting declines more often: it finds fewer steps on these easy sites and never points at a wrong control. A wrong pick is the harmful failure, because it sends a person to the wrong button, so the current setting is the default.

Caveats: the earlier improvements were designed after looking at failures on these same five sites. Each run takes a different path through the model, so results move by a case or two.

**The on-device model on real pages.** The practice sites have about 25 controls. Real pages have far more (Wikipedia 150, python.org 147), and the model did much worse on them. [src/realEval.js](src/realEval.js) replays what the extension actually read on four real public pages (saved by [tools/capture-scans.mjs](tools/capture-scans.mjs): Wikipedia, python.org, the Nepal Electricity Authority, the Bangladesh national portal). For each test case a control is renamed, with its link address and name removed so only the model can find it, or hidden. The model runs in Chrome through Firebase AI Logic's on-device mode, as in the product. 23 cases: 18 renamed controls and 5 removed ones.

| Setting | Renamed: right / declined / wrong | Removed: right / wrong |
|---|---|---|
| Every control offered, looser check (the earlier setting) | 5 / 10 / 3 | 5 / 0 |
| Same section first, looser check | 15 / 2 / 1 | 3 / 2 |
| Same section first, stricter check | 11 / 7 / 0 | 4 / 1 |
| Every control offered, stricter check | 5 / 13 / 0 | 5 / 0 |
| **Current: same section first, then every control, stricter check** | **9 / 8 / 1** | **4 / 1** |

- The big gain is from offering the model only the controls in the step's own part of the page (11 to 20 instead of up to 150).
- The stricter yes/no check ("the very same control, only renamed; related is not enough") is what removes wrong picks.
- The fallback to every control is there for controls that moved as well as being renamed, which the practice sites showed matter.
- Each setting was run once, and a repeat of the same setting moved by about two cases, so treat the differences as rough. The current setting was chosen after seeing these cases, so its figures are likely a little optimistic.
- The wrong picks that remain are near-synonyms: a removed "Socialize" matched to "Community", and, on the Bengali page, "all services" matched to an existing "all e-services" card.
- Bengali: the model does not read Bengali, yet it matched some Bengali labels. 3 renamed Bengali controls: 1 right, 1 declined, 1 wrong, so no claim is made for Bengali.
- A model step on a real page takes about 4 seconds, from 2 to 6 model calls.
- **Long pages.** The page script used to read only the first 150 controls, so a control further down, such as a footer link, was invisible. A long Wikipedia article has about 4,000 controls (2,389 after repeats are merged) and its footer links sit near the end, so the script now reads whole pages (up to 6,000 controls; checking 4,000 takes about 17 ms). The model is still never shown a long list: it sees the controls in the step's own section, and at most 60 of them, the ones nearest the step's recorded position on the page. On the long article, 3 of 4 renamed footer controls were found, 1 was declined, none was wrong, and the removed one was declined, each in about 1.5 seconds.
- After that change the whole replay was run again (the Wikipedia main page now reads 250 controls instead of 150, so the numbers above and these are on slightly different data, and the long-article cases were re-run separately): 22 renamed controls, 14 right, 7 declined, 1 wrong; 6 removed controls, 5 declined and 1 wrong.
- Not measured: Devanagari pages, pages that need a login, and full multi-step paths with the model.

**Asking the cloud when the on-device model is unsure.** When the guide cannot find a step, or the computer has no on-device model (a phone, or a laptop where it is not installed), the step card offers "Ask the cloud to look". It first shows what would be sent: the old label and the names of up to 60 buttons and links near the step, with a personal label replaced. Nothing is sent until the person presses the button. The same 28 real-page cases, asked of the cloud model:

| Cloud setting | Renamed: right / declined / wrong | Removed: right / wrong | Median time |
|---|---|---|---|
| Three calls: two orderings and a yes/no check | 18 / 3 / 1 | 5 / 1 | 15 s |
| Two calls: one ordering and the check | 19 / 3 / 0 | 5 / 1 | 15 s |
| **One call (used)** | **22 / 0 / 0** | 4 / 2 | **8 s** |

The strong cloud model needs none of the careful checks that the small on-device model does, and one call is half the time. The cost is that for a control that has been removed, it twice picked a near-synonym ("Socialize" matched to "Community") instead of saying it is not sure. Timings varied a lot between runs. For comparison, the on-device model found 14 of the same 22 renamed controls. What was not verified end to end: pressing the button in a normal Chrome and watching the cloud's answer get highlighted. In a headless browser the button appeared with the right text and sent nothing before the click, and App Check refused the cloud call for that automated browser; the cloud's finding itself was measured through the same code above.

**Speaking a request.** On the Follow tab, **Speak** records up to 8 seconds, sends the recording and the titles of the group's paths to the cloud model, and starts the path it picks. It exists because the on-device model does not understand Nepali speech, so this is a task where the cloud is genuinely needed. It shows what it heard, in the language spoken and in English, and it refuses when no path matches. Tested in a normal Chrome with a fake microphone playing speech made by the Mac's text-to-speech, against a group with one path ("Pay the electricity bill", with Nepali and Hindi titles):

| Spoken | Heard | Result |
|---|---|---|
| Hindi: "मुझे बिजली का बिल भरना है" | Exactly, with the English "I want to pay the electricity bill" | Matched, started following |
| English: "I want to pay the electricity bill" | Exactly | Matched, started following |
| English: "I want to renew my passport" | Exactly | Refused: "I could not match that to one of your guides" |

**Not tested:** real spoken Nepali (this Mac has no Nepali voice, so I could not make any); real human voices, accents and background noise; a group with many similar paths (matching against one path is easy); and the microphone permission prompt inside the extension's side panel, where browsers do not always show it. The extension has a small page, `mic.html`, that asks for the microphone once in a normal tab as a fallback; it was not verified. The first thing to try is saying a request in Nepali on the try page.

**Things we tried that did not help, and removed or did not adopt:**
- Structured (schema-constrained) output for the model's answers: 44 right against 49 for plain text on the 55 model cases, because the constrained model said "not sure" about twice as often. Plain text is used for re-finding. Structured output is used where an answer is a longer shape, for the cloud translation.
- Offering only same-kind controls first (buttons with buttons) on the practice sites: slightly better on renamed-and-moved steps, but 3 wrong picks against 1 when a control was removed, so it was reverted. Narrowing by section, tried later on real pages, is used (above).

**On real websites.** [tools/e2e-real.mjs](tools/e2e-real.mjs) records a short path on four live public pages, saves it, follows it by clicking through the real pages, and then checks it again after a script simulates a redesign. Nothing is typed or submitted; it only clicks ordinary links. The pages are the Bangladesh national portal (Bengali labels), the Nepal Department of Passports (Nepali labels, with a pop-up notice over the page), Wikipedia's main page and talk page (English), and a long Wikipedia article (about 4,000 controls, with the footer link "About Wikipedia" near the very end). 7 steps in all.

| | Result |
|---|---|
| Record, save and follow through the real pages, unchanged | 4 of 4 pages finished (7 of 7 steps), found by label |
| Redesign: labels renamed, addresses kept | 4 of 6 steps found and highlighted correctly; 2 declined |
| Harder redesign: labels, addresses and names all changed | 2 of 6 found (by another link to the same address); 4 declined |
| Wrong control highlighted | 0 of 12 |
| Footer link at the end of a 4,000-control page | Found and scrolled to, after the label was renamed |
| Pop-up notice covering the control | The passport page's notice was detected and the guide said so |

The harder redesign ran in a headless Chrome that has no on-device model, so "declined" is what the guide does without the model: it says it is not sure and points at nothing. The model's part on real pages is measured separately above. Earlier, the extension also read the page and drew the highlight on the right control on 5 of 6 other real sites (Wikipedia, GitHub's sign-in page, Nepal Electricity Authority, the passport office, the Bangladesh portal); the sixth refused the automated browser. One early run reported a wrong highlight on a long page. It was my check reading the page while it was still scrolling to the control; the check now waits for the scroll to finish.

**What the real sites taught us** (all fixed):
- Many real links have an address that means nothing (`/`, `javascript:void(0)`, a link to the same page). Those are no longer recorded or used as anchors.
- One site gives controls a new generated name on every page load (`radix-_R_…`). Such names are no longer recorded.
- Real pages often link to the same destination twice. The same link shown twice (same label) now counts as one. Links that share an address but have different labels (Wikipedia's Log in and Create account) are not told apart, so none is chosen.

**Explaining a page.** Checked on the practice site's bill page in both modes. With the on-device model it described the page correctly in plain words on the laptop (15 seconds on first use). In a browser with no model it fell back to the cloud and answered in 3 seconds, sending the page title and 8 labels and 0 typed values, as the result line states.

**Speed.** A model call takes about 0.4 to 0.6 seconds once the model is loaded (10 to 15 seconds the first time). A step that needs the model takes three calls, so about 1.5 seconds. Steps found by label or by link address take milliseconds.

**Security rules.** [tools/rules-check.js](tools/rules-check.js) runs 24 checks against the live project with two separate anonymous users: all pass. Allowed actions work (a helper can set the pick, a note and the status; a creator can delete). Refusals hold: a helper cannot change the list of controls, pick outside it, write a note over 100 characters or delete someone else's request; a path cannot be edited or created with no steps, 41 steps, an extra field or someone else's name as creator; nothing can be read without signing in, with a wrong-length group code, or outside `groups`. Not covered: the rules were checked on the real project, not the Firebase emulator, and a group code that leaks still gives full access to that group.

**Tests.** 83 unit tests (`npm test`). Five end-to-end scripts drive a throwaway headless Chrome with the extension loaded and run against the live site: [tools/e2e.mjs](tools/e2e.mjs) (record, save, follow), [tools/e2e-help.mjs](tools/e2e-help.mjs) (ask for help, a phone-sized helper taps, the highlight moves, the request is deleted), [tools/e2e-try.mjs](tools/e2e-try.mjs) (the same flow on the try page) and [tools/e2e-real.mjs](tools/e2e-real.mjs) (real public websites, above) and [tools/e2e-cloud.mjs](tools/e2e-cloud.mjs) (the cloud button's consent screen, in a browser with no on-device model). In the headless browser, App Check sometimes refuses the cloud translation (reCAPTCHA scores it as a bot); the path is then saved without translations, as designed, and the test reports it. In a normal Chrome the cloud call works. The on-device model is not available in that headless Chrome, so the model path was checked separately in a normal Chrome.

## Design

The panel is built for someone who is not used to computers.

- **The step comes first.** While following a path, the current step is the first and largest thing on screen, with a progress bar, one big button ("I did it, next") and the privacy line. The group form and the path list step out of the way.
- **Three tabs, one job each:** Follow, Show the way, Get help. Once a group is joined, its code sits in a slim bar with a Copy button.
- **Nothing appears until it has something to say.** Messages are hidden when empty, and a first visit shows one card with one clear action.
- **Large targets and text:** controls are at least 48 px tall, with a Large text switch that enlarges the step card further, and Nepali and Hindi next to English at the top of the Follow tab.
- **Light and dark** themes follow the system setting, motion is reduced when the system asks for it, tabs work with the arrow keys, and every control has a visible focus ring.

- **The try page works on a phone.** On a narrow screen the website is on top and Saathi below it, both visible at once, the how-to guide stays closed until you ask for it, and a "Taller" button gives Saathi more room. While you follow a path on a short screen, only the step is shown, so the instruction, the progress bar and the "I did it, next" button are on screen together with the outlined control. The try-page test runs in a phone-sized, touch-enabled window (`PHONE=1 node tools/e2e-try.mjs`) and passes. The on-device model does not exist on phones, so on a phone everything works except the last re-finding step. A real phone was not used, only an emulated window.

Not done: a screen-reader pass, an automated accessibility audit, or any test with an older person. The design follows common accessibility practice but has not been checked against real users or tools.

## Known limits

- **Laptop only.** The on-device model runs in desktop Chrome, not on phones. The helper page does work on a phone, because the helper needs no model.
- **The on-device model reads only English, Spanish and Japanese.** On a website in Nepali or Bengali, a renamed button can still be found by its link address or internal name, but not by the model. Saathi then says it is not sure.
- **The model is weak on long real pages.** When a control's label, address and name all change, the on-device model finds the right one in roughly half the cases on real pages (9 of 18 in the latest replay), declines in most of the rest, and occasionally points at a near-synonym. Declining is the safe failure and is the usual one.
- **Real sites: short public paths only.** Full record and follow was tested on two-step paths on three public sites. Sites that need a login, forms with typed answers and long paths were not tested.
- **Nepali and Hindi were not reviewed by a native speaker.** One early Nepali translation added a detail that was not in the step. The prompt now forbids that, and later samples did not repeat it, but review is still needed.
- **Read-aloud was not tested with Nepali or Hindi voices.** It uses the browser's own voices, and many computers have no Nepali voice. The step card is always shown on screen.
- **Speaking sends your voice to the cloud**, once, only when you press Speak, and the recording is not stored. The on-device model cannot do this task. Real Nepali speech has not been tested (see above).
- **The cloud button was not verified end to end** in a normal browser (see above).
- **A group code is the only key.** Anyone who learns it can read that group's paths and help requests. That suits a family, not a public community.
- **Not an offline app.** The websites Saathi guides need the internet anyway.
- **No real user yet.** This was built and tested by one person on practice sites and public pages. It has not been used by a parent, student or migrant worker.
- **Help and explain on long pages.** A help request sends the controls on screen (at most 100) and "Explain this page" describes the controls on screen (at most 60), so the helper and the explainer see what the person is looking at. A control that is off screen is not offered until the person scrolls to it and asks again.
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
| [src/audio.js](src/audio.js), [src/voice.js](src/voice.js) | Recording a spoken request, and asking the cloud which path it means |
| [src/try.js](src/try.js), [try.html](try.html) | The try page that stands in for the extension |
| [extension](extension) | The Chrome extension (page script, side panel shell) |
| [public/demo](public/demo) | The practice website |
| [docs/test-shots](docs/test-shots) | Screenshots from the test runs |
