(() => {
  "use strict";

  const KEY = "tag.v1";
  const $ = (id) => document.getElementById(id);

  // ---------- Speicher ----------
  const uid = () => Math.random().toString(36).slice(2, 9);

  function freshState() {
    return {
      routines: {
        morning: DEFAULT_ROUTINES.morning.map((text) => ({ id: uid(), text })),
        evening: DEFAULT_ROUTINES.evening.map((text) => ({ id: uid(), text })),
      },
      bedtime: "00:30",
      days: {},
      urgeWins: 0,
      brickCount: 0,
    };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.routines) return s;
    } catch (e) { /* kaputter Speicher: neu anfangen */ }
    return freshState();
  }

  let state = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  // ---------- Zeit ----------
  // Ein "Tag" geht bis 5 Uhr früh, damit die Abendroutine nach Mitternacht noch zählt.
  function dayKey(d = new Date()) {
    const x = new Date(d.getTime() - 5 * 3600 * 1000);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }

  function today() {
    const k = dayKey();
    if (!state.days[k]) state.days[k] = { morning: [], evening: [], focus: "", focusDone: false, bricked: false };
    return state.days[k];
  }

  function phase(h = new Date().getHours()) {
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 17) return "day";
    if (h >= 17 && h < 22) return "evening";
    return "night";
  }

  const GREETING = { morning: "Guten Morgen", day: "Hallo", evening: "Guten Abend", night: "Zeit zu schlafen" };
  const THEME = { morning: "#bfd8ec", day: "#cfe3f2", evening: "#34426f", night: "#0e1530" };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function dayIndex() {
    const [y, m, d] = dayKey().split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
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

  // ---------- Kopf, Spruch ----------
  function renderTop() {
    const p = phase();
    document.documentElement.dataset.phase = p;
    document.querySelector('meta[name="theme-color"]').setAttribute("content", THEME[p]);
    $("greeting").textContent = GREETING[p];
    $("date").textContent = new Date().toLocaleDateString("de-AT", { weekday: "long", day: "numeric", month: "long" });
    $("nudge").textContent = NUDGES[p][dayIndex() % NUDGES[p].length];
  }

  let quoteIdx = null;
  function renderQuote(random = false) {
    if (random) {
      let i;
      do { i = Math.floor(Math.random() * QUOTES.length); } while (i === quoteIdx && QUOTES.length > 1);
      quoteIdx = i;
    } else if (quoteIdx === null) {
      quoteIdx = dayIndex() % QUOTES.length;
    }
    const q = QUOTES[quoteIdx];
    $("quoteText").textContent = q.t;
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
    return items.length > 0 && day && items.every((it) => day[which].includes(it.id));
  }

  function streak(which) {
    let n = 0;
    const d = new Date();
    // Heute zählt mit, wenn erledigt. Wenn noch nicht, ab gestern zählen.
    if (!isComplete(state.days[dayKey(d)], which)) d.setDate(d.getDate() - 1);
    while (isComplete(state.days[dayKey(d)], which)) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function renderRoutine() {
    $("tabMorning").setAttribute("aria-selected", String(tab === "morning"));
    $("tabEvening").setAttribute("aria-selected", String(tab === "evening"));

    const d = today();
    const list = $("routineList");
    list.innerHTML = "";
    for (const it of state.routines[tab]) {
      const done = d[tab].includes(it.id);
      const li = document.createElement("li");
      li.className = done ? "is-done" : "";
      const row = document.createElement("button");
      row.className = "row";
      row.setAttribute("aria-pressed", String(done));
      row.addEventListener("click", () => toggleRoutine(it.id));
      const mark = document.createElement("i");
      mark.className = "check";
      mark.setAttribute("aria-pressed", String(done));
      mark.setAttribute("aria-hidden", "true");
      const span = document.createElement("span");
      span.textContent = it.text;
      row.append(mark, span);
      li.append(row);
      list.append(li);
    }

    const complete = isComplete(d, tab);
    $("routineDone").hidden = !complete;
    const s = streak(tab);
    $("streak").textContent = s > 0 ? `🔥 ${s} ${s === 1 ? "Tag" : "Tage"}` : "";
  }

  function toggleRoutine(id) {
    const d = today();
    const arr = d[tab];
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    const nowComplete = isComplete(d, tab);
    save();
    renderRoutine();
    if (i < 0 && nowComplete) toast(tab === "morning" ? "Morgenroutine geschafft. Starker Start." : "Abendroutine geschafft. Schlaf gut.");
  }

  // ---------- Handy weg / Brick ----------
  function minutesUntilBedtime() {
    const [bh, bm] = state.bedtime.split(":").map(Number);
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    let bed = bh * 60 + bm;
    // Alles zwischen 5 Uhr und Schlafenszeit liegt "davor".
    const shift = (m) => (m - 5 * 60 + 1440) % 1440;
    return shift(bed) - shift(mins);
  }

  function renderPhoneDown() {
    const d = today();
    const left = minutesUntilBedtime();
    const box = $("phoneDown");
    let info;
    if (left <= 0) info = "Handy-weg-Zeit ist vorbei. Leg es jetzt weg.";
    else if (left <= 60) info = `Noch ${left} Min. bis Handy weg`;
    else info = `Handy weg um ${state.bedtime} Uhr`;
    $("bedtimeInfo").textContent = info;
    box.classList.toggle("urgent", left <= 60);
    $("brickSub").textContent = d.bricked ? "Heute schon gemacht ✓" : "Brick drauf und los";
  }

  function brick() {
    const d = today();
    if (!d.bricked) {
      d.bricked = true;
      state.brickCount++;
      save();
    }
    const p = phase();
    toast(p === "night" || p === "evening" ? "Stark. Handy weg, gute Nacht." : "Stark. Handy weg, Leben an.");
    renderPhoneDown();
    renderTally();
  }

  function renderTally() {
    const parts = [];
    if (state.urgeWins) parts.push(`${state.urgeWins} ${state.urgeWins === 1 ? "Welle" : "Wellen"} überstanden`);
    if (state.brickCount) parts.push(`${state.brickCount} Mal Handy weggelegt`);
    $("tally").textContent = parts.join(", ");
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
  function showGroups() {
    $("ideasTitle").textContent = "Was mach ich jetzt?";
    $("ideasBack").hidden = true;
    const body = $("ideasBody");
    body.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "groups";
    for (const g of IDEA_GROUPS) {
      const b = document.createElement("button");
      b.className = "group-btn";
      b.innerHTML = `<span class="emoji" aria-hidden="true">${g.emoji}</span><span class="name"></span><span class="count">${g.items.length} Ideen</span>`;
      b.querySelector(".name").textContent = g.name;
      b.addEventListener("click", () => showGroup(g));
      grid.append(b);
    }
    const rnd = document.createElement("button");
    rnd.className = "pill random";
    rnd.textContent = "Überrasch mich";
    rnd.addEventListener("click", () => {
      const g = pick(IDEA_GROUPS);
      showGroup(g);
    });
    body.append(grid, rnd);
  }

  function showGroup(g) {
    $("ideasTitle").textContent = `${g.emoji} ${g.name}`;
    $("ideasBack").hidden = false;
    const body = $("ideasBody");
    body.innerHTML = "";

    const pickEl = document.createElement("p");
    pickEl.className = "pick";
    pickEl.textContent = pick(g.items);

    const other = document.createElement("button");
    other.className = "text-btn";
    other.textContent = "Andere Idee";
    other.addEventListener("click", () => {
      let n;
      do { n = pick(g.items); } while (n === pickEl.textContent && g.items.length > 1);
      pickEl.textContent = n;
    });

    const ul = document.createElement("ul");
    ul.className = "idea-list";
    for (const it of g.items) {
      const li = document.createElement("li");
      li.textContent = it;
      ul.append(li);
    }

    body.append(pickEl, other, ul);
    $("ideasSheet").querySelector(".sheet-inner").scrollTop = 0;
  }

  // ---------- Drang ----------
  let urgeEnd = 0;
  let urgeTick = null;

  function startUrge() {
    urgeEnd = Date.now() + 10 * 60 * 1000;
    const start = Date.now();
    $("urgeIdea").textContent = pick(URGE_IDEAS);
    clearInterval(urgeTick);
    const tick = () => {
      const left = Math.max(0, urgeEnd - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      $("timer").textContent = left > 0 ? `${m}:${String(s).padStart(2, "0")}` : "Geschafft";
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
        rm.textContent = "×";
        rm.setAttribute("aria-label", `${it.text} entfernen`);
        rm.addEventListener("click", () => {
          state.routines[which] = state.routines[which].filter((x) => x.id !== it.id);
          save();
          renderEditLists();
          renderRoutine();
        });
        li.append(span, rm);
        ul.append(li);
      }
    }
    $("bedtime").value = state.bedtime;
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
      renderRoutine();
    });
  });

  $("bedtime").addEventListener("change", (e) => {
    if (!e.target.value) return;
    state.bedtime = e.target.value;
    save();
    renderPhoneDown();
  });

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

  $("focusInput").addEventListener("input", (e) => {
    today().focus = e.target.value;
    save();
  });
  $("focusInput").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("focusDone").addEventListener("click", () => {
    const d = today();
    if (!d.focus.trim() && !d.focusDone) { $("focusInput").focus(); return; }
    d.focusDone = !d.focusDone;
    save();
    renderFocus();
    if (d.focusDone) toast("Erledigt. Genau so geht's.");
  });

  $("tabMorning").addEventListener("click", () => { tab = "morning"; renderRoutine(); });
  $("tabEvening").addEventListener("click", () => { tab = "evening"; renderRoutine(); });

  $("brickBtn").addEventListener("click", brick);
  $("openIdeas").addEventListener("click", () => { showGroups(); openSheet($("ideasSheet")); });
  $("ideasBack").addEventListener("click", showGroups);
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
    renderTally();
    toast("Welle überstanden. Das zählt.");
  });
  $("openSettings").addEventListener("click", () => { renderEditLists(); openSheet($("settingsSheet")); });

  // ---------- Start ----------
  function renderAll() {
    renderTop();
    renderQuote();
    renderFocus();
    renderRoutine();
    renderPhoneDown();
    renderTally();
  }

  renderAll();
  save();

  // Kurzbefehle können die App mit ?von=brick oder ?von=erinnerung öffnen.
  const from = new URLSearchParams(location.search).get("von");
  if (from === "brick") setTimeout(() => toast("Brick ist offen. Gute Entscheidung."), 400);
  if (from === "erinnerung") setTimeout(() => toast("Zeit, das Handy wegzulegen."), 400);
  if (from === "drang") startUrge();

  // Bei Rückkehr in die App und jede Minute aktualisieren.
  let lastDay = dayKey();
  const refresh = () => {
    if (dayKey() !== lastDay) { lastDay = dayKey(); quoteIdx = null; }
    renderAll();
  };
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  setInterval(refresh, 60 * 1000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
