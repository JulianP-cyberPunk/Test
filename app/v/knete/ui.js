(() => {
  "use strict";
  const T = window.Tag;
  const $ = (id) => document.getElementById(id);
  const ICON = (n) => `<svg class="ic" aria-hidden="true"><use href="../../icons.svg#i-${n}"/></svg>`;
  const COLORS = ["#f5a524", "#ef6c4a", "#34c38f", "#a48cf0", "#4c9bf0", "#f47c8a", "#2bb5b0", "#e3b23c", "#8a6cf0"];

  // ---------- XP ----------
  const xpOfDay = (d) => d ? ((d.morning || []).length + (d.evening || []).length) * 10 + (d.ideas || []).length * 15 + (d.focusDone ? 25 : 0) + (d.water || 0) * 5 + (d.bricked ? 30 : 0) : 0;
  const totalXp = () => Object.values(T.state.days).reduce((n, d) => n + xpOfDay(d), 0) + T.state.urgeWins * 20;

  function levelOf(xp) {
    let lvl = 1, need = 100, floor = 0;
    while (xp >= floor + need) { floor += need; lvl++; need = 100 * lvl; }
    return { lvl, into: xp - floor, need };
  }

  let lastXp = null;
  function renderLevel() {
    const xp = totalXp();
    const { lvl, into, need } = levelOf(xp);
    $("lvlNum").textContent = lvl;
    $("lvlNum2").textContent = lvl;
    $("lvlSub").textContent = `Noch ${need - into} XP bis Level ${lvl + 1}`;
    $("xpBar").style.width = `${(into / need) * 100}%`;
    const today = xpOfDay(T.today());
    $("xpToday").textContent = today;
    if (lastXp !== null && xp > lastXp) {
      T.restart($("xpToday"), "pop");
      if (levelOf(lastXp).lvl < lvl) T.toast(`Level ${lvl}! Stark.`);
    }
    lastXp = xp;
  }

  // ---------- Kopf ----------
  function renderTop() {
    $("hello").textContent = T.greeting();
    $("nudge").textContent = T.nudge();
    const n = new Date();
    $("dateWd").textContent = n.toLocaleDateString("de-AT", { weekday: "long" });
    $("dateNum").textContent = n.getDate();
    $("dateMo").textContent = `${n.toLocaleDateString("de-AT", { month: "long" })}, KW ${T.isoWeek(n)}`;
    const b = T.bedtimeText();
    $("bedInfo").textContent = b.text;
    $("brick").classList.toggle("urgent", b.urgent);
  }

  // ---------- Wasser ----------
  function renderWater() {
    const w = T.today().water;
    $("waterNum").textContent = w;
    $("glassFill").style.height = `${(w / 8) * 100}%`;
    document.querySelector(".glass").classList.toggle("full", w >= 4);
  }
  $("waterPlus").addEventListener("click", () => { const w = T.water(1); renderWater(); renderLevel(); if (w === 8) T.toast("8 Gläser! +40 XP"); });
  $("waterMinus").addEventListener("click", () => { T.water(-1); renderWater(); renderLevel(); });

  // ---------- Würfel ----------
  let rolled = null;
  function roll() {
    const g = T.pick(IDEA_GROUPS);
    const text = rolled && rolled.g === g ? T.pickOther(g.items, rolled.text) : T.pick(g.items);
    rolled = { g, text };
    T.restart($("dice"), "roll");
    setTimeout(() => {
      $("diceResult").hidden = false;
      $("drGroup").textContent = g.name;
      $("drText").textContent = text;
      T.restart($("diceResult"), "dice-result");
    }, 420);
  }
  $("dice").addEventListener("click", roll);
  $("drAgain").addEventListener("click", roll);
  $("drGo").addEventListener("click", () => {
    if (!rolled) return;
    T.markIdea(rolled.text, true);
    renderLevel();
    renderWeek();
    T.toast("+15 XP. Handy weg und los!");
  });

  function renderBoxes() {
    const box = $("boxes");
    IDEA_GROUPS.forEach((g, i) => {
      const b = T.el("button", "box");
      b.style.setProperty("--c", COLORS[i % COLORS.length]);
      b.innerHTML = `${ICON(g.icon)}<b></b>`;
      b.querySelector("b").textContent = g.name;
      b.addEventListener("click", () => openBox(g));
      box.append(b);
    });
  }

  function openBox(g) {
    $("boxTitle").textContent = g.name;
    const ul = $("boxList");
    ul.innerHTML = "";
    for (const it of g.items) {
      const li = T.el("li");
      const b = T.el("button");
      const on = T.ideaDone(it);
      b.setAttribute("aria-pressed", String(on));
      b.innerHTML = '<i class="tick" aria-hidden="true"></i><span></span>';
      b.querySelector("span").textContent = it;
      b.addEventListener("click", () => {
        const now = !T.ideaDone(it);
        T.markIdea(it, now);
        b.setAttribute("aria-pressed", String(now));
        renderLevel();
        renderWeek();
      });
      li.append(b);
      ul.append(li);
    }
    T.openSheet($("boxSheet"));
  }

  // ---------- Routine ----------
  let tab = T.defaultTab();
  function renderRoutine() {
    $("tM").setAttribute("aria-selected", String(tab === "morning"));
    $("tE").setAttribute("aria-selected", String(tab === "evening"));
    const d = T.today();
    const ul = $("todo");
    ul.innerHTML = "";
    for (const it of T.state.routines[tab]) {
      const li = T.el("li");
      const b = T.el("button");
      b.setAttribute("aria-pressed", String(d[tab].includes(it.id)));
      b.innerHTML = '<i class="tick" aria-hidden="true"></i><span></span><em class="xp-tag">+10</em>';
      b.querySelector("span").textContent = it.text;
      b.addEventListener("click", () => {
        const r = T.toggleRoutine(tab, it.id);
        renderRoutine();
        renderLevel();
        renderWeek();
        if (r.on && r.complete) T.toast(tab === "morning" ? "Morgen geschafft! Starker Start." : "Abend geschafft! Schlaf gut.");
      });
      li.append(b);
      ul.append(li);
    }
  }
  $("tM").addEventListener("click", () => { tab = "morning"; renderRoutine(); });
  $("tE").addEventListener("click", () => { tab = "evening"; renderRoutine(); });

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
    const on = T.toggleFocus();
    renderFocus();
    renderLevel();
    renderWeek();
    if (on) T.toast("+25 XP. Genau so!");
  });

  // ---------- Spruch ----------
  let q = T.quoteOfDay();
  function renderQuote() {
    $("qText").textContent = `„${q.t}“`;
    $("qBy").textContent = q.a || "";
  }
  $("qNext").addEventListener("click", () => { q = T.otherQuote(q); renderQuote(); T.restart($("qText"), "swap"); });

  // ---------- Handy weg, Drang ----------
  $("brick").addEventListener("click", () => {
    const first = T.brick();
    renderLevel();
    T.toast(first ? "+30 XP. Handy weg, Leben an!" : "Heute schon gemacht. Weiter so!");
  });

  let stop = null;
  $("urge").addEventListener("click", () => {
    $("uIdea").textContent = T.pick(URGE_IDEAS);
    stop && stop();
    stop = T.urgeTimer(({ label, breath }) => { $("uTime").textContent = label; $("uBreath").textContent = breath; });
    T.openSheet($("urgeSheet"));
  });
  $("urgeSheet").addEventListener("close", () => stop && stop());
  $("uOther").addEventListener("click", () => { $("uIdea").textContent = T.pickOther(URGE_IDEAS, $("uIdea").textContent); });
  $("uWon").addEventListener("click", () => { T.urgeWin(); T.closeSheet($("urgeSheet")); renderLevel(); T.toast("+20 XP. Welle geritten!"); });

  // ---------- Woche ----------
  function renderWeek() {
    const ol = $("wk");
    ol.innerHTML = "";
    for (const d of T.week()) {
      const li = T.el("li", d.isToday ? "today" : "");
      const cls = d.m && d.e ? "full" : d.m || d.e ? "half" : "";
      li.innerHTML = `<span>${d.short}</span><span class="ball ${cls}">${d.done || ""}</span>`;
      li.setAttribute("aria-label", `${d.short}: ${d.done} Sachen gemacht`);
      ol.append(li);
    }
  }

  // ---------- Start ----------
  function renderAll() { renderTop(); renderWater(); renderRoutine(); renderFocus(); renderQuote(); renderLevel(); renderWeek(); }
  T.wireSheets();
  T.rollingClock([...document.querySelectorAll(".clock .d")], $("clock"));
  renderBoxes();
  renderAll();
  T.save();
  T.everyMinute(renderAll);
})();
