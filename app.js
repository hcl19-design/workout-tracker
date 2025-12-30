// ===== Schedule (renders cards into #scheduleList) =====
function renderSchedule(){
  const wrap = document.getElementById("scheduleList");
  if(!wrap) return;

  wrap.innerHTML = "";

  Object.keys(TEMPLATES).forEach((dayName) => {
    const tpl = TEMPLATES[dayName];

    const card = document.createElement("div");
    card.className = "tcard";

    const preview = (tpl.plan || [])
      .slice(0, 4)
      .map(p => `• ${p.ex} (${p.sets}×${p.reps})`)
      .join("<br>");

    card.innerHTML = `
      <div class="kpi"><b>${dayName}</b></div>
      <div class="muted small" style="margin-top:4px;">${tpl.meta || ""}</div>
      <div class="muted small" style="margin-top:8px; line-height:1.35;">
        ${preview}${(tpl.plan||[]).length>4 ? "<br>…" : ""}
      </div>
      <div class="row" style="margin-top:10px; gap:8px;">
        <button class="btn" data-action="start">Start this day</button>
        <button class="btn ghost" data-action="view">View</button>
      </div>
    `;

    card.querySelector('[data-action="start"]').addEventListener("click", ()=>{
      loadTemplate(dayName);
      window.scrollTo({top:0, behavior:"smooth"});
      toast(`Started: ${dayName}`);
    });

    card.querySelector('[data-action="view"]').addEventListener("click", ()=>{
      switchTab("templates");
      setTimeout(()=>{
        document.getElementById("dayPlans")?.scrollIntoView({behavior:"smooth", block:"start"});
      }, 50);
    });

    wrap.appendChild(card);
  });

  if(wrap.children.length === 0){
    wrap.innerHTML = `<div class="muted small">No schedule templates found.</div>`;
  }
}

// ===== Boot =====
function boot(){
  wireUI();
  renderExerciseDatalist();
  renderHistory();
  renderPRs();
  renderStats();
  renderAllDayPlans();   // Templates tab (Day 1–4 full view)
  renderSchedule();      // Schedule tab (Day 1–4 cards)
  registerSW();
}
boot();