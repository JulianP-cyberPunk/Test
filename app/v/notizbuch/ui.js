(() => {
  "use strict";
  const T = window.Tag;
  const $ = (id) => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const NOTE_COLORS = ["#fff1a8", "#ffd3dd", "#c9f2df", "#cfe4ff", "#ffe0bf", "#e6dcff"];

  // ---------- Analoge Uhr ----------
  const ticks = $("wTicks");
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 * Math.PI) / 180, r1 = i % 3 === 0 ? 33 : 37, r2 = 40;
    ticks.append(svgEl("line", { x1: 50 + Math.sin(a) * r1, y1: 50 - Math.cos(a) * r1, x2: 50 + Math.sin(a) * r2, y2: 50 - Math.cos(a) * r2 }));
  }
  let lastMinAngle = null;
  function renderWatch() {
    const n = new Date();
    const mins = n.getHours() * 60 + n.getMinutes();
    const minAngle = mins * 6;           // läuft über den Tag weiter, kein Rücksprung bei :00
    const hourAngle = mins * 0.5;
    const w = $("watch");
    w.classList.toggle("no-anim", lastMinAngle === null || minAngle < lastMinAngle);
    $("wMin").style.transform = `rotate(${minAngle}deg)`;
    $("wHour").style.transform = `rotate(${hourAngle}deg)`;
    w.setAttribute("aria-label", `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")} Uhr`);
    lastMinAngle = minAngle;
  }

  // ---------- Kopf ----------
  function renderTop() {
    const n = new Date();
    $("date").textContent = n.toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" });
    $("hello").textContent = `${T.greeting()}. KW ${T.isoWeek(n)}`;
    $("nudge").textContent = T.nudge();
    const b = T.bedtimeText();
    $("bedInfo").textContent = b.text;
    $("bedInfo").classList.toggle("urgent", b.urgent);
    const d = T.today();
    $("stamped").classList.toggle("show", d.bricked);
    $("stampDate").textContent = n.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  // ---------- Tageslinie ----------
  const dayPath = $("dayPath");
  const pathLen = dayPath.getTotalLength();
  function renderDay() {
    const p = T.dayProgress();
    const done = $("dayDone");
    done.style.strokeDasharray = `${pathLen}`;
    done.style.strokeDashoffset = `${pathLen * (1 - p.f)}`;
    const pt = dayPath.getPointAtLength(pathLen * p.f);
    $("dayYou").style.transform = `translate(${pt.x}px, ${pt.y}px)`;
    $("youLabel").style.left = `${(pt.x / 340) * 100}%`;
    $("youLabel").textContent = p.afterBed ? "Schlafenszeit" : p.beforeWake ? "noch im Bett" : "du bist hier";
    $("dWake").textContent = T.state.waketime;
    $("dBed").textContent = T.state.bedtime;
    $("dLeft").textContent = p.afterBed || p.beforeWake ? "" : `noch ${T.fmtDur(p.untilBed)}`;
  }

  // ---------- Fokus ----------
  function renderFocus() {
    const d = T.today();
    if (document.activeElement !== $("focus")) $("focus").value = d.focus;
    $("focusDone").setAttribute("aria-pressed", String(d.focusDone));
    document.querySelector(".focus-row").classList.toggle("done", d.focusDone);
  }
  $("focus").addEventListener("input", (e) => T.setFocus(e.target.value));
  $("focus").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("focusDone").addEventListener("click", () => {
    if (!T.today().focus.trim() && !T.today().focusDone) { $("focus").focus(); return; }
    if (T.toggleFocus()) T.toast("Markiert. Stark.");
    renderFocus(); renderCal();
  });

  // ---------- Häkchen-Liste ----------
  const CB = '<span class="cb" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="3" y="4" width="25" height="24" rx="3" class="cb-box"/><path d="M8 17 L14 23 L28 6" class="cb-tick"/></svg></span>';
  function checkRow(text, on, onClick) {
    const li = T.el("li");
    const b = T.el("button");
    b.setAttribute("aria-pressed", String(on));
    b.innerHTML = `${CB}<span></span>`;
    b.lastChild.textContent = text;
    b.addEventListener("click", () => onClick(b));
    li.append(b);
    return li;
  }

  let tab = T.defaultTab();
  function renderRoutine() {
    $("tM").setAttribute("aria-selected", String(tab === "morning"));
    $("tE").setAttribute("aria-selected", String(tab === "evening"));
    const d = T.today();
    const ul = $("checks");
    ul.innerHTML = "";
    for (const it of T.state.routines[tab]) {
      ul.append(checkRow(it.text, d[tab].includes(it.id), (b) => {
        const r = T.toggleRoutine(tab, it.id);
        b.setAttribute("aria-pressed", String(r.on));
        renderCal();
        if (r.on && r.complete) T.toast(tab === "morning" ? "Morgen: alles abgehakt." : "Abend: alles abgehakt. Gute Nacht.");
      }));
    }
  }
  $("tM").addEventListener("click", () => { tab = "morning"; renderRoutine(); });
  $("tE").addEventListener("click", () => { tab = "evening"; renderRoutine(); });

  // ---------- Spruch ----------
  let q = T.quoteOfDay();
  const renderQuote = () => { $("q").textContent = `„${q.t}“`; $("qBy").textContent = q.a ? `– ${q.a}` : ""; };
  $("qNext").addEventListener("click", () => { q = T.otherQuote(q); renderQuote(); T.restart($("q"), "swap"); });

  // ---------- Strichliste ----------
  const STROKES = [
    "M12 8 L10 42", "M24 8 L23 42", "M36 9 L35 42", "M48 8 L47 41", "M4 34 L56 14",
    "M84 9 L82 42", "M96 8 L95 42", "M108 9 L107 41",
  ];
  const tally = $("tally");
  STROKES.forEach((d) => tally.append(svgEl("path", { d, class: "slot" })));
  const inks = STROKES.map((d) => { const p = svgEl("path", { d }); tally.append(p); return p; });
  function renderWater() {
    const w = T.today().water;
    inks.forEach((p, i) => p.classList.toggle("on", i < w));
    $("waterHint").textContent = w >= 8 ? "8 Gläser. Fertig!" : w === 0 ? "tippen für ein Glas" : `${w} von 8 Gläsern`;
  }
  $("waterPlus").addEventListener("click", () => { T.water(1); renderWater(); });
  $("waterMinus").addEventListener("click", () => { T.water(-1); renderWater(); });

  // ---------- Zettel ----------
  let drawn = null;
  function pull() {
    const g = T.pick(IDEA_GROUPS);
    const text = drawn ? T.pickOther(g.items, drawn.text) : T.pick(g.items);
    drawn = { g, text };
    $("drawn").hidden = false;
    $("drawnG").textContent = g.name;
    $("drawnT").textContent = text;
    T.restart($("drawn"), "drawn");
  }
  $("pull").addEventListener("click", pull);
  $("drawnAgain").addEventListener("click", pull);
  $("drawnGo").addEventListener("click", () => { if (!drawn) return; T.markIdea(drawn.text, true); renderCal(); T.toast("Notiert. Handy weg, los."); });

  IDEA_GROUPS.forEach((g, i) => {
    const b = T.el("button", "sticky");
    b.style.setProperty("--c", NOTE_COLORS[i % NOTE_COLORS.length]);
    b.style.setProperty("--r", `${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg`);
    b.innerHTML = `<svg aria-hidden="true"><use href="../../icons.svg#i-${g.icon}"/></svg><b></b>`;
    b.querySelector("b").textContent = g.name;
    b.addEventListener("click", () => {
      $("noteT").textContent = g.name;
      const ul = $("noteList");
      ul.innerHTML = "";
      for (const it of g.items) ul.append(checkRow(it, T.ideaDone(it), (btn) => { const on = !T.ideaDone(it); T.markIdea(it, on); btn.setAttribute("aria-pressed", String(on)); renderCal(); }));
      T.openSheet($("noteSheet"));
    });
    $("stickies").append(b);
  });

  // ---------- Stempel ----------
  $("stamp").addEventListener("click", () => {
    const first = T.brick();
    $("stamped").classList.add("show");
    T.restart($("stamped"), "hit");
    T.toast(first ? "Gestempelt. Handy weg." : "Heute schon gestempelt.");
  });

  // ---------- Drang ----------
  const ringLen = 2 * Math.PI * 80;
  let stop = null;
  $("urge").addEventListener("click", () => {
    $("uIdea").textContent = T.pick(URGE_IDEAS);
    $("uFill").style.strokeDasharray = `${ringLen}`;
    stop && stop();
    stop = T.urgeTimer(({ label, frac, breath }) => {
      $("uTime").textContent = label;
      $("uFill").style.strokeDashoffset = `${ringLen * (1 - frac)}`;
      $("uBreath").textContent = breath.toLowerCase();
    });
    T.openSheet($("urgeSheet"));
  });
  $("urgeSheet").addEventListener("close", () => stop && stop());
  $("uOther").addEventListener("click", () => { $("uIdea").textContent = T.pickOther(URGE_IDEAS, $("uIdea").textContent); });
  $("uWon").addEventListener("click", () => { T.urgeWin(); T.closeSheet($("urgeSheet")); T.toast("Welle vorbei. Gut gemacht."); });

  // ---------- Kalender ----------
  const CIRCLE = "M23 4 C 38 3, 44 14, 42 24 C 40 37, 26 44, 13 39 C 3 35, 1 21, 7 12 C 11 6, 18 3, 27 5";
  const CIRCLE2 = "M21 2 C 40 0, 47 15, 44 26 C 41 40, 24 47, 11 41 C 0 36, -1 19, 6 9 C 10 3, 18 1, 26 3";
  function renderCal() {
    const ol = $("cal");
    ol.innerHTML = "";
    for (const d of T.week()) {
      const li = T.el("li", d.isToday ? "today" : "");
      li.append(T.el("span", "wd", d.short));
      const n = T.el("span", "n", String(d.date.getDate()));
      if (d.m || d.e) {
        const s = svgEl("svg", { viewBox: "0 0 46 46", "aria-hidden": "true" });
        s.append(svgEl("path", { d: CIRCLE }));
        if (d.m && d.e) s.append(svgEl("path", { d: CIRCLE2 }));
        n.append(s);
      }
      li.append(n);
      li.setAttribute("aria-label", `${d.short}: Morgen ${d.m ? "geschafft" : "offen"}, Abend ${d.e ? "geschafft" : "offen"}`);
      ol.append(li);
    }
  }

  // ---------- Start ----------
  function renderAll() { renderWatch(); renderTop(); renderDay(); renderFocus(); renderRoutine(); renderQuote(); renderWater(); renderCal(); }
  T.wireSheets();
  renderAll();
  T.save();
  T.everyMinute(renderAll);
})();
