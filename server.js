const express = require("express");
const fs = require("fs");
const os = require("os");
const path = require("path");

const PORT = process.env.PORT || 4444;
const IP = process.env.IP || "0.0.0.0";
const DATA_DIR = path.join(__dirname, "data");
const RESPONSES_FILE = path.join(DATA_DIR, "responses.jsonl");
const HITRATES_FILE = path.join(DATA_DIR, "hit-rates.json");
const QUESTIONS_FILE = path.join(__dirname, "questions.json");
const CONFIG_FILE = path.join(__dirname, "config.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(RESPONSES_FILE)) fs.writeFileSync(RESPONSES_FILE, "");

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const QUESTIONS = loadJson(QUESTIONS_FILE);

// Per-question answer counts ("hit rates"): how many times each original
// answer option has been picked. Kept in memory and persisted to
// data/hit-rates.json after every answer, so it survives restarts and is a
// single fast read for the "N% of players picked the same answer" stat.
function freshHitRates() {
  const rates = {};
  for (const q of QUESTIONS) {
    rates[q.id] = { counts: new Array(q.answers.length).fill(0), total: 0 };
  }
  return rates;
}

let hitRates = freshHitRates();
if (fs.existsSync(HITRATES_FILE)) {
  try {
    const saved = loadJson(HITRATES_FILE);
    for (const q of QUESTIONS) {
      const bucket = saved[q.id];
      if (bucket && Array.isArray(bucket.counts) && bucket.counts.length === q.answers.length) {
        hitRates[q.id] = bucket;
      }
    }
  } catch {
    // Corrupt or unreadable file — fall back to the fresh, all-zero skeleton.
  }
}

function saveHitRates() {
  fs.writeFile(HITRATES_FILE, JSON.stringify(hitRates, null, 2), (err) => {
    if (err) console.error("Could not save hit-rates.json:", err.message);
  });
}
saveHitRates();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Serve the question bank + round config together.
app.get("/api/questions", (req, res) => {
  try {
    const config = loadJson(CONFIG_FILE);
    res.json({ config, questions: QUESTIONS });
  } catch (err) {
    res.status(500).json({ error: "Could not load questions" });
  }
});

// Log one anonymous pick: which question, which original answer index (not
// the shuffled on-screen position — see app.js), and whether it was correct.
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

  const bucket = hitRates[questionId];
  if (bucket && bucket.counts[choiceIndex] !== undefined) {
    bucket.counts[choiceIndex]++;
    bucket.total++;
    saveHitRates();
  }
});

// Aggregate hit rates for the /stats.html dashboard and the review screen's
// "N% of players picked the same answer" stat.
app.get("/api/stats", (req, res) => {
  let totalResponses = 0;
  let totalCorrect = 0;

  const questions = QUESTIONS.map((q) => {
    const bucket = hitRates[q.id] || { counts: new Array(q.answers.length).fill(0), total: 0 };
    totalResponses += bucket.total;
    totalCorrect += bucket.counts[q.correctIndex] || 0;
    return {
      id: q.id,
      category: q.category,
      question: q.question,
      answers: q.answers,
      correctIndex: q.correctIndex,
      counts: bucket.counts,
      total: bucket.total
    };
  });

  res.json({
    totalResponses,
    totalCorrect,
    accuracy: totalResponses ? totalCorrect / totalResponses : 0,
    questions
  });
});

// Non-internal IPv4 addresses of this machine, so a kiosk bound to 0.0.0.0
// can tell you every URL it can actually be reached at on the network.
function lanAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const iface of Object.values(nets)) {
    for (const net of iface || []) {
      if (net.family === "IPv4" && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

app.listen(PORT, IP, () => {
  console.log("BTQuiz");
  console.log(`  Local:   http://localhost:${PORT}`);
  if (IP === "0.0.0.0") {
    const addrs = lanAddresses();
    if (addrs.length) {
      addrs.forEach((ip) => console.log(`  Network: http://${ip}:${PORT}   <- touch screen / other devices`));
    } else {
      console.log("  Network: no LAN interface detected");
    }
  } else if (IP !== "127.0.0.1" && IP !== "localhost") {
    console.log(`  Network: http://${IP}:${PORT}`);
  }
  console.log(`  Stats:   http://localhost:${PORT}/stats.html`);
});
