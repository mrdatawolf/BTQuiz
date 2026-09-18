# BTQuiz

A simple, pretty touch-screen quiz for events. Runs locally, no internet or
accounts needed, and logs anonymous answer picks so you can see what people
chose during the day.

## Run it

```
./start.sh
```

This checks Node is installed, installs dependencies on first run, creates
`.env` from `.env.example` if it doesn't exist yet, validates `questions.json`
and `config.json`, and starts the server — which then prints every URL it's
reachable at (localhost, and each LAN address if bound to `0.0.0.0`).

Open the printed network URL on the touch screen. Open it full-screen (most
browsers: F11, or launch Chrome with `--kiosk`) so it fills a 32" display.

At the end of a round, the results screen offers "Review Answers" — a
scrollable recap of every question in that round, showing what was picked
against the correct answer, before returning to the start screen.

A small "Reset" button sits in the bottom-right corner during any round (it's
hidden on the start screen, since that's already the reset state). It's for
staff — e.g. a visitor walks away mid-quiz — and asks for confirmation before
clearing the round and returning to the start screen, so a stray tap can't
wipe someone's progress.

The live results dashboard is at `/stats.html` on that same address — open it
on a second device or a second browser tab to watch picks come in during the
event.

You can also run it directly with `npm install && npm start`, which reads the
same `.env`.

## Network settings (.env)

`.env` (copy `.env.example` if it's missing) controls what address the server
binds to:

```
IP=0.0.0.0
PORT=4444
```

- `IP=0.0.0.0` (default) binds to every network interface on the machine, so
  the touch screen, a laptop, or a phone on the same network can all reach it.
  Set it to `127.0.0.1` to restrict access to just this machine.
- `PORT` is the port the server listens on (default `4444`).

`.env` is gitignored since it's meant to vary per machine — `.env.example`
documents the defaults and is the one checked into the repo.

## Adding or editing questions

Everything quiz-related lives in **`questions.json`** at the project root.
No code changes needed — just edit this file and refresh the browser.

Each question looks like this:

```json
{
  "id": "q21",
  "category": "AI Governance",
  "question": "Your question text here?",
  "answers": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Shown after answering, whether right or wrong."
}
```

Rules of thumb:
- `id` must be unique across the file.
- `answers` can have 2 to 4 options (true/false works fine with 2).
- `correctIndex` is 0-based (0 = first answer listed).
- `category` is just a label shown as a pill above the question — group
  questions however makes sense (by source document, topic, difficulty, etc).
- Answer order is shuffled automatically for each play, so don't worry about
  where the correct one sits in the file.

To add a new question, copy the block above, paste it into the array in
`questions.json`, and give it a fresh `id`.

## Round settings

`config.json` controls the kiosk behavior:

```json
{
  "title": "AI Policy IQ",
  "subtitle": "Tap to test your knowledge",
  "questionsPerRound": 5,
  "autoResetSeconds": 25
}
```

- `questionsPerRound` — how many random questions make up one play-through.
- `autoResetSeconds` — how long the results screen waits before returning to
  the attract ("Tap to Start") screen for the next visitor. The correct/incorrect
  explanation screen has no timeout — it always waits for a "Tap to Continue" tap.

## Anonymous data collection

Every answer picked is appended to `data/responses.jsonl`, one JSON line per
pick:

```json
{"questionId":"q6","choiceIndex":0,"correct":true,"ts":"2026-09-17T18:04:21.310Z"}
```

No visitor names, device info, or IP addresses are recorded — just which question,
which choice, whether it was correct, and a timestamp. `stats.html` reads this
file and aggregates it into a live chart/table view.

To reset the data (e.g. before a new event day), stop the server and delete or
empty `data/responses.jsonl`.
