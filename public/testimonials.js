// Testimonial band on the attract screen. Reads /api/testimonials and
// cycles through them in a shuffled order that reshuffles once exhausted
// (same approach as the sister BTTechExpo2026 kiosk's testimonial band).
//
// That sister app advances its testimonial whenever the slide changes.
// This app's attract screen never "changes" on its own, so instead this
// runs its own interval timer — started when app.js switches to the
// attract screen via window.setTestimonialActive(true), and stopped the
// moment a visitor starts a round, via window.setTestimonialActive(false).

(function () {
  var bar = document.getElementById('testimonial');
  if (!bar) return;
  var quoteEl = document.getElementById('testimonialQuote');
  var authorEl = document.getElementById('testimonialAuthor');
  var FADE_MS = 500;
  var CYCLE_MS = 9000;

  var testimonials = [];
  var queue = [];
  var current = null;
  var cycleTimer = null;

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function refillQueue() {
    queue = shuffle(testimonials.slice());
    // Avoid immediately repeating the testimonial that was just shown when
    // the shuffle happens to put it first again.
    if (queue.length > 1 && current && queue[0] === current) {
      queue.push(queue.shift());
    }
  }

  function formatByline(t) {
    var bits = [];
    if (t.role) bits.push(t.role);
    if (t.company) bits.push(t.company);
    var roleCompany = bits.join(', ');
    var author = t.author || '';
    if (author && roleCompany) return author + ' — ' + roleCompany;
    return author || roleCompany;
  }

  function render(t) {
    quoteEl.textContent = t.quote;
    authorEl.textContent = formatByline(t);
  }

  function advance() {
    if (!testimonials.length) return;
    if (!queue.length) refillQueue();
    current = queue.shift();

    if (!bar.classList.contains('is-visible')) {
      render(current);
      bar.classList.add('is-visible');
      return;
    }

    bar.classList.remove('is-visible');
    setTimeout(function () {
      render(current);
      bar.classList.add('is-visible');
    }, FADE_MS);
  }

  // Called by app.js's show() every time the visible screen changes.
  window.setTestimonialActive = function (active) {
    if (!testimonials.length) return;
    clearInterval(cycleTimer);
    cycleTimer = null;
    if (active) {
      bar.classList.add('is-shown');
      advance();
      cycleTimer = setInterval(advance, CYCLE_MS);
    } else {
      bar.classList.remove('is-shown');
    }
  };

  fetch('/api/testimonials')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (!Array.isArray(data) || data.length === 0) return;
      testimonials = data;
      document.body.classList.add('has-testimonials');
      // Loading is async and can finish after app.js has already shown the
      // attract screen (e.g. on first page load) — if so, start cycling now
      // instead of waiting for the next screen change.
      var attractScreen = document.getElementById('screen-attract');
      if (attractScreen && attractScreen.classList.contains('active')) {
        window.setTestimonialActive(true);
      }
    })
    .catch(function (err) {
      console.error("Couldn't load testimonials:", err);
    });
})();
