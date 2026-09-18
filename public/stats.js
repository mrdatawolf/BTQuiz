(function () {
  "use strict";

  async function load() {
    const res = await fetch("/api/stats");
    const data = await res.json();
    renderTiles(data);
    renderChart(data);
    renderTable(data);
    document.getElementById("empty-msg").classList.toggle("hidden", data.totalResponses > 0);
  }

  function renderTiles(data) {
    const el = document.getElementById("tiles");
    const accuracyPct = Math.round(data.accuracy * 100);
    el.innerHTML = `
      <div class="tile"><div class="value">${data.totalResponses}</div><div class="label">Answers picked</div></div>
      <div class="tile"><div class="value">${accuracyPct}%</div><div class="label">Overall accuracy</div></div>
      <div class="tile"><div class="value">${data.questions.length}</div><div class="label">Questions in bank</div></div>
    `;
  }

  function renderChart(data) {
    const el = document.getElementById("chart-view");
    el.innerHTML = "";
    data.questions
      .slice()
      .sort((a, b) => b.total - a.total)
      .forEach((q) => {
        const card = document.createElement("div");
        card.className = "question-card";

        const maxCount = Math.max(1, ...q.counts);
        const rows = q.answers.map((text, i) => {
          const count = q.counts[i];
          const pct = Math.round((count / maxCount) * 100);
          const isCorrect = i === q.correctIndex;
          return `
            <div class="bar-row" title="${escapeHtml(text)}: ${count} pick${count === 1 ? "" : "s"}">
              <div class="row-label">${isCorrect ? '<span class="check">&#10003;</span>' : ""}${escapeHtml(text)}</div>
              <div class="bar-track"><div class="bar-fill${isCorrect ? " correct" : ""}" style="width:${pct}%"></div></div>
              <div class="bar-count">${count}</div>
            </div>
          `;
        }).join("");

        card.innerHTML = `
          <div class="category">${escapeHtml(q.category)} &middot; ${q.total} response${q.total === 1 ? "" : "s"}</div>
          <h3>${escapeHtml(q.question)}</h3>
          ${rows}
        `;
        el.appendChild(card);
      });
  }

  function renderTable(data) {
    const el = document.getElementById("table-view");
    let rows = "";
    data.questions.forEach((q) => {
      q.answers.forEach((text, i) => {
        rows += `<tr>
          <td>${escapeHtml(q.category)}</td>
          <td>${escapeHtml(q.question)}</td>
          <td>${escapeHtml(text)}${i === q.correctIndex ? " &#10003;" : ""}</td>
          <td>${q.counts[i]}</td>
        </tr>`;
      });
    });
    el.innerHTML = `
      <table>
        <thead><tr><th>Category</th><th>Question</th><th>Answer</th><th>Picks</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  document.getElementById("view-chart").addEventListener("click", (e) => {
    document.getElementById("chart-view").classList.remove("hidden");
    document.getElementById("table-view").classList.add("hidden");
    e.target.classList.add("active");
    document.getElementById("view-table").classList.remove("active");
  });
  document.getElementById("view-table").addEventListener("click", (e) => {
    document.getElementById("table-view").classList.remove("hidden");
    document.getElementById("chart-view").classList.add("hidden");
    e.target.classList.add("active");
    document.getElementById("view-chart").classList.remove("active");
  });
  document.getElementById("refresh").addEventListener("click", load);

  load();
})();
