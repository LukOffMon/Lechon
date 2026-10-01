(() => {
  'use strict';
  const D = window.SITE_DATA;
  const $ = (id) => document.getElementById(id);
  const pad = (n) => String(n).padStart(2, '0');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================
     NAVEGACIÓN ENTRE PANTALLAS
  ===================================================== */
  const screens = [1, 2, 3, 4].map((n) => $('screen-' + n));
  let current = 1;

  function goTo(n) {
    if (n === current) return;
    screens[current - 1].classList.remove('active');
    screens[n - 1].classList.add('active');
    current = n;
    document.body.classList.toggle('bubbles-on', n >= 3);
    Bubbles.setMode(n === 4 ? 'auto' : 'touch');
    if (n === 3) Letter.onEnter();
    if (n === 4) Player.onEnter();
    window.scrollTo(0, 0);
  }

  /* =====================================================
     PANTALLA 1 · CUENTA REGRESIVA + ATAJO "T"
  ===================================================== */
  const Countdown = (() => {
    const target = new Date(...D.unlockDate).getTime();
    const els = { d: $('cd-days'), h: $('cd-hours'), m: $('cd-mins'), s: $('cd-secs') };
    let timer = null;

    function set(el, v) {
      if (el.textContent !== v) {
        el.textContent = v;
        el.classList.remove('tick');
        void el.offsetWidth;
        el.classList.add('tick');
      }
    }

    function update() {
      const diff = target - Date.now();
      if (diff <= 0) { clearInterval(timer); unlock(); return; }
      const s = Math.floor(diff / 1000);
      set(els.d, pad(Math.floor(s / 86400)));
      set(els.h, pad(Math.floor((s % 86400) / 3600)));
      set(els.m, pad(Math.floor((s % 3600) / 60)));
      set(els.s, pad(s % 60));
    }

    function unlock() { if (current === 1) goTo(2); }

    function init() {
      if (Date.now() >= target) { goTo(2); return; }
      update();
      timer = setInterval(update, 1000);
    }
    return { init, unlock };
  })();

  /* Atajo de pruebas: mantener "t" durante 10 s */
  const Bypass = (() => {
    const HOLD_MS = 10000;
    const fill = $('bypass-fill');
    const glow = $('bypass-glow');
    const scr = $('screen-1');
    let start = null, raf = null;

    function reset() {
      start = null;
      cancelAnimationFrame(raf);
      scr.classList.remove('holding');
      fill.style.transition = 'width .4s ease';
      fill.style.width = '0%';
      glow.style.transition = 'opacity .4s ease';
      glow.style.opacity = 0;
    }

    function tick(now) {
      if (start === null) return;
      const p = Math.min((now - start) / HOLD_MS, 1);
      fill.style.transition = 'none';
      fill.style.width = (p * 100) + '%';
      glow.style.transition = 'none';
      glow.style.opacity = p;
      if (p >= 1) { reset(); Countdown.unlock(); return; }
      raf = requestAnimationFrame(tick);
    }

    function init() {
      window.addEventListener('keydown', (e) => {
        if (current !== 1 || (e.key !== 't' && e.key !== 'T') || e.repeat || start !== null) return;
        start = performance.now();
        scr.classList.add('holding');
        raf = requestAnimationFrame(tick);
      });
      window.addEventListener('keyup', (e) => { if (e.key === 't' || e.key === 'T') reset(); });
      window.addEventListener('blur', reset);
    }
    return { init };
  })();

  /* =====================================================
     AUDIO COMPARTIDO
  ===================================================== */
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = D.introTrack;
  audio.loop = true;

  /* =====================================================
     PANTALLA 2 · PIN DE FECHA
  ===================================================== */
  const Pin = (() => {
    const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const now = new Date();
    const view = { m: now.getMonth(), y: now.getFullYear() };
    let sel = null;
    let busy = false;
    const grid = $('cal-grid'), title = $('cal-title'), selLbl = $('pin-selected');
    const confirmBtn = $('pin-confirm'), msg = $('pin-msg'), card = $('pin-card');

    function render() {
      title.textContent = MONTHS[view.m] + ' ' + view.y;
      grid.innerHTML = '';
      const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // semana inicia en lunes
      const days = new Date(view.y, view.m + 1, 0).getDate();
      for (let i = 0; i < offset; i++) {
        const e = document.createElement('span'); e.className = 'empty'; grid.appendChild(e);
      }
      for (let d = 1; d <= days; d++) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = d;
        b.setAttribute('aria-label', d + ' de ' + MONTHS[view.m] + ' de ' + view.y);
        if (sel && sel.d === d && sel.m === view.m && sel.y === view.y) b.classList.add('sel');
        b.addEventListener('click', () => pick(d));
        grid.appendChild(b);
      }
    }

    function pick(d) {
      if (busy) return;
      sel = { d, m: view.m, y: view.y };
      selLbl.textContent = d + ' de ' + MONTHS[view.m] + ' de ' + view.y;
      confirmBtn.disabled = false;
      msg.textContent = ''; msg.className = 'pin-msg';
      render();
    }

    function shift(dm, dy) {
      if (busy) return;
      let m = view.m + dm, y = view.y + dy;
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      view.m = m; view.y = y; render();
    }

    function confirm() {
      if (!sel || busy) return;
      const ok = sel.d === D.pin.day && sel.m + 1 === D.pin.month && sel.y === D.pin.year;
      if (ok) {
        busy = true;
        confirmBtn.disabled = true;
        // Este clic es el gesto del usuario que permite iniciar el audio
        audio.currentTime = 0;
        audio.play().catch(() => {});
        msg.textContent = 'Correcto mi amor...';
        msg.className = 'pin-msg ok';
        setTimeout(() => goTo(3), 1500);
      } else {
        msg.textContent = 'Piensa un poquito más, amor...';
        msg.className = 'pin-msg';
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
      }
    }

    function init() {
      $('cal-prev-m').addEventListener('click', () => shift(-1, 0));
      $('cal-next-m').addEventListener('click', () => shift(1, 0));
      $('cal-prev-y').addEventListener('click', () => shift(0, -1));
      $('cal-next-y').addEventListener('click', () => shift(0, 1));
      confirmBtn.addEventListener('click', confirm);
      render();
    }
    return { init };
  })();

  /* =====================================================
     BURBUJAS (Canvas + requestAnimationFrame)
  ===================================================== */
  const Bubbles = (() => {
    const canvas = $('bubbles');
    const ctx = canvas.getContext('2d');
    const MAX = 110;
    let W = 0, H = 0, dpr = 1;
    let mode = 'touch';
    let bubbles = [], sparks = [], rings = [];
    let last = 0, spawnAcc = 0, running = false;

    const HUES = [336, 345, 352, 326, 8, 318, 14];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const rand = (a, b) => a + Math.random() * (b - a);

    function spawn(x, y, burst) {
      if (bubbles.length >= MAX) return;
      const r = rand(10, burst ? 34 : 38);
      bubbles.push({
        x, y, r,
        vy: rand(28, 70) * (r > 26 ? .8 : 1),
        phase: rand(0, 6.28), freq: rand(.6, 1.6), amp: rand(10, 28),
        hue: HUES[(Math.random() * HUES.length) | 0],
        shift: rand(-60, 150),
        age: 0, life: rand(5, 10),
        ox: x
      });
    }

    function pop(b) {
      rings.push({ x: b.x, y: b.y, r: b.r, hue: b.hue, t: 0 });
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + rand(-.3, .3);
        const sp = rand(40, 110);
        sparks.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: rand(.5, .9), hue: b.hue, gold: Math.random() < .3 });
      }
    }

    function tap(x, y) {
      // revienta las burbujas tocadas
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (Math.hypot(b.x - x, b.y - y) < b.r + 6) { pop(b); bubbles.splice(i, 1); }
      }
      const n = 5 + ((Math.random() * 4) | 0);
      for (let i = 0; i < n; i++) spawn(x + rand(-34, 34), y + rand(-20, 30), true);
    }

    function drawBubble(b) {
      const { x, y, r, hue, shift } = b;
      const fade = Math.min(1, b.age / .6) * (b.life - b.age < .5 ? Math.max(0, (b.life - b.age) / .5) : 1);
      ctx.save();
      ctx.globalAlpha = fade;
      const g = ctx.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r);
      g.addColorStop(0, 'hsla(' + hue + ',100%,98%,.55)');
      g.addColorStop(.55, 'hsla(' + hue + ',85%,86%,.14)');
      g.addColorStop(.88, 'hsla(' + hue + ',90%,72%,.28)');
      g.addColorStop(1, 'hsla(' + (hue + shift) + ',95%,78%,.6)');
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.stroke();
      // brillo
      ctx.beginPath();
      ctx.ellipse(x - r * .35, y - r * .4, r * .22, r * .12, -.7, 0, 6.283);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
      ctx.restore();
    }

    function frame(ts) {
      if (!running) return;
      const dt = Math.min((ts - last) / 1000, .05);
      last = ts;
      ctx.clearRect(0, 0, W, H);

      if (mode === 'auto') {
        spawnAcc += dt;
        if (spawnAcc > .75) { spawnAcc = 0; spawn(rand(0, W), H + 40, false); }
      }

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.age += dt;
        b.y -= b.vy * dt;
        b.x = b.ox + Math.sin(b.phase + b.age * b.freq) * b.amp;
        if (b.y < -b.r * 2) { bubbles.splice(i, 1); continue; }
        if (b.age >= b.life) { pop(b); bubbles.splice(i, 1); continue; }
        drawBubble(b);
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const p = rings[i]; p.t += dt;
        const k = p.t / .45;
        if (k >= 1) { rings.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k * .6), 0, 6.283);
        ctx.strokeStyle = 'hsla(' + p.hue + ',100%,85%,' + (.7 * (1 - k)) + ')';
        ctx.lineWidth = 2 * (1 - k) + .5; ctx.stroke();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.t += dt;
        if (s.t >= s.life) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt;
        const a = 1 - s.t / s.life;
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.2 * a + .4, 0, 6.283);
        ctx.fillStyle = s.gold ? 'rgba(235,200,120,' + a + ')' : 'hsla(' + s.hue + ',100%,88%,' + a + ')';
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }

    function setMode(m) { mode = m; }

    function init() {
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('pointerdown', (e) => {
        if (current < 3) return;
        if (e.target.closest('button, input, a')) return;
        tap(e.clientX, e.clientY);
        const hint = $('tap-hint'); if (hint) hint.style.opacity = 0;
      });
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) { running = false; }
        else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
      });
    }
    return { init, setMode };
  })();

  /* =====================================================
     PANTALLA 3 · LA CARTA
  ===================================================== */
  const Letter = (() => {
    const scroller = $('screen-3');
    const end = $('letter-end');
    let built = false;

    function checkEnd() {
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 80;
      if (atBottom) end.classList.add('in');
    }

    function build() {
      if (built) return; built = true;
      $('letter-greeting').textContent = D.letter.greeting;
      const body = $('letter-body');
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
      }, { root: scroller, threshold: .12 });
      D.letter.paragraphs.forEach((t) => {
        const p = document.createElement('p');
        p.className = 'para'; p.textContent = t;
        body.appendChild(p); io.observe(p);
      });
      $('letter-final').textContent = D.letter.finalButton;
      $('letter-final').addEventListener('click', () => goTo(4));
      scroller.addEventListener('scroll', checkEnd, { passive: true });
    }

    function onEnter() { build(); scroller.scrollTop = 0; setTimeout(checkEnd, 400); }
    return { onEnter };
  })();

  /* =====================================================
     PANTALLA 4 · REPRODUCTOR + FRAGMENTOS
  ===================================================== */
  const Player = (() => {
    const tracks = D.tracks;
    let idx = 0;
    let bag = [];
    let lastFrag = -1;
    const room = $('screen-4');
    const seek = $('seek'), tCur = $('t-cur'), tDur = $('t-dur');
    const fragEl = $('fragment'), fragTxt = $('fragment-text');
    const list = $('tracklist');
    let seeking = false;

    const fmt = (s) => !isFinite(s) ? '0:00' : Math.floor(s / 60) + ':' + pad(Math.floor(s % 60));

    function nextFragment() {
      if (!bag.length) {
        bag = D.fragments.map((_, i) => i);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = (Math.random() * (i + 1)) | 0;
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag[bag.length - 1] === lastFrag && bag.length > 1) bag.unshift(bag.pop());
      }
      lastFrag = bag.pop();
      return D.fragments[lastFrag];
    }

    function showFragment() {
      fragTxt.textContent = nextFragment();
      fragEl.classList.remove('pop');
      void fragEl.offsetWidth;
      fragEl.classList.add('pop');
    }

    function renderNow() {
      const t = tracks[idx];
      $('now-title').textContent = t.title;
      $('now-artist').textContent = t.artist;
      [...list.children].forEach((li, i) => li.classList.toggle('cur', i === idx));
    }

    function load(i, autoplay) {
      idx = (i + tracks.length) % tracks.length;
      audio.loop = false;
      audio.src = tracks[idx].src;
      seek.value = 0; seek.style.setProperty('--p', '0%');
      tCur.textContent = '0:00'; tDur.textContent = '0:00';
      renderNow();
      if (autoplay) audio.play().catch(() => {});
    }

    function toggle() {
      if (audio.paused) { audio.play().catch(() => {}); showFragment(); }
      else audio.pause();
    }

    function select(i) {
      if (i === idx && audio.currentSrc) { toggle(); return; }
      load(i, true); showFragment();
    }

    function onEnter() {
      audio.loop = false; // la sala controla el flujo de canciones
      idx = 0;
      renderNow();
      syncTime(); syncPlay();
    }

    function syncPlay() { room.classList.toggle('is-playing', !audio.paused); $('btn-play').setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar'); }
    function syncTime() {
      const d = audio.duration, c = audio.currentTime;
      tCur.textContent = fmt(c); tDur.textContent = fmt(d);
      if (!seeking && isFinite(d) && d > 0) {
        const v = (c / d) * 1000;
        seek.value = v; seek.style.setProperty('--p', (v / 10) + '%');
      }
    }

    function init() {
      tracks.forEach((t, i) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span></span><small></small>';
        b.firstChild.textContent = t.title;
        b.lastChild.textContent = t.artist;
        b.addEventListener('click', () => select(i));
        li.appendChild(b); list.appendChild(li);
      });
      $('btn-play').addEventListener('click', toggle);
      $('btn-next').addEventListener('click', () => { load(idx + 1, true); showFragment(); });
      $('btn-prev').addEventListener('click', () => {
        if (audio.currentTime > 4) audio.currentTime = 0; else { load(idx - 1, true); showFragment(); }
      });
      $('btn-memory').addEventListener('click', showFragment);

      seek.addEventListener('input', () => {
        seeking = true;
        seek.style.setProperty('--p', (seek.value / 10) + '%');
        if (isFinite(audio.duration)) tCur.textContent = fmt((seek.value / 1000) * audio.duration);
      });
      seek.addEventListener('change', () => {
        if (isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration;
        seeking = false;
      });

      audio.addEventListener('timeupdate', syncTime);
      audio.addEventListener('loadedmetadata', syncTime);
      audio.addEventListener('play', syncPlay);
      audio.addEventListener('pause', syncPlay);
      audio.addEventListener('ended', () => {
        if (current === 4) { load(idx + 1, true); showFragment(); }
      });
    }
    return { init, onEnter };
  })();

  /* =====================================================
     ARRANQUE
  ===================================================== */
  Bubbles.init();
  Bypass.init();
  Pin.init();
  Player.init();
  Countdown.init();
})();
