# BTQuiz

A simple, pretty touch-screen quiz for events. Runs locally, no internet or
accounts needed, and logs anonymous answer picks so you can see what people
chose during the day.

## Run it

```
npm install
npm start
```

Then open `http://localhost:3000` on the touch screen. Open it full-screen
(most browsers: F11, or launch Chrome with `--kiosk`) so it fills a 32" display.

The live results dashboard is at `http://localhost:3000/stats.html` — open it
on a second device or a second browser tab to watch picks come in during the
event.

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

No names, device info, or IP addresses are recorded — just which question,
which choice, whether it was correct, and a timestamp. `stats.html` reads this
file and aggregates it into a live chart/table view.

To reset the data (e.g. before a new event day), stop the server and delete or
empty `data/responses.jsonl`.
