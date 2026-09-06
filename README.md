# Hertz

A sine-wave frequency guessing game built with React, TypeScript, Vinext, and Web Audio.

## Local development

```sh
npm install
npm run dev
```

Open the localhost URL printed by the server. Click the arrow marked **Start game** to enable audio.

## Game flow

A compact black card on a white canvas takes you through ready → timed listening and hertz entry → answer reveal → final score. Five rounds total 5,000 possible points. Settings are available above the card between rounds; sound can be muted at any time.

## Rules

- Five rounds of random whole-hertz tones between 100 and 1,000 Hz, sampled logarithmically.
- Each tone has a fixed 5-second time limit. The sine wave stops on submission or timeout.
- Enter a frequency in hertz and press Enter. Volume defaults to 100% and can be adjusted in settings.
- Score = round(1000 × exp(−abs(cents) / 100)), where cents = 1200 × log2(guess / target).
- Late or missing answers earn zero. The visual waveform is illustrative and never encodes the answer.
- Scores remain in memory for the current session.

## Checks

```sh
npm test
npx tsc --noEmit
npm run build
```

The starter's full lint task reports pre-existing issues in bundled UI components; app code can be checked with `npx oxlint app lib/game.ts`.

## Vercel hosting

Vercel uses `npm run build:vercel` to build this browser-only game into `dist-vercel`. The deployment uses static files and Web Audio in the browser, with no server functions, databases, or paid services. Choose Vercel's free Hobby plan and its included `vercel.app` domain.

Use `npm run dev:vercel` to preview the same browser entry locally. The existing `npm run dev` workflow remains available.
