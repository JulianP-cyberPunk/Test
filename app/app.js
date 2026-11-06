(() => {
  "use strict";

  const KEY = "tag.v1";
  const $ = (id) => document.getElementById(id);
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---------- Speicher ----------
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
    } catch (e) { /* kaputter Speicher: neu anfangen */ }
    return freshState();
  }

  let state = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  // ---------- Zeit ----------
  // Ein "Tag" geht bis 5 Uhr früh, damit die Abendroutine nach Mitternacht noch zählt.
  const DAY_SHIFT = 5 * 60;
  const logicalDate = (d = new Date()) => new Date(d.getTime() - DAY_SHIFT * 60000);
  const keyOf = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const dayKey = (d = new Date()) => keyOf(logicalDate(d));

  function blankDay() {
    return { morning: [], evening: [], focus: "", focusDone: false, bricked: false, water: 0, ideas: [] };
  }

  function today() {
    const k = dayKey();
    state.days[k] = { ...blankDay(), ...(state.days[k] || {}) };
    return state.days[k];
  }

  function phase(h = new Date().getHours()) {
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 17) return "day";
    if (h >= 17 && h < 22) return "evening";
    return "night";
  }

  const GREETING = { morning: "Guten Morgen", day: "Hallo", evening: "Guten Abend", night: "Zeit zu schlafen" };
  const THEME = { morning: "#bcd6ec", day: "#c9e0f2", evening: "#34426f", night: "#0d1430" };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  // Minuten seit 5 Uhr früh: so liegt 00:30 nach 23:00.
  const shifted = (m) => (m - DAY_SHIFT + 1440) % 1440;
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

  function dayIndex() {
    const x = logicalDate();
    return Math.floor(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000);
  }

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }

  function fmtDur(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} Min.`;
    return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function bump(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  // ---------- Uhr ----------
  const clockDigits = [...document.querySelectorAll(".clock-d")];
  let lastDigits = "";

  function renderClock() {
    const n = new Date();
    const str = String(n.getHours()).padStart(2, "0") + String(n.getMinutes()).padStart(2, "0");
    if (str === lastDigits) return;
    const first = lastDigits === "";
    clockDigits.forEach((span, i) => {
      if (!first && str[i] === lastDigits[i]) return;
      const old = span.querySelector("b:not(.out)");
      const b = document.createElement("b");
      b.textContent = str[i];
      if (!first) b.className = "in";
      if (old) {
        old.className = "out";
        old.addEventListener("animationend", () => old.remove(), { once: true });
        setTimeout(() => old.remove(), 700);
      }
      span.append(b);
    });
    $("clock").setAttribute("datetime", `${str.slice(0, 2)}:${str.slice(2)}`);
    $("clock").setAttribute("aria-label", `${str.slice(0, 2)}:${str.slice(2)} Uhr`);
    lastDigits = str;
  }

  // ---------- Kopf, Datum ----------
  function renderTop() {
    const p = phase();
    document.documentElement.dataset.phase = p;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", THEME[p]);
    $("greeting").textContent = GREETING[p];
    const now = new Date();
    $("nudge").textContent = NUDGES[p][dayIndex() % NUDGES[p].length];

    $("wdWeekday").textContent = now.toLocaleDateString("de-AT", { weekday: "long" });
    $("wdDay").textContent = now.getDate();
    $("wdMonth").textContent = now.toLocaleDateString("de-AT", { month: "long", year: "numeric" });
    const start = new Date(now.getFullYear(), 0, 1);
    const yday = Math.floor((now - start) / 86400000) + 1;
    const ylen = (new Date(now.getFullYear() + 1, 0, 1) - start) / 86400000;
    $("wdWeek").textContent = `KW ${isoWeek(now)}, noch ${ylen - yday} Tage im Jahr`;
  }

  // ---------- Bogen: dein wacher Tag ----------
  const arcTrack = $("arcTrack");
  const arcLen = arcTrack.getTotalLength();
  let ticksFor = "";

  function renderArc() {
    const wake = shifted(toMin(state.waketime));
    let bed = shifted(toMin(state.bedtime));
    if (bed <= wake) bed = wake + 60;
    const now = shifted(nowMin());
    const f = Math.min(1, Math.max(0, (now - wake) / (bed - wake)));

    const done = $("arcDone");
    done.style.strokeDasharray = `${arcLen}`;
    done.style.strokeDashoffset = `${arcLen * (1 - f)}`;

    const pt = arcTrack.getPointAtLength(arcLen * f);
    const sun = $("arcSun");
    sun.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
    sun.classList.toggle("moon", now >= bed);

    // Stunden-Striche einmal pro Einstellung zeichnen
    const sig = `${state.waketime}-${state.bedtime}`;
    if (sig !== ticksFor) {
      ticksFor = sig;
      const g = $("arcTicks");
      g.innerHTML = "";
      const firstHour = Math.ceil(wake / 60) * 60;
      for (let m = firstHour; m < bed; m += 60) {
        const t = (m - wake) / (bed - wake);
        if (t < 0.03 || t > 0.97) continue;
        const p = arcTrack.getPointAtLength(arcLen * t);
        const dx = 160 - p.x, dy = 116 - p.y;
        const l = Math.hypot(dx, dy) || 1;
        const line = document.createElementNS(SVGNS, "line");
        line.setAttribute("x1", p.x); line.setAttribute("y1", p.y);
        line.setAttribute("x2", p.x + (dx / l) * 6); line.setAttribute("y2", p.y + (dy / l) * 6);
        g.append(line);
        const hour = ((m + DAY_SHIFT) / 60) % 24;
        if (hour % 3 === 0) {
          const tx = document.createElementNS(SVGNS, "text");
          tx.setAttribute("x", p.x + (dx / l) * 17);
          tx.setAttribute("y", p.y + (dy / l) * 17 + 3.5);
          tx.setAttribute("text-anchor", "middle");
          tx.textContent = String(hour);
          g.append(tx);
        }
      }
    }

    $("arcWake").textContent = `Auf ${state.waketime}`;
    $("arcBed").textContent = `Handy weg ${state.bedtime}`;
    let meta;
    if (now < wake) meta = `Noch ${fmtDur(wake - now)} bis zum Aufstehen`;
    else if (now >= bed) meta = "Schlafenszeit";
    else meta = `Noch ${fmtDur(bed - now)} wach`;
    $("arcMeta").textContent = meta;
  }

  // ---------- Wasser ----------
  const DROPS = 8;
  function renderWater(popIndex = -1) {
    const d = today();
    const box = $("drops");
    if (!box.children.length) {
      for (let i = 0; i < DROPS; i++) {
        const s = document.createElementNS(SVGNS, "svg");
        s.setAttribute("viewBox", "0 0 24 24");
        s.classList.add("drop");
        const u = document.createElementNS(SVGNS, "use");
        u.setAttribute("href", "#i-drop");
        s.append(u);
        box.append(s);
      }
    }
    [...box.children].forEach((s, i) => {
      s.classList.toggle("full", i < d.water);
      if (i === popIndex) { s.classList.remove("pop"); void s.getBoundingClientRect(); s.classList.add("pop"); }
    });
    $("waterCount").textContent = d.water;
  }

  // ---------- Spruch ----------
  let quoteIdx = null;
  function renderQuote(random = false) {
    if (random) {
      let i;
      do { i = Math.floor(Math.random() * QUOTES.length); } while (i === quoteIdx && QUOTES.length > 1);
      quoteIdx = i;
      const q = $("quote");
      q.classList.remove("swap"); void q.offsetWidth; q.classList.add("swap");
    } else if (quoteIdx === null) {
      quoteIdx = dayIndex() % QUOTES.length;
    }
    const q = QUOTES[quoteIdx];
    $("quoteText").textContent = `„${q.t}“`;
    $("quoteBy").textContent = q.a || "";
  }

  // ---------- Eine Sache ----------
  function renderFocus() {
    const d = today();
    const input = $("focusInput");
    if (document.activeElement !== input) input.value = d.focus;
    $("focusDone").setAttribute("aria-pressed", String(d.focusDone));
    document.querySelector(".focus").classList.toggle("done", d.focusDone);
  }

  // ---------- Routine ----------
  let tab = (() => { const h = new Date().getHours(); return h >= 4 && h < 15 ? "morning" : "evening"; })();

  function isComplete(day, which) {
    const items = state.routines[which];
    return !!day && items.length > 0 && items.every((it) => (day[which] || []).includes(it.id));
  }

  function streak() {
    let n = 0;
    const d = logicalDate();
    const any = (x) => isComplete(state.days[keyOf(x)], "morning") || isComplete(state.days[keyOf(x)], "evening");
    if (!any(d)) d.setDate(d.getDate() - 1);
    while (any(d)) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function renderRoutine() {
    $("tabMorning").setAttribute("aria-selected", String(tab === "morning"));
    $("tabEvening").setAttribute("aria-selected", String(tab === "evening"));
    document.querySelector(".seg").dataset.tab = tab;

    const d = today();
    const items = state.routines[tab];
    const list = $("routineList");
    list.innerHTML = "";
    for (const it of items) {
      const done = d[tab].includes(it.id);
      const li = document.createElement("li");
      const row = document.createElement("button");
      row.className = "row";
      row.setAttribute("aria-pressed", String(done));
      row.addEventListener("click", () => toggleRoutine(it.id));
      const mark = document.createElement("i");
      mark.className = "check";
      mark.setAttribute("aria-hidden", "true");
      const span = document.createElement("span");
      span.textContent = it.text;
      row.append(mark, span);
      li.append(row);
      list.append(li);
    }

    const n = items.filter((it) => d[tab].includes(it.id)).length;
    $("routineCount").textContent = items.length ? `${n} von ${items.length}` : "";
    $("routineBar").style.transform = `scaleX(${items.length ? n / items.length : 0})`;
  }

  function toggleRoutine(id) {
    const d = today();
    const arr = d[tab];
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    save();
    renderRoutine();
    renderStats();
    renderWeek();
    if (i < 0 && isComplete(d, tab)) toast(tab === "morning" ? "Morgenroutine geschafft. Starker Start." : "Abendroutine geschafft. Schlaf gut.");
  }

  // ---------- Handy weg ----------
  function minutesUntilBedtime() {
    return shifted(toMin(state.bedtime)) - shifted(nowMin());
  }

  function renderPhoneDown() {
    const d = today();
    const left = minutesUntilBedtime();
    let info;
    if (left <= 0) info = "Handy-weg-Zeit ist vorbei. Leg es jetzt weg.";
    else if (left <= 60) info = `Noch ${left} Min. bis Handy weg`;
    else info = `Handy weg um ${state.bedtime} Uhr`;
    $("bedtimeInfo").textContent = info;
    $("phoneDown").classList.toggle("urgent", left <= 60);
    $("brickSub").textContent = d.bricked ? "Heute schon gemacht" : "Brick drauf und los";
  }

  function brick() {
    const d = today();
    if (!d.bricked) {
      d.bricked = true;
      state.brickCount++;
      save();
      bump($("statBrick"));
    }
    const p = phase();
    toast(p === "night" || p === "evening" ? "Stark. Handy weg, gute Nacht." : "Stark. Handy weg, Leben an.");
    renderPhoneDown();
    renderStats();
  }

  // ---------- Zahlen und Woche ----------
  function doneToday() {
    const d = today();
    return d.morning.length + d.evening.length + d.ideas.length + (d.focusDone ? 1 : 0);
  }

  function renderStats() {
    const s = streak();
    $("statStreak").textContent = s;
    $("statStreakLabel").textContent = s === 1 ? "Tag Serie" : "Tage Serie";
    $("statDone").textContent = doneToday();
    $("statWaves").textContent = state.urgeWins;
    $("statBrick").textContent = state.brickCount;
  }

  function renderWeek() {
    const ol = $("weekDays");
    ol.innerHTML = "";
    const t = logicalDate();
    const monday = new Date(t);
    monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const k = keyOf(d);
      const day = state.days[k];
      const li = document.createElement("li");
      if (k === keyOf(t)) li.className = "today";
      const label = d.toLocaleDateString("de-AT", { weekday: "short" }).replace(".", "");
      const m = isComplete(day, "morning"), e = isComplete(day, "evening");
      li.innerHTML = `<span>${label}</span><span class="wk-dots"><i class="wk-dot m${m ? " on" : ""}"></i><i class="wk-dot e${e ? " on" : ""}"></i></span>`;
      li.setAttribute("aria-label", `${d.toLocaleDateString("de-AT", { weekday: "long" })}: Morgen ${m ? "geschafft" : "offen"}, Abend ${e ? "geschafft" : "offen"}`);
      ol.append(li);
    }
    if (!document.querySelector(".week-legend")) {
      const lg = document.createElement("p");
      lg.className = "week-legend";
      lg.innerHTML = '<span><i class="wk-dot m on"></i>Morgenroutine</span><span><i class="wk-dot e on"></i>Abendroutine</span>';
      ol.after(lg);
    }
  }

  // ---------- Sheets ----------
  function openSheet(el) {
    if (typeof el.showModal === "function") el.showModal(); else el.setAttribute("open", "");
  }

  function closeSheet(el) {
    if (typeof el.close === "function") el.close(); else el.removeAttribute("open");
  }

  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("click", (e) => { if (e.target === dlg) closeSheet(dlg); });
    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => closeSheet(dlg)));
  });

  // ---------- Ideen ----------
  const icon = (name, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const totalIdeas = IDEA_GROUPS.reduce((n, g) => n + g.items.length, 0);

  function setIdeasView(back) {
    const body = $("ideasBody");
    body.classList.toggle("back", !!back);
    body.innerHTML = "";
    $("ideasSheet").querySelector(".sheet-inner").scrollTop = 0;
    return body;
  }

  function showGroups(back = false) {
    $("ideasTitle").textContent = "Was mach ich jetzt?";
    $("ideasBack").hidden = true;
    const body = setIdeasView(back);

    const rnd = document.createElement("button");
    rnd.className = "surprise";
    rnd.innerHTML = `${icon("shuffle")}<span><b>Überrasch mich</b><small>Eine zufällige Idee aus ${totalIdeas}</small></span>`;
    rnd.addEventListener("click", () => showGroup(pick(IDEA_GROUPS)));

    const ul = document.createElement("ul");
    ul.className = "groups";
    for (const g of IDEA_GROUPS) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.className = "group-btn";
      b.innerHTML = `<span class="group-ic">${icon(g.icon)}</span><span class="group-txt"><b></b><small></small></span><span class="group-count">${g.items.length}</span>`;
      b.querySelector("b").textContent = g.name;
      b.querySelector("small").textContent = g.hint || "";
      b.addEventListener("click", () => showGroup(g));
      li.append(b);
      ul.append(li);
    }
    body.append(rnd, ul);
  }

  function showGroup(g) {
    $("ideasTitle").textContent = g.name;
    $("ideasBack").hidden = false;
    const body = setIdeasView(false);
    const d = today();

    const card = document.createElement("div");
    card.className = "pick";
    const text = document.createElement("p");
    text.className = "pick-text";
    text.textContent = pick(g.items);

    const acts = document.createElement("div");
    acts.className = "pick-actions";
    const other = document.createElement("button");
    other.className = "text-btn";
    other.textContent = "Andere Idee";
    other.addEventListener("click", () => {
      let n;
      do { n = pick(g.items); } while (n === text.textContent && g.items.length > 1);
      text.textContent = n;
      text.classList.remove("swap"); void text.offsetWidth; text.classList.add("swap");
    });
    const go = document.createElement("button");
    go.className = "pill small";
    go.textContent = "Mach ich";
    go.addEventListener("click", () => {
      markIdea(text.textContent, true);
      closeSheet($("ideasSheet"));
      toast("Los geht's. Handy weg und machen.");
    });
    acts.append(other, go);
    card.append(text, acts);

    const label = document.createElement("p");
    label.className = "list-label";
    label.textContent = "Alle Ideen. Tipp an, was du gemacht hast.";

    const ul = document.createElement("ul");
    ul.className = "idea-list";
    for (const it of g.items) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      const done = d.ideas.includes(it);
      b.className = "idea-item" + (done ? " is-done" : "");
      b.setAttribute("aria-pressed", String(done));
      b.innerHTML = '<i class="check" aria-hidden="true"></i><span></span>';
      b.querySelector("span").textContent = it;
      b.addEventListener("click", () => {
        const now = !today().ideas.includes(it);
        markIdea(it, now);
        b.classList.toggle("is-done", now);
        b.setAttribute("aria-pressed", String(now));
      });
      li.append(b);
      ul.append(li);
    }
    body.append(card, label, ul);
  }

  function markIdea(text, on) {
    const d = today();
    const i = d.ideas.indexOf(text);
    if (on && i < 0) d.ideas.push(text);
    if (!on && i >= 0) d.ideas.splice(i, 1);
    save();
    renderStats();
    if (on) bump($("statDone"));
  }

  // ---------- Drang ----------
  let urgeTick = null;
  const ringLen = 2 * Math.PI * 88;

  function startUrge() {
    const total = 10 * 60 * 1000;
    const start = Date.now();
    const end = start + total;
    const fill = $("timerFill");
    fill.style.strokeDasharray = `${ringLen}`;
    $("urgeIdea").textContent = pick(URGE_IDEAS);
    clearInterval(urgeTick);
    const tick = () => {
      const left = Math.max(0, end - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      $("timer").textContent = left > 0 ? `${m}:${String(s).padStart(2, "0")}` : "Geschafft";
      fill.style.strokeDashoffset = `${ringLen * (left / total)}`;
      const cyc = ((Date.now() - start) / 1000) % 10;
      $("breathLabel").textContent = cyc < 4 ? "Einatmen" : cyc < 5 ? "Halten" : "Ausatmen";
      if (left === 0) clearInterval(urgeTick);
    };
    tick();
    urgeTick = setInterval(tick, 250);
    openSheet($("urgeSheet"));
  }

  $("urgeSheet").addEventListener("close", () => clearInterval(urgeTick));

  // ---------- Einstellungen ----------
  function renderEditLists() {
    for (const which of ["morning", "evening"]) {
      const ul = $(which === "morning" ? "editMorning" : "editEvening");
      ul.innerHTML = "";
      for (const it of state.routines[which]) {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = it.text;
        const rm = document.createElement("button");
        rm.className = "remove";
        rm.innerHTML = icon("minus");
        rm.setAttribute("aria-label", `${it.text} entfernen`);
        rm.addEventListener("click", () => {
          state.routines[which] = state.routines[which].filter((x) => x.id !== it.id);
          save();
          renderEditLists();
          renderAll();
        });
        li.append(span, rm);
        ul.append(li);
      }
    }
    $("bedtime").value = state.bedtime;
    $("waketime").value = state.waketime;
  }

  document.querySelectorAll(".add-row").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      state.routines[form.dataset.list].push({ id: uid(), text });
      input.value = "";
      save();
      renderEditLists();
      renderAll();
    });
  });

  for (const id of ["bedtime", "waketime"]) {
    $(id).addEventListener("change", (e) => {
      if (!e.target.value) return;
      state[id] = e.target.value;
      save();
      renderAll();
    });
  }

  $("resetAll").addEventListener("click", () => {
    if (!confirm("Wirklich alles zurücksetzen? Routinen, Haken und Zähler werden gelöscht.")) return;
    state = freshState();
    save();
    renderAll();
    renderEditLists();
    toast("Alles zurückgesetzt");
  });

  // ---------- Events ----------
  $("nextQuote").addEventListener("click", () => renderQuote(true));

  $("focusInput").addEventListener("input", (e) => { today().focus = e.target.value; save(); });
  $("focusInput").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("focusDone").addEventListener("click", () => {
    const d = today();
    if (!d.focus.trim() && !d.focusDone) { $("focusInput").focus(); return; }
    d.focusDone = !d.focusDone;
    save();
    renderFocus();
    renderStats();
    if (d.focusDone) { toast("Erledigt. Genau so geht's."); bump($("statDone")); }
  });

  $("tabMorning").addEventListener("click", () => { tab = "morning"; renderRoutine(); });
  $("tabEvening").addEventListener("click", () => { tab = "evening"; renderRoutine(); });

  $("waterPlus").addEventListener("click", () => {
    const d = today();
    if (d.water >= DROPS) { toast("8 Gläser. Sehr gut."); return; }
    d.water++;
    save();
    renderWater(d.water - 1);
    if (d.water === DROPS) toast("8 Gläser geschafft.");
  });
  $("waterMinus").addEventListener("click", () => {
    const d = today();
    if (d.water <= 0) return;
    d.water--;
    save();
    renderWater();
  });

  $("brickBtn").addEventListener("click", brick);
  $("openIdeas").addEventListener("click", () => { showGroups(); openSheet($("ideasSheet")); });
  $("ideasBack").addEventListener("click", () => showGroups(true));
  $("openUrge").addEventListener("click", startUrge);
  $("urgeOther").addEventListener("click", () => {
    let n;
    do { n = pick(URGE_IDEAS); } while (n === $("urgeIdea").textContent);
    $("urgeIdea").textContent = n;
  });
  $("urgeWon").addEventListener("click", () => {
    state.urgeWins++;
    save();
    closeSheet($("urgeSheet"));
    renderStats();
    bump($("statWaves"));
    toast("Welle überstanden. Das zählt.");
  });
  $("openSettings").addEventListener("click", () => { renderEditLists(); openSheet($("settingsSheet")); });

  // ---------- Start ----------
  function renderAll() {
    renderTop();
    renderClock();
    renderArc();
    renderWater();
    renderQuote();
    renderFocus();
    renderRoutine();
    renderPhoneDown();
    renderStats();
    renderWeek();
  }

  renderAll();
  save();

  // Kurzbefehle können die App mit ?von=brick, ?von=erinnerung oder ?von=drang öffnen.
  const from = new URLSearchParams(location.search).get("von");
  if (from === "brick") setTimeout(() => toast("Brick ist offen. Gute Entscheidung."), 400);
  if (from === "erinnerung") setTimeout(() => toast("Zeit, das Handy wegzulegen."), 400);
  if (from === "drang") startUrge();

  // Uhr jede Sekunde prüfen (rollt nur beim Minutenwechsel), Rest jede Minute.
  let lastDay = dayKey();
  let lastMinute = nowMin();
  const refresh = () => {
    if (dayKey() !== lastDay) { lastDay = dayKey(); quoteIdx = null; }
    renderAll();
  };
  setInterval(() => {
    renderClock();
    if (nowMin() !== lastMinute) { lastMinute = nowMin(); refresh(); }
  }, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
