# Saathi: submission text

Paste-ready text for the Devpost form. Each section is a form field. Numbers are from the real tests described in the README.

## Tagline

Someone who has done it shows the way once. Saathi gives everyone in the group a patient guide that highlights each button, privately on their own laptop.

## Inspiration

Older parents, students and people far from home often get stuck on bill, bank and government websites. Today the fix is a video call that says "no, the blue button, lower down", or paying someone at a cyber café to do it. The person who can help is usually far away, and the page in front of the person is often their bank.

## What it does

Saathi is a Chrome extension with a side panel.

- **Show the way once.** A helper presses Start and uses the website normally. Saathi writes down which buttons and boxes they used, in order. It never saves anything typed.
- **Follow a path.** Anyone with the group code sees the path as one step at a time. The right button is outlined on their own screen. Steps are shown in English, Nepali or Hindi, with large text and read-aloud. Saathi never clicks, types or submits.
- **When a website changes,** the guide finds the step again: first by its label, then by the link or box underneath it, then with the on-device model. If it is not sure, it says so and points at nothing.
- **Still stuck?** The person presses "Ask my helper". A helper on a phone sees only the names of the buttons and boxes, taps the right one, and it lights up on the person's screen in real time.
- **Not sure what a page wants?** "Explain this page" describes it in plain words, on-device first.
- **A wrong-website guard** stops the person if they land on a different site from the one the path was recorded on.

Try it with no install at https://paperwork-decoder.web.app/try.html.

## How we built it

The extension's side panel is a hosted page, so Firebase App Check works normally inside it. A small shell passes requests to the open tab and the tab's events back.

| Task | Runs | Why |
|---|---|---|
| Finding a step again on the live page | On-device only | The page may be a bank page. It never leaves the laptop. |
| Explaining a page | On-device first, cloud fallback with labels only | Works on any laptop; sends only the page title and up to 60 labels |
| Translating a path's steps into Nepali and Hindi | Cloud, once, at save time | The on-device model writes only English, Spanish and Japanese; the cloud sees only the path name and written steps |
| Helper taps a control | No model | Control names travel through Firestore |

Plain code does as much as it can before a model is asked. Of 80 changed-site test cases, 25 are solved by code alone, and anchors (link address, internal name) solve more. The on-device model is asked only when both fail, twice with the list in different orders, and a yes/no check must agree before the guide points anywhere.

**Firebase products:** AI Logic (every model call, hybrid modes), App Check (enforced, reCAPTCHA Enterprise), Authentication (anonymous), Firestore (shared paths, live help requests, security rules, on-laptop cache), Remote Config (a `cloud_enabled` off-switch, label limit, languages), Hosting.

**Why hybrid.** A cloud-only version would work, but it would have to upload the live page's labels at every step. Saathi keeps that on the laptop and uses the cloud only for what the small model cannot do. This is a privacy reason, not a claim that the cloud is impossible.

## Challenges

- **The model is not good at judging.** In a test for an earlier idea, the on-device model said "same person" for almost every pair of different names. That is why Saathi never lets the model decide alone: code goes first, and the model must agree with itself before it is believed.
- **Wrong picks matter more than misses.** Our first prompt found 63 of 80 steps with 17 wrong picks on the model cases. Three changes brought that to 74 or 75 of 80 with one wrong pick.
- **Extensions cannot load reCAPTCHA,** which App Check needs. Showing a hosted page inside the side panel solved it, and we confirmed both the on-device model and the cloud work in that frame.
- **Two ideas that sounded good measured worse.** Schema-constrained answers (44 right against 49 for plain text) and offering same-kind controls first (3 wrong picks against 1) were tried and removed.

## Accomplishments

- A complete loop that runs on a live site: record, translate, save, follow, ask for help, delete.
- Measured, honest results: 74 or 75 of 80 on re-finding with one wrong pick, and an extension that highlighted the right control on 5 of 6 real websites, including Nepali and Bengali labels.
- A judge demo that needs no extension and runs the extension's own page script.
- 59 unit tests and three end-to-end scripts that drive a real browser against the live project.

## What we learned

Small on-device models are good at wording and poor at decisions, so put the decision in code and let the model explain or choose among a few options. Measure the failure you can least afford, not the average.

## What's next

- Test with a real parent and a real helper, and add their words to the demo.
- Have a Nepali and a Hindi speaker review the translations.
- Run record and follow on real multi-page sites, including ones with logins and pop-ups.
- Per-person access instead of a shared group code, and a lighter helper page.
- A phone version of the follower is not possible with the on-device model today, so the helper's phone view is the mobile story for now.

## Built with

Firebase AI Logic, Firebase App Check, Firebase Authentication, Cloud Firestore, Firebase Remote Config, Firebase Hosting, Chrome built-in AI (Gemini Nano), Gemini (cloud), Vite, Vitest, JavaScript.

## Testing instructions for judges

1. Open https://paperwork-decoder.web.app/try.html in desktop Chrome. No login is needed.
2. Follow the numbered guide at the top of the page. It takes about two minutes.
3. Optional: open https://paperwork-decoder.web.app/help.html on a phone, enter the group code shown in the panel, and tap a control to see it light up.
4. The on-device model needs desktop Chrome. Without it, everything works except the last re-finding step.
5. To use the extension itself: open `chrome://extensions`, turn on Developer mode, choose Load unpacked, and select the `extension` folder of the repository.

The practice website is made up. No real data is collected, no key or secret is in the repository, and nothing on the demo is paid.
