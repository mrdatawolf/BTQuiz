(function () {
  "use strict";

  let CONFIG = { title: "AI Policy IQ", subtitle: "Tap to test your knowledge", questionsPerRound: 5, autoResetSeconds: 25 };
  let BANK = [];
  let round = [];
  let currentIndex = 0;
  let score = 0;
  let resetTimer = null;
  let attempts = [];

  const screens = {
    attract: document.getElementById("screen-attract"),
    question: document.getElementById("screen-question"),
    feedback: document.getElementById("screen-feedback"),
    results: document.getElementById("screen-results"),
    review: document.getElementById("screen-review")
  };

  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    document.getElementById("reset-btn").hidden = name === "attract";
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Shuffle answer order per-question so the correct slot isn't always the same position.
  // `order[shuffledPosition] = originalIndex` — kept so answers can be logged
  // by their stable original index instead of the on-screen position, which
  // changes every play-through and would make server-side aggregation meaningless.
  function prepareQuestion(q) {
    const order = shuffle(q.answers.map((_, i) => i));
    return {
      id: q.id,
      category: q.category,
      question: q.question,
      explanation: q.explanation,
      answers: order.map((i) => q.answers[i]),
      correctIndex: order.indexOf(q.correctIndex),
      order
    };
  }

  async function loadData() {
    const res = await fetch("/api/questions");
    const data = await res.json();
    CONFIG = data.config;
    BANK = data.questions;
    document.getElementById("attract-title").textContent = CONFIG.title;
    document.getElementById("attract-subtitle").textContent = CONFIG.subtitle;
  }

  function startRound() {
    clearTimeout(resetTimer);
    const count = Math.min(CONFIG.questionsPerRound, BANK.length);
    round = shuffle(BANK).slice(0, count).map(prepareQuestion);
    currentIndex = 0;
    score = 0;
    attempts = [];
    renderProgress();
    renderQuestion();
    show("question");
  }

  function renderProgress() {
    const el = document.getElementById("progress-dots");
    el.innerHTML = "";
    round.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = "dot" + (i < currentIndex ? " done" : i === currentIndex ? " current" : "");
      el.appendChild(dot);
    });
  }

  function renderQuestion() {
    const q = round[currentIndex];
    document.getElementById("q-category").textContent = q.category;
    document.getElementById("q-text").textContent = q.question;

    const grid = document.getElementById("answers-grid");
    grid.innerHTML = "";

    q.answers.forEach((text, idx) => {
      const btn = document.createElement("button");
      btn.className = "answer-btn";
      btn.textContent = text;
      btn.addEventListener("click", () => handleAnswer(idx));
      grid.appendChild(btn);
    });
  }

  function handleAnswer(choiceIndex) {
    const q = round[currentIndex];
    const correct = choiceIndex === q.correctIndex;
    if (correct) score++;

    const originalIndex = q.order[choiceIndex];

    attempts.push({
      questionId: q.id,
      category: q.category,
      question: q.question,
      answers: q.answers,
      correctIndex: q.correctIndex,
      pickedIndex: choiceIndex,
      originalIndex,
      correct,
      explanation: q.explanation
    });

    const buttons = Array.from(document.querySelectorAll(".answer-btn"));
    buttons.forEach((b, i) => {
      b.classList.add("disabled");
      if (i === q.correctIndex) b.classList.add("reveal-correct");
      else if (i === choiceIndex) b.classList.add("reveal-wrong");
    });

    logResponse(q.id, originalIndex, correct);

    setTimeout(() => showFeedback(correct, q.explanation), 450);
  }

  function logResponse(questionId, choiceIndex, correct) {
    fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, choiceIndex, correct })
    }).catch(() => {});
  }

  function showFeedback(correct, explanation) {
    const icon = document.getElementById("feedback-icon");
    const label = document.getElementById("feedback-label");
    icon.className = "feedback-icon " + (correct ? "correct" : "wrong");
    icon.textContent = correct ? "✓" : "✕";
    label.textContent = correct ? "Correct!" : "Not quite";
    document.getElementById("feedback-explanation").textContent = explanation;

    const isLastQuestion = currentIndex >= round.length - 1;
    document.getElementById("continue-btn").textContent = isLastQuestion ? "Tap to See Results" : "Tap to Continue";

    show("feedback");
  }

  function nextStep() {
    currentIndex++;
    if (currentIndex >= round.length) {
      showResults();
    } else {
      renderProgress();
      renderQuestion();
      show("question");
    }
  }

  function showResults() {
    const total = round.length;
    document.getElementById("results-score").textContent = score;
    document.getElementById("results-total").textContent = total;

    const pct = total ? score / total : 0;
    let emoji = "👍";
    let headline = "Nice work!";
    if (pct === 1) { emoji = "🏆"; headline = "Perfect score!"; }
    else if (pct >= 0.6) { emoji = "🎉"; headline = "Nice work!"; }
    else { emoji = "💡"; headline = "Good try — now you know!"; }
    document.getElementById("results-emoji").textContent = emoji;
    document.getElementById("results-headline").textContent = headline;

    show("results");
    startAutoReset("results-auto-reset-fill");
  }

  // Minimum recorded picks for a question before we show a hit-rate percentage —
  // below this a "68%" figure would really just mean "you and one other person".
  const MIN_SAMPLE_FOR_HIT_RATE = 3;

  async function fetchHitRates() {
    const byQuestionId = {};
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      data.questions.forEach((q) => { byQuestionId[q.id] = q; });
    } catch {
      // Network hiccup — review still renders, just without the hit-rate line.
    }
    return byQuestionId;
  }

  async function showReview() {
    document.getElementById("review-score").textContent = score;
    document.getElementById("review-total").textContent = round.length;

    const hitRates = await fetchHitRates();

    const list = document.getElementById("review-list");
    list.innerHTML = "";
    attempts.forEach((a, i) => {
      const card = document.createElement("div");
      card.className = "review-card" + (a.correct ? " is-correct" : " is-wrong");

      const rows = a.answers.map((text, idx) => {
        const isPicked = idx === a.pickedIndex;
        const isCorrect = idx === a.correctIndex;
        let cls = "review-answer";
        let mark = "";
        if (isCorrect) { cls += " correct"; mark = "✓"; }
        else if (isPicked) { cls += " wrong"; mark = "✕"; }
        return `<div class="${cls}">${mark ? `<span class="mark">${mark}</span>` : ""}<span>${escapeHtml(text)}</span></div>`;
      }).join("");

      const bucket = hitRates[a.questionId];
      let statHtml;
      if (bucket && bucket.total >= MIN_SAMPLE_FOR_HIT_RATE) {
        const pct = Math.round((bucket.counts[a.originalIndex] / bucket.total) * 100);
        statHtml = `<p class="review-stat"><strong>${pct}%</strong> of quiz takers so far picked the same answer as you.</p>`;
      } else {
        statHtml = `<p class="review-stat review-stat-muted">Not enough plays yet to compare.</p>`;
      }

      card.innerHTML = `
        <div class="review-card-header">
          <span class="review-index">Q${i + 1}</span>
          <span class="review-category">${escapeHtml(a.category)}</span>
        </div>
        <h3>${escapeHtml(a.question)}</h3>
        <div class="review-answers">${rows}</div>
        ${statHtml}
        <p class="review-explanation">${escapeHtml(a.explanation)}</p>
      `;
      list.appendChild(card);
    });

    show("review");
    startAutoReset("review-auto-reset-fill");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function startAutoReset(fillId) {
    const fill = document.getElementById(fillId);
    const seconds = CONFIG.autoResetSeconds;
    fill.style.transition = "none";
    fill.style.width = "100%";
    requestAnimationFrame(() => {
      fill.style.transition = `width ${seconds}s linear`;
      fill.style.width = "0%";
    });
    clearTimeout(resetTimer);
    resetTimer = setTimeout(returnToAttract, seconds * 1000);
  }

  function returnToAttract() {
    clearTimeout(resetTimer);
    show("attract");
  }

  document.getElementById("start-btn").addEventListener("click", startRound);
  document.getElementById("again-btn").addEventListener("click", startRound);
  document.getElementById("continue-btn").addEventListener("click", nextStep);
  document.getElementById("review-btn").addEventListener("click", showReview);
  document.getElementById("review-done-btn").addEventListener("click", returnToAttract);

  document.getElementById("reset-btn").addEventListener("click", () => {
    document.getElementById("reset-confirm").hidden = false;
  });
  document.getElementById("reset-cancel-btn").addEventListener("click", () => {
    document.getElementById("reset-confirm").hidden = true;
  });
  document.getElementById("reset-confirm-btn").addEventListener("click", () => {
    document.getElementById("reset-confirm").hidden = true;
    round = [];
    currentIndex = 0;
    score = 0;
    attempts = [];
    returnToAttract();
  });

  loadData().then(() => show("attract"));
})();
