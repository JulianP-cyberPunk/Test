(() => {
  "use strict";
  const T = window.Tag;
  const $ = (id) => document.getElementById(id);

  // ---------- Kopf, Datum, Restzeit ----------
  function renderTop() {
    $("hello").textContent = T.greeting();
    $("nudge").textContent = T.nudge();
    const n = new Date();
    $("wd").textContent = n.toLocaleDateString("de-AT", { weekday: "long" });
    $("day").textContent = String(n.getDate()).padStart(2, "0");
    $("mo").textContent = `${n.toLocaleDateString("de-AT", { month: "long" })}, KW ${T.isoWeek(n)}`;

    const p = T.dayProgress();
    if (p.afterBed) { $("leftH").textContent = "0"; $("leftSub").textContent = "Schlafenszeit"; }
    else if (p.beforeWake) { $("leftH").innerHTML = `${Math.floor(p.untilWake / 60)}<small>h</small>`; $("leftSub").textContent = "bis zum Aufstehen"; }
    else { $("leftH").innerHTML = `${Math.floor(p.untilBed / 60)}<small>h ${String(p.untilBed % 60).padStart(2, "0")}</small>`; $("leftSub").textContent = `bis ${T.state.bedtime} Uhr`; }

    const b = T.bedtimeText();
    $("bedInfo").textContent = b.text;
    $("brick").classList.toggle("urgent", b.urgent);
  }

  // ---------- Lineal ----------
  let ticksFor = "";
  function renderRuler() {
    const p = T.dayProgress();
    $("rulerFill").style.width = `${p.f * 100}%`;
    $("rulerMark").style.left = `calc(${p.f * 100}% - 1px)`;
    $("rulerPct").textContent = `${Math.round(p.f * 100)} %`;
    $("rWake").textContent = T.state.waketime;
    $("rBed").textContent = T.state.bedtime;
    const sig = T.state.waketime + T.state.bedtime;
    if (sig === ticksFor) return;
    ticksFor = sig;
    const box = $("rulerTicks");
    box.innerHTML = "";
    const span = p.bed - p.wake;
    for (let m = Math.ceil(p.wake / 60) * 60; m < p.bed; m += 60) {
      const x = ((m - p.wake) / span) * 100;
      const hour = ((m + 300) / 60) % 24;
      const i = T.el("i", hour % 3 === 0 ? "major" : "");
      i.style.left = `${x}%`;
      box.append(i);
      if (hour % 3 === 0 && x > 4 && x < 96) { const e = T.el("em", null, String(hour)); e.style.left = `${x}%`; box.append(e); }
    }
  }

  // ---------- Kleine Kacheln ----------
  function renderSmall() {
    const d = T.today();
    $("water").textContent = d.water;
    const bars = $("waterBars");
    if (!bars.children.length) for (let i = 0; i < 8; i++) bars.append(T.el("i"));
    [...bars.children].forEach((b, i) => b.classList.toggle("on", i < d.water));
    const s = T.streak();
    $("streak").textContent = s;
    $("streakSub").textContent = s === 1 ? "Tag" : "Tage";
    $("done").textContent = T.doneToday();
  }
  $("waterPlus").addEventListener("click", () => { if (T.water(1) === 8) T.toast("8 von 8."); renderSmall(); T.restart($("waterPlus"), "bump"); });
  $("waterMinus").addEventListener("click", () => { T.water(-1); renderSmall(); });

  // ---------- Fokus ----------
  function renderFocus() {
    const d = T.today();
    if (document.activeElement !== $("focus")) $("focus").value = d.focus;
    $("focusDone").setAttribute("aria-pressed", String(d.focusDone));
  }
  $("focus").addEventListener("input", (e) => T.setFocus(e.target.value));
  $("focus").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("focusDone").addEventListener("click", () => {
    if (!T.today().focus.trim() && !T.today().focusDone) { $("focus").focus(); return; }
    if (T.toggleFocus()) T.toast("Erledigt.");
    renderFocus(); renderSmall(); renderWeek();
  });

  // ---------- Routine ----------
  let tab = T.defaultTab();
  function renderRoutine() {
    $("tM").setAttribute("aria-selected", String(tab === "morning"));
    $("tE").setAttribute("aria-selected", String(tab === "evening"));
    const d = T.today();
    const items = T.state.routines[tab];
    $("rCount").textContent = `${items.filter((x) => d[tab].includes(x.id)).length}/${items.length}`;
    const ul = $("list");
    ul.innerHTML = "";
    for (const it of items) {
      const li = T.el("li");
      const b = T.el("button");
      b.setAttribute("aria-pressed", String(d[tab].includes(it.id)));
      b.innerHTML = '<i class="box" aria-hidden="true"></i><span></span>';
      b.querySelector("span").textContent = it.text;
      b.addEventListener("click", () => {
        const r = T.toggleRoutine(tab, it.id);
        renderRoutine(); renderSmall(); renderWeek();
        if (r.on && r.complete) T.toast(tab === "morning" ? "Morgenroutine komplett." : "Abendroutine komplett.");
      });
      li.append(b);
      ul.append(li);
    }
  }
  $("tM").addEventListener("click", () => { tab = "morning"; renderRoutine(); });
  $("tE").addEventListener("click", () => { tab = "evening"; renderRoutine(); });

  // ---------- Ideen inline ----------
  let group = IDEA_GROUPS[0];
  let idea = "";
  function renderCats() {
    const box = $("cats");
    box.innerHTML = "";
    for (const g of IDEA_GROUPS) {
      const b = T.el("button", "cat");
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(g === group));
      b.innerHTML = `<svg class="ic" aria-hidden="true"><use href="../../icons.svg#i-${g.icon}"/></svg><span></span>`;
      b.querySelector("span").textContent = g.name;
      b.addEventListener("click", () => setGroup(g));
      box.append(b);
    }
  }
  function setGroup(g, scroll = false) {
    group = g;
    idea = T.pick(g.items);
    renderCats();
    renderIdea();
    renderIdeaList();
    if (scroll) $("cats").children[IDEA_GROUPS.indexOf(g)].scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" });
  }
  function renderIdea() { $("ideaText").textContent = idea; T.restart($("ideaText"), "swap"); }
  function renderIdeaList() {
    const ul = $("ideaList");
    ul.innerHTML = "";
    for (const it of group.items) {
      const li = T.el("li");
      const b = T.el("button");
      b.setAttribute("aria-pressed", String(T.ideaDone(it)));
      b.innerHTML = '<i class="box" aria-hidden="true"></i><span></span>';
      b.querySelector("span").textContent = it;
      b.addEventListener("click", () => { const on = !T.ideaDone(it); T.markIdea(it, on); b.setAttribute("aria-pressed", String(on)); renderSmall(); renderWeek(); });
      li.append(b);
      ul.append(li);
    }
  }
  $("ideaNext").addEventListener("click", () => { idea = T.pickOther(group.items, idea); renderIdea(); });
  $("shuffle").addEventListener("click", () => setGroup(T.pick(IDEA_GROUPS), true));
  $("ideaGo").addEventListener("click", () => { T.markIdea(idea, true); renderSmall(); renderWeek(); renderIdeaList(); T.restart($("done"), "bump"); T.toast("Los. Handy weg."); });

  // ---------- Handy weg, Drang ----------
  $("brick").addEventListener("click", () => { T.brick(); T.toast("Handy weg. Gut so."); });
  let stop = null;
  $("urge").addEventListener("click", () => {
    $("uIdea").textContent = T.pick(URGE_IDEAS);
    stop && stop();
    stop = T.urgeTimer(({ label, frac, breath }) => {
      $("uTime").textContent = label;
      $("uLine").style.transform = `scaleX(${frac})`;
      $("uBreath").textContent = breath;
    });
    T.openSheet($("urgeSheet"));
  });
  $("urgeSheet").addEventListener("close", () => stop && stop());
  $("uOther").addEventListener("click", () => { $("uIdea").textContent = T.pickOther(URGE_IDEAS, $("uIdea").textContent); });
  $("uWon").addEventListener("click", () => { T.urgeWin(); T.closeSheet($("urgeSheet")); T.toast("Welle überstanden."); });

  // ---------- Spruch ----------
  let q = T.quoteOfDay();
  const renderQuote = () => { $("q").textContent = `„${q.t}“`; $("qBy").textContent = q.a || ""; };
  $("qNext").addEventListener("click", () => { q = T.otherQuote(q); renderQuote(); T.restart($("q"), "swap"); });

  // ---------- Woche ----------
  function renderWeek() {
    const days = T.week();
    const max = Math.max(6, ...days.map((d) => d.done));
    const ol = $("week");
    ol.innerHTML = "";
    let sum = 0;
    for (const d of days) {
      sum += d.done;
      const li = T.el("li", d.isToday ? "today" : "");
      const bar = T.el("span", "bar" + (d.m && d.e ? " me" : d.m || d.e ? " m" : ""));
      bar.style.height = `${Math.max(4, (d.done / max) * 82)}px`;
      li.append(bar, T.el("span", null, d.short));
      li.setAttribute("aria-label", `${d.short}: ${d.done} erledigt`);
      ol.append(li);
    }
    $("weekSum").textContent = `${sum} erledigt`;
  }

  // ---------- Start ----------
  function renderAll() { renderTop(); renderRuler(); renderSmall(); renderFocus(); renderRoutine(); renderQuote(); renderWeek(); }
  T.wireSheets();
  T.rollingClock([...document.querySelectorAll(".clock .d")], $("clock"));
  setGroup(IDEA_GROUPS[0]);
  renderAll();
  T.save();
  T.everyMinute(renderAll);
})();
