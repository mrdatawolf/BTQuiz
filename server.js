const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const RESPONSES_FILE = path.join(DATA_DIR, "responses.jsonl");
const QUESTIONS_FILE = path.join(__dirname, "questions.json");
const CONFIG_FILE = path.join(__dirname, "config.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RESPONSES_FILE)) fs.writeFileSync(RESPONSES_FILE, "");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Serve the question bank + round config together.
app.get("/api/questions", (req, res) => {
  try {
    const questions = loadJson(QUESTIONS_FILE);
    const config = loadJson(CONFIG_FILE);
    res.json({ config, questions });
  } catch (err) {
    res.status(500).json({ error: "Could not load questions" });
  }
});

// Log one anonymous pick: which question, which choice, whether it was correct.
// No visitor identifier of any kind is stored.
app.post("/api/responses", (req, res) => {
  const { questionId, choiceIndex, correct } = req.body || {};
  if (typeof questionId !== "string" || typeof choiceIndex !== "number" || typeof correct !== "boolean") {
    return res.status(400).json({ error: "Invalid response payload" });
  }
  const entry = { questionId, choiceIndex, correct, ts: new Date().toISOString() };
  fs.appendFile(RESPONSES_FILE, JSON.stringify(entry) + "\n", (err) => {
    if (err) return res.status(500).json({ error: "Could not save response" });
    res.status(204).end();
  });
});

// Aggregate the day's anonymous picks for the /stats.html dashboard.
app.get("/api/stats", (req, res) => {
  let lines = [];
  try {
    lines = fs.readFileSync(RESPONSES_FILE, "utf8").split("\n").filter(Boolean);
  } catch {
    lines = [];
  }
  const responses = lines.map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);

  const questions = loadJson(QUESTIONS_FILE);
  const byQuestion = {};
  for (const q of questions) {
    byQuestion[q.id] = {
      id: q.id,
      category: q.category,
      question: q.question,
      answers: q.answers,
      correctIndex: q.correctIndex,
      counts: new Array(q.answers.length).fill(0),
      total: 0
    };
  }

  let totalResponses = 0;
  let totalCorrect = 0;
  for (const r of responses) {
    totalResponses++;
    if (r.correct) totalCorrect++;
    const bucket = byQuestion[r.questionId];
    if (bucket && bucket.counts[r.choiceIndex] !== undefined) {
      bucket.counts[r.choiceIndex]++;
      bucket.total++;
    }
  }

  res.json({
    totalResponses,
    totalCorrect,
    accuracy: totalResponses ? totalCorrect / totalResponses : 0,
    questions: Object.values(byQuestion)
  });
});

app.listen(PORT, () => {
  console.log(`BTQuiz running at http://localhost:${PORT}`);
  console.log(`Stats dashboard at http://localhost:${PORT}/stats.html`);
});
