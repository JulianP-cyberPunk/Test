// Gemeinsamer Kern für alle Varianten. Gleicher Speicher wie die Hauptversion,
// darum bleiben Haken, Wasser und Zähler beim Wechseln erhalten.
(() => {
  "use strict";
  const KEY = "tag.v1";
  const DAY_SHIFT = 5 * 60;
  const uid = () => Math.random().toString(36).slice(2, 9);

  function freshState() {
    return {
      routines: {
        morning: DEFAULT_ROUTINES.morning.map((text) => ({ id: uid(), text })),
        evening: DEFAULT_ROUTINES.evening.map((text) => ({ id: uid(), text })),
      },
      waketime: "08:00",
      bedtime: "00:30",
      days: {},
      urgeWins: 0,
      brickCount: 0,
    };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.routines) return { ...freshState(), ...s };
    } catch (e) { /* neu anfangen */ }
    return freshState();
  }

  const T = {};
  T.state = load();
  T.save = () => localStorage.setItem(KEY, JSON.stringify(T.state));

  T.logicalDate = (d = new Date()) => new Date(d.getTime() - DAY_SHIFT * 60000);
  T.keyOf = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  T.dayKey = (d = new Date()) => T.keyOf(T.logicalDate(d));

  T.today = () => {
    const k = T.dayKey();
    T.state.days[k] = { morning: [], evening: [], focus: "", focusDone: false, bricked: false, water: 0, ideas: [], ...(T.state.days[k] || {}) };
    return T.state.days[k];
  };

  T.phase = (h = new Date().getHours()) => (h >= 5 && h < 11 ? "morning" : h >= 11 && h < 17 ? "day" : h >= 17 && h < 22 ? "evening" : "night");
  T.greeting = () => ({ morning: "Guten Morgen", day: "Hallo", evening: "Guten Abend", night: "Zeit zu schlafen" })[T.phase()];
  T.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  T.pickOther = (arr, cur) => { if (arr.length < 2) return arr[0]; let n; do { n = T.pick(arr); } while (n === cur); return n; };

  T.dayIndex = () => { const x = T.logicalDate(); return Math.floor(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000); };
  T.nudge = () => { const p = T.phase(); return NUDGES[p][T.dayIndex() % NUDGES[p].length]; };
  T.quoteOfDay = () => QUOTES[T.dayIndex() % QUOTES.length];
  T.otherQuote = (cur) => T.pickOther(QUOTES, cur);

  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const shifted = (m) => (m - DAY_SHIFT + 1440) % 1440;
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  T.nowMin = nowMin;

  T.fmtDur = (min) => { const h = Math.floor(min / 60), m = min % 60; return h === 0 ? `${m} Min.` : m ? `${h} Std. ${m} Min.` : `${h} Std.`; };
  T.isoWeek = (d) => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    return Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
  };
  T.daysLeftInYear = (d = new Date()) => Math.round((new Date(d.getFullYear() + 1, 0, 1) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000) - 1;

  // Wo stehst du in deinem wachen Tag? f = 0 beim Aufstehen, 1 bei Handy weg.
  T.dayProgress = () => {
    const wake = shifted(toMin(T.state.waketime));
    let bed = shifted(toMin(T.state.bedtime));
    if (bed <= wake) bed = wake + 60;
    const now = shifted(nowMin());
    return { f: Math.min(1, Math.max(0, (now - wake) / (bed - wake))), beforeWake: now < wake, afterBed: now >= bed, untilWake: wake - now, untilBed: bed - now, wake, bed };
  };

  T.minutesUntilBedtime = () => shifted(toMin(T.state.bedtime)) - shifted(nowMin());
  T.bedtimeText = () => {
    const left = T.minutesUntilBedtime();
    if (left <= 0) return { text: "Handy-weg-Zeit ist vorbei. Leg es jetzt weg.", urgent: true };
    if (left <= 60) return { text: `Noch ${left} Min. bis Handy weg`, urgent: true };
    return { text: `Handy weg um ${T.state.bedtime} Uhr`, urgent: false };
  };

  T.isComplete = (day, which) => {
    const items = T.state.routines[which];
    return !!day && items.length > 0 && items.every((it) => (day[which] || []).includes(it.id));
  };

  T.streak = () => {
    let n = 0;
    const d = T.logicalDate();
    const any = (x) => T.isComplete(T.state.days[T.keyOf(x)], "morning") || T.isComplete(T.state.days[T.keyOf(x)], "evening");
    if (!any(d)) d.setDate(d.getDate() - 1);
    while (any(d)) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };

  T.doneToday = () => { const d = T.today(); return d.morning.length + d.evening.length + d.ideas.length + (d.focusDone ? 1 : 0); };

  T.week = () => {
    const t = T.logicalDate();
    const monday = new Date(t);
    monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const day = T.state.days[T.keyOf(d)];
      return {
        date: d,
        short: d.toLocaleDateString("de-AT", { weekday: "short" }).replace(".", ""),
        isToday: T.keyOf(d) === T.keyOf(t),
        m: T.isComplete(day, "morning"),
        e: T.isComplete(day, "evening"),
        done: day ? day.morning.length + day.evening.length + (day.ideas || []).length + (day.focusDone ? 1 : 0) : 0,
      };
    });
  };

  T.defaultTab = () => { const h = new Date().getHours(); return h >= 4 && h < 15 ? "morning" : "evening"; };

  // ---- Aktionen ----
  T.toggleRoutine = (which, id) => {
    const arr = T.today()[which];
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    T.save();
    return { on: i < 0, complete: T.isComplete(T.today(), which) };
  };
  T.setFocus = (text) => { T.today().focus = text; T.save(); };
  T.toggleFocus = () => { const d = T.today(); d.focusDone = !d.focusDone; T.save(); return d.focusDone; };
  T.water = (delta) => { const d = T.today(); d.water = Math.max(0, Math.min(8, d.water + delta)); T.save(); return d.water; };
  T.brick = () => { const d = T.today(); const first = !d.bricked; if (first) { d.bricked = true; T.state.brickCount++; T.save(); } return first; };
  T.urgeWin = () => { T.state.urgeWins++; T.save(); };
  T.markIdea = (text, on) => {
    const d = T.today();
    const i = d.ideas.indexOf(text);
    if (on && i < 0) d.ideas.push(text);
    if (!on && i >= 0) d.ideas.splice(i, 1);
    T.save();
  };
  T.ideaDone = (text) => T.today().ideas.includes(text);
  T.totalIdeas = IDEA_GROUPS.reduce((n, g) => n + g.items.length, 0);

  // ---- Drang-Timer ----
  T.urgeTimer = (onTick, minutes = 10) => {
    const total = minutes * 60000, start = Date.now(), end = start + total;
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const cyc = ((Date.now() - start) / 1000) % 10;
      onTick({ left, frac: left / total, label: left > 0 ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` : "Geschafft", breath: cyc < 4 ? "Einatmen" : cyc < 5 ? "Halten" : "Ausatmen" });
      if (left === 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  };

  // ---- Uhr mit rollenden Ziffern ----
  // spans: vier Elemente für HHMM. Ziffern rollen nur beim Wechsel.
  T.rollingClock = (spans, root) => {
    let last = "";
    const render = () => {
      const n = new Date();
      const str = String(n.getHours()).padStart(2, "0") + String(n.getMinutes()).padStart(2, "0");
      if (str === last) return;
      const first = last === "";
      spans.forEach((span, i) => {
        if (!first && str[i] === last[i]) return;
        const old = span.querySelector("b:not(.out)");
        const b = document.createElement("b");
        b.textContent = str[i];
        if (!first) b.className = "in";
        if (old) { old.className = "out"; setTimeout(() => old.remove(), 700); }
        span.append(b);
      });
      if (root) root.setAttribute("aria-label", `${str.slice(0, 2)}:${str.slice(2)} Uhr`);
      last = str;
    };
    render();
    setInterval(render, 1000);
  };

  // ---- Hilfen ----
  T.toast = (msg) => {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(T._tt);
    T._tt = setTimeout(() => t.classList.remove("show"), 2600);
  };
  T.restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  T.openSheet = (el) => (el.showModal ? el.showModal() : el.setAttribute("open", ""));
  T.closeSheet = (el) => (el.close ? el.close() : el.removeAttribute("open"));
  T.wireSheets = () => document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("click", (e) => { if (e.target === dlg) T.closeSheet(dlg); });
    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => T.closeSheet(dlg)));
  });
  T.everyMinute = (fn) => {
    let lastMin = nowMin();
    setInterval(() => { if (nowMin() !== lastMin) { lastMin = nowMin(); fn(); } }, 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) fn(); });
  };
  T.el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  window.Tag = T;
})();
