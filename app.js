/* Workout Tracker PWA (offline) - localStorage only */
const LS_KEY = "wt_workouts_v1";
const LS_EX  = "wt_exercises_v1";

const $ = (id) => document.getElementById(id);

function kgToLb(kg){ return Math.round(Number(kg || 0) * 2.2046226218); }
function fmtLoadKg(kg){
  const n = Number(kg || 0);
  return `${n} kg (${kgToLb(n)} lb)`;
}

// ===== Toast (small message, auto hides) =====
let toastTimer = null;
function toast(msg){
  const sub = $("subtitle");
  if(!sub) return;
  sub.textContent = msg;
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> {
    // revert only if not in session
    if(!session) sub.textContent = "Ready";
  }, 1600);
}

// ===== Modal control (FIX for stuck popup) =====
const modal = $("modal");

function openModalSheet(){
  if(!modal) return;
  modal.classList.add("show");
  modal.removeAttribute("hidden");
  modal.hidden = false; // belt + suspenders for iOS
}

function closeModalSheet(){
  if(!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("hidden", "");
  modal.hidden = true;
}

// Ensure modal is hidden on first load (iOS Safari safety)
document.addEventListener("DOMContentLoaded", () => {
  if(!modal) return;
  closeModalSheet();
});

// User templates (auto-adjusted, lumbar-tolerant)
const TEMPLATES = {
  "Day 1 – Lower Body (Back-Safe Hypertrophy)": {
    meta: "Leg press + hams + abductors + calves + Zone 2",
    plan: [
      {ex:"45° Leg Press (feet high, short ROM)", sets:3, reps:"10–12", rpe:"6–6.5"},
      {ex:"Seated Hamstring Curl", sets:3, reps:"10–14", rpe:"7"},
      {ex:"Hip Abduction Machine", sets:3, reps:"12–15", rpe:"7–8"},
      {ex:"Seated Calf Raise", sets:3, reps:"10–15", rpe:"8"},
      {ex:"Incline treadmill walk (Zone 2)", sets:1, reps:"5 min", rpe:"easy"}
    ]
  },
  "Day 2 – Upper Push (Shoulder-Friendly)": {
    meta: "Machine press + incline DB + laterals + fly + triceps",
    plan: [
      {ex:"Machine Chest Press (neutral grip)", sets:4, reps:"8–12", rpe:"7–8"},
      {ex:"Low-Incline DB Press (bench supported)", sets:3, reps:"8–10", rpe:"7"},
      {ex:"Cable Lateral Raise (scapular plane)", sets:3, reps:"12–15", rpe:"8"},
      {ex:"Pec Deck or Cable Fly (mid-range only)", sets:3, reps:"12–15", rpe:"7–8"},
      {ex:"Rope Triceps Pressdown", sets:3, reps:"10–14", rpe:"8"}
    ]
  },
  "Day 3 – Upper Pull (Zero Lower-Back Load)": {
    meta: "Chest-supported rows + pulldown + rear delts + curls",
    plan: [
      {ex:"Chest-Supported Machine Row", sets:4, reps:"8–12", rpe:"7–8"},
      {ex:"Neutral-Grip Lat Pulldown", sets:3, reps:"8–12", rpe:"7"},
      {ex:"Single-Arm Machine Row (supported)", sets:3, reps:"10–12", rpe:"8"},
      {ex:"Reverse Pec Deck (rear delts)", sets:3, reps:"12–15", rpe:"8"},
      {ex:"EZ-Bar or Machine Curl", sets:3, reps:"8–12", rpe:"8"},
      {ex:"Bike or elliptical (moderate)", sets:1, reps:"6–8 min", rpe:"easy–moderate"}
    ]
  },
  "Day 4 – Glutes + Core + Conditioning (Lumbar-Recovery Bias)": {
    meta: "Hip thrust + kickbacks + dead bug + Pallof + intervals",
    plan: [
      {ex:"Hip Thrust Machine", sets:3, reps:"10–12", rpe:"6–6.5"},
      {ex:"Cable or Machine Glute Kickback", sets:3, reps:"12–15", rpe:"7–8"},
      {ex:"Dead Bug", sets:2, reps:"8–10/side", rpe:"controlled"},
      {ex:"Pallof Press", sets:2, reps:"10–12/side", rpe:"controlled"},
      {ex:"Bike / sled / incline treadmill", sets:1, reps:"8 min (40s on / 60s easy)", rpe:"7"}
    ]
  }
};

const FULL_PLAN_TEXT = `Auto-Adjusted Weekly Workout (kg, with lb in parentheses)

Day 1 – Lower Body (Back-Safe Hypertrophy)
1) 45° Leg Press (feet high, short ROM) — 3 sets | 10–12 reps | RPE 6–6.5
2) Seated Hamstring Curl — 3 sets | 10–14 reps | RPE 7
3) Hip Abduction Machine — 3 sets | 12–15 reps | RPE 7–8
4) Seated Calf Raise — 3 sets | 10–15 reps | RPE 8
Finish: Incline treadmill walk — 5 min (Zone 2)

Day 2 – Upper Push (Shoulder-Friendly)
1) Machine Chest Press (neutral grip) — 4 sets | 8–12 reps | RPE 7–8
2) Low-Incline DB Press (bench supported) — 3 sets | 8–10 reps | RPE 7
3) Cable Lateral Raise (scapular plane) — 3 sets | 12–15 reps | RPE 8
4) Pec Deck or Cable Fly (mid-range only) — 3 sets | 12–15 reps | RPE 7–8
5) Rope Triceps Pressdown — 3 sets | 10–14 reps | RPE 8

Day 3 – Upper Pull (Zero Lower-Back Load)
1) Chest-Supported Machine Row — 4 sets | 8–12 reps | RPE 7–8
2) Neutral-Grip Lat Pulldown — 3 sets | 8–12 reps | RPE 7
3) Single-Arm Machine Row (supported) — 3 sets | 10–12 reps | RPE 8
4) Reverse Pec Deck (rear delts) — 3 sets | 12–15 reps | RPE 8
5) EZ-Bar or Machine Curl — 3 sets | 8–12 reps | RPE 8
Finish: Bike or elliptical — 6–8 min (moderate)

Day 4 – Glutes + Core + Conditioning (Lumbar-Recovery Bias)
1) Hip Thrust Machine — 3 sets | 10–12 reps | RPE 6–6.5
2) Cable or Machine Glute Kickback — 3 sets | 12–15 reps | RPE 7–8
Core: Dead Bug — 2 sets | 8–10/side; Pallof Press — 2 sets | 10–12/side
Conditioning: 8 min total — 40s work / 60s easy — RPE 7
`;

let session = null;        // {id, startedAt, endedAt, sets:[], templateName?, plan?, planStrength?, planIndex?}
let undoStack = [];        // store last removed set

function nowISO(){ return new Date().toISOString(); }
function fmtDateTime(iso){
  const d = new Date(iso);
  return d.toLocaleString(undefined, {year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {year:"numeric",month:"short",day:"2-digit"});
}

function loadWorkouts(){
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function saveWorkouts(workouts){
  localStorage.setItem(LS_KEY, JSON.stringify(workouts));
}
function loadExercises(){
  try { return JSON.parse(localStorage.getItem(LS_EX)) || []; }
  catch { return []; }
}
function saveExercises(exs){
  localStorage.setItem(LS_EX, JSON.stringify(exs));
}

function startSession(){
  session = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    startedAt: nowISO(),
    endedAt: null,
    sets: []
  };
  undoStack = [];
  $("btnStart").disabled = true;
  $("btnEnd").disabled = false;
  $("btnAddSet").disabled = false;
  $("btnQuick").disabled = false;
  $("btnClearFields").disabled = false;
  $("btnUndo").disabled = true;
  $("sessionMeta").textContent = `Started ${fmtDateTime(session.startedAt)}`;
  $("subtitle").textContent = "Workout in progress";
  renderLog();
  renderHistory();
}

function endSession(){
  if(!session) return;
  if(session.sets.length === 0){
    alert("Add at least one set before saving.");
    return;
  }
  session.endedAt = nowISO();
  const workouts = loadWorkouts();
  workouts.unshift(session);
  saveWorkouts(workouts);

  session = null;
  undoStack = [];
  $("btnStart").disabled = false;
  $("btnEnd").disabled = true;
  $("btnAddSet").disabled = true;
  $("btnQuick").disabled = true;
  $("btnClearFields").disabled = true;
  $("btnUndo").disabled = true;
  $("sessionMeta").textContent = "Not started";
  $("templateMeta").textContent = "";
  $("planPreview").innerHTML = "";
  $("subtitle").textContent = "Saved";
  $("log").innerHTML = "";
  $("liveSummary").textContent = "0 sets";

  renderHistory();
  renderPRs();
  renderStats();
}

function sanitizeExercise(name){
  return (name || "").trim().replace(/\s+/g, " ");
}

function addExerciseToList(name){
  const exs = loadExercises();
  const norm = sanitizeExercise(name);
  if(!norm) return;
  if(!exs.includes(norm)){
    exs.push(norm);
    exs.sort((a,b)=>a.localeCompare(b));
    saveExercises(exs);
    renderExerciseDatalist();
  }
}

function getFieldValues(){
  const exercise = sanitizeExercise($("exercise").value);
  const load = Number($("load").value);
  const reps = Number($("reps").value);
  const rpeRaw = $("rpe").value;
  const rpe = rpeRaw === "" ? null : Number(rpeRaw);

  if(!exercise) return {error:"Exercise is required."};
  if(!Number.isFinite(load) || load <= 0) return {error:"Load must be > 0."};
  if(!Number.isFinite(reps) || reps <= 0) return {error:"Reps must be > 0."};
  if(rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) return {error:"RPE must be between 1 and 10."};

  return {exercise, load, reps, rpe};
}

function addSet(){
  if(!session) return;
  const v = getFieldValues();
  if(v.error){ alert(v.error); return; }

  const set = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    t: nowISO(),
    exercise: v.exercise,
    load: v.load,
    reps: v.reps,
    rpe: v.rpe,
    unit: "kg"
  };

  session.sets.push(set);
  addExerciseToList(v.exercise);

  $("btnUndo").disabled = false;
  undoStack = [];
  renderLog();
  renderPRs();
  renderStats();
  autoAdvanceFromPlan(v.exercise);
}

function addSetFromTemplate(exercise, loadKg, reps, rpe){
  if(!session) startSession();

  const set = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    t: nowISO(),
    exercise: sanitizeExercise(exercise),
    load: Number(loadKg),
    reps: Number(reps),
    rpe: (rpe === "" || rpe === null || rpe === undefined) ? null : Number(rpe),
    unit: "kg"
  };

  session.sets.push(set);
  addExerciseToList(set.exercise);

  $("btnUndo").disabled = false;
  undoStack = [];
  renderLog();
  renderPRs();
  renderStats();
  autoAdvanceFromPlan(set.exercise);
}

function quickPlusOneRep(){
  const reps = Number($("reps").value);
  $("reps").value = Number.isFinite(reps) ? String(reps + 1) : "1";
}
function clearFields(){
  $("load").value = "";
  $("reps").value = "";
  $("rpe").value = "";
}

function removeSet(setId){
  if(!session) return;
  const idx = session.sets.findIndex(s => s.id === setId);
  if(idx >= 0){
    const removed = session.sets.splice(idx, 1)[0];
    undoStack = [removed];
    $("btnUndo").disabled = false;
    renderLog();
  }
}
function undo(){
  if(!session) return;
  if(undoStack.length === 0) return;
  session.sets.push(undoStack.pop());
  renderLog();
}

function calcE1RM(load, reps){
  return Number(load) * (1 + Number(reps)/30);
}

function renderPlanPreview(){
  const el = $("planPreview");
  const meta = $("templateMeta");
  if(!el || !meta) return;

  el.innerHTML = "";
  if(!session || !session.plan || session.plan.length===0){
    meta.textContent = "";
    return;
  }
  meta.textContent = `Template: ${session.templateName || "Custom"}`;
  session.plan.forEach(p=>{
    const li=document.createElement("li");
    li.textContent = `${p.ex} — ${p.sets} set${p.sets===1?"":"s"} | ${p.reps} | RPE ${p.rpe}`;
    el.appendChild(li);
  });
}

function loadTemplate(name){
  const tpl = TEMPLATES[name];
  if(!tpl) return;
  if(!session) startSession();

  session.templateName = name;
  session.plan = tpl.plan;
  session.planIndex = 0;

  // strength-only list for auto-advance
  session.planStrength = tpl.plan.filter(p=>{
    const t = (p.ex||"").toLowerCase();
    return !(t.includes("treadmill") || t.includes("bike") || t.includes("sled") || t.includes("elliptical") || t.includes("zone 2") || t.includes("conditioning"));
  });

  const firstLift = session.planStrength[0];
  if(firstLift) $("exercise").value = firstLift.ex;

  // add planned lifts to suggestions
  const exs = loadExercises();
  tpl.plan.forEach(p=>{
    const nm = sanitizeExercise(p.ex);
    if(nm && !exs.includes(nm)) exs.push(nm);
  });
  exs.sort((a,b)=>a.localeCompare(b));
  saveExercises(exs);

  renderExerciseDatalist();
  renderPlanPreview();
  toast(`Loaded: ${name}`);
}

function autoAdvanceFromPlan(lastExercise){
  if(!session || !session.planStrength || session.planStrength.length===0) return;

  const normLast = sanitizeExercise(lastExercise).toLowerCase();
  let idx = session.planStrength.findIndex(p => sanitizeExercise(p.ex).toLowerCase() === normLast);
  if(idx < 0) idx = session.planIndex || 0;

  const planned = session.planStrength[idx];
  if(!planned) return;

  const done = (session.sets||[]).filter(s => sanitizeExercise(s.exercise).toLowerCase() === sanitizeExercise(planned.ex).toLowerCase()).length;
  const target = Number(planned.sets) || 0;

  if(target > 0 && done >= target){
    const next = session.planStrength[idx+1];
    if(next){
      session.planIndex = idx+1;
      $("exercise").value = next.ex;
      $("reps").value = "";
      $("rpe").value = "";
      toast(`Next: ${next.ex}`);
    } else {
      toast("Plan complete 🎉");
    }
  } else {
    session.planIndex = idx;
  }
}

function renderLog(){
  const log = $("log");
  log.innerHTML = "";
  if(!session){
    $("liveSummary").textContent = "0 sets";
    return;
  }

  const grouped = groupSets(session.sets);
  const keys = Object.keys(grouped);

  let count = 0;
  keys.forEach(ex => {
    const sets = grouped[ex];

    const header = document.createElement("li");
    header.className = "item";
    header.innerHTML = `
      <div class="left">
        <div><b>${escapeHtml(ex)}</b> <span class="badge">${sets.length} set${sets.length===1?"":"s"}</span></div>
        <div class="muted small">Tap a set to delete</div>
      </div>
      <div class="muted small kpi">${bestSetText(sets)}</div>
    `;
    log.appendChild(header);

    sets.forEach(s => {
      count++;
      const li = document.createElement("li");
      li.className = "item";
      li.style.cursor = "pointer";
      li.innerHTML = `
        <div class="left">
          <div class="kpi">${fmtLoadKg(s.load)} × ${s.reps}${s.rpe==null?"":` @ RPE ${s.rpe}`}</div>
          <div class="muted small">${new Date(s.t).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
        <div class="muted small">Delete</div>
      `;
      li.addEventListener("click", () => {
        if(confirm("Delete this set?")) removeSet(s.id);
      });
      log.appendChild(li);
    });
  });

  $("liveSummary").textContent = `${count} set${count===1?"":"s"}`;
  $("btnUndo").disabled = session.sets.length === 0;
}

function bestSetText(sets){
  let best = 0;
  sets.forEach(s => {
    const e = calcE1RM(s.load, s.reps);
    if(e > best) best = e;
  });
  return best > 0 ? `Best e1RM ~ ${best.toFixed(1)} kg` : "";
}

function groupSets(sets){
  const out = {};
  sets.forEach(s => {
    out[s.exercise] = out[s.exercise] || [];
    out[s.exercise].push(s);
  });
  return out;
}

function renderExerciseDatalist(){
  const dl = $("exerciseList");
  dl.innerHTML = "";
  const exs = loadExercises();
  exs.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e;
    dl.appendChild(opt);
  });
}

function minutesBetween(aIso, bIso){
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.max(0, Math.round((b-a)/60000));
}

function renderHistory(){
  const historyEl = $("history");
  const workouts = loadWorkouts();
  const q = $("search").value.trim().toLowerCase();

  historyEl.innerHTML = "";

  workouts.forEach(w => {
    const sets = w.sets || [];
    if(q){
      const any = sets.some(s => (s.exercise||"").toLowerCase().includes(q));
      if(!any) return;
    }

    const totalSets = sets.length;
    const date = w.endedAt ? fmtDate(w.endedAt) : fmtDate(w.startedAt);
    const dur = w.endedAt ? minutesBetween(w.startedAt, w.endedAt) : null;

    const li = document.createElement("li");
    li.className = "item";
    li.style.cursor = "pointer";
    li.innerHTML = `
      <div class="left">
        <div><b>${date}</b> <span class="badge">${totalSets} sets</span></div>
        <div class="muted small">${dur==null?"":`${dur} min`}</div>
      </div>
      <div class="muted small">View</div>
    `;
    li.addEventListener("click", ()=> openWorkoutModal(w));
    historyEl.appendChild(li);
  });

  if(workouts.length === 0){
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `<div class="muted">No workouts yet.</div>`;
    historyEl.appendChild(li);
  }
}

function renderPRs(){
  const prsEl = $("prs");
  const workouts = loadWorkouts();
  const q = $("search").value.trim().toLowerCase();
  const best = new Map();

  workouts.forEach(w => {
    (w.sets||[]).forEach(s => {
      if(q && !(s.exercise||"").toLowerCase().includes(q)) return;
      const key = s.exercise;
      const e1 = calcE1RM(s.load, s.reps);
      const prev = best.get(key);
      if(!prev || e1 > prev.e1){
        best.set(key, {e1, load:s.load, reps:s.reps, date: w.endedAt || w.startedAt});
      }
    });
  });

  const entries = Array.from(best.entries()).sort((a,b)=>b[1].e1 - a[1].e1);
  prsEl.innerHTML = "";

  entries.forEach(([ex, v]) => {
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `
      <div class="left">
        <div><b>${escapeHtml(ex)}</b></div>
        <div class="muted small">${fmtDate(v.date)} • Best set ${fmtLoadKg(v.load)} × ${v.reps}</div>
      </div>
      <div class="kpi">${v.e1.toFixed(1)} kg</div>
    `;
    prsEl.appendChild(li);
  });

  if(entries.length === 0){
    const li = document.createElement("li");
    li.className = "item";
    li.innerHTML = `<div class="muted">No PRs yet.</div>`;
    prsEl.appendChild(li);
  }
}

// Weekly volume totals by muscle group (heuristic)
const MUSCLE_GROUPS = ["Chest","Back","Shoulders","Biceps","Triceps","Quads","Hamstrings","Glutes","Calves","Core","Conditioning"];
function muscleGroupsForExercise(exName){
  const n = (exName||"").toLowerCase();
  const gs = new Set();

  if(n.includes("treadmill")||n.includes("bike")||n.includes("elliptical")||n.includes("sled")||n.includes("rower")||n.includes("zone 2")||n.includes("interval")||n.includes("conditioning")){
    gs.add("Conditioning"); return [...gs];
  }
  if(n.includes("dead bug")||n.includes("pallof")||n.includes("plank")||n.includes("bird dog")||n.includes("cat")||n.includes("camel")||n.includes("pelvic tilt")||n.includes("core")){
    gs.add("Core");
  }
  if(n.includes("leg press")||n.includes("hack squat")||n.includes("squat")||n.includes("leg extension")){
    gs.add("Quads"); gs.add("Glutes");
  }
  if(n.includes("hamstring curl")||n.includes("leg curl")||n.includes("rdl")||n.includes("romanian")){
    gs.add("Hamstrings"); gs.add("Glutes");
  }
  if(n.includes("hip thrust")||n.includes("glute bridge")||n.includes("kickback")||n.includes("abduction")){
    gs.add("Glutes");
  }
  if(n.includes("calf")) gs.add("Calves");

  if(n.includes("bench")||n.includes("chest press")||n.includes("pec")||n.includes("fly")){
    gs.add("Chest"); gs.add("Triceps"); gs.add("Shoulders");
  }
  if(n.includes("triceps")||n.includes("pressdown")||n.includes("pushdown")) gs.add("Triceps");
  if(n.includes("lateral raise")||n.includes("shoulder")) gs.add("Shoulders");

  if(n.includes("row")||n.includes("pulldown")||n.includes("pull-up")||n.includes("pull up")||n.includes("lat")){
    gs.add("Back"); gs.add("Biceps");
  }
  if(n.includes("rear delt")||n.includes("reverse pec")||n.includes("face pull")){
    gs.add("Shoulders"); gs.add("Back");
  }
  if(n.includes("curl")||n.includes("biceps")) gs.add("Biceps");

  return [...gs];
}

function renderStats(){
  const workouts = loadWorkouts();
  const now = Date.now();
  const weekAgo = now - 7*24*60*60*1000;

  let w7=0, s7=0, wa=workouts.length, sa=0;

  const weekSets = Object.fromEntries(MUSCLE_GROUPS.map(g=>[g,0]));
  const weekTonnage = Object.fromEntries(MUSCLE_GROUPS.map(g=>[g,0]));
  const allSets = Object.fromEntries(MUSCLE_GROUPS.map(g=>[g,0]));
  const allTonnage = Object.fromEntries(MUSCLE_GROUPS.map(g=>[g,0]));

  workouts.forEach(w=>{
    const t = new Date(w.endedAt || w.startedAt).getTime();
    const setsArr = (w.sets||[]);
    const setsCount = setsArr.length;
    sa += setsCount;
    if(t >= weekAgo){ w7 += 1; s7 += setsCount; }

    setsArr.forEach(s=>{
      const groups = muscleGroupsForExercise(s.exercise);
      const ton = (Number(s.load)||0) * (Number(s.reps)||0);
      groups.forEach(g=>{
        allSets[g] += 1;
        allTonnage[g] += ton;
        if(t >= weekAgo){
          weekSets[g] += 1;
          weekTonnage[g] += ton;
        }
      });
    });
  });

  $("s7Workouts").textContent = String(w7);
  $("s7Sets").textContent = String(s7);
  $("sAllWorkouts").textContent = String(wa);
  $("sAllSets").textContent = String(sa);

  const weekEl = $("muscleWeek");
  const allEl  = $("muscleAll");
  if(weekEl && allEl){
    weekEl.innerHTML = "";
    allEl.innerHTML  = "";
    const rows = MUSCLE_GROUPS
      .filter(g => weekSets[g] > 0 || allSets[g] > 0)
      .map(g => ({g, w:weekSets[g], a:allSets[g], wt:weekTonnage[g], at:allTonnage[g]}));

    rows.forEach(r=>{
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML = `<div class="left"><div class="kpi">${r.g}</div><div class="muted small">${r.w} sets • ${Math.round(r.wt)} kg·reps</div></div>`;
      weekEl.appendChild(li);
    });
    rows.forEach(r=>{
      const li=document.createElement("li");
      li.className="item";
      li.innerHTML = `<div class="left"><div class="kpi">${r.g}</div><div class="muted small">${r.a} sets • ${Math.round(r.at)} kg·reps</div></div>`;
      allEl.appendChild(li);
    });
  }
}

function switchTab(tab){
  document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".tabpane").forEach(p=>p.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add("active");
  document.getElementById(`tab-${tab}`)?.classList.add("active");
}

function exportData(){
  const payload = {
    version: 1,
    exportedAt: nowISO(),
    workouts: loadWorkouts(),
    exercises: loadExercises()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workout-tracker-export-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importDataFromFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const payload = JSON.parse(reader.result);
      if(!payload || payload.version !== 1) throw new Error("Invalid file");
      if(!Array.isArray(payload.workouts)) throw new Error("Invalid workouts");
      if(!Array.isArray(payload.exercises)) throw new Error("Invalid exercises");
      saveWorkouts(payload.workouts);
      saveExercises(payload.exercises);
      renderExerciseDatalist();
      renderHistory();
      renderPRs();
      renderStats();
      alert("Import complete.");
    }catch(e){
      alert("Import failed: " + e.message);
    }
  };
  reader.readAsText(file);
}

function clearAll(){
  if(!confirm("Delete ALL workouts on this device? This cannot be undone.")) return;
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_EX);
  session = null;
  undoStack = [];
  $("btnStart").disabled = false;
  $("btnEnd").disabled = true;
  $("btnAddSet").disabled = true;
  $("btnQuick").disabled = true;
  $("btnClearFields").disabled = true;
  $("btnUndo").disabled = true;
  $("sessionMeta").textContent = "Not started";
  $("templateMeta").textContent = "";
  $("planPreview").innerHTML = "";
  $("subtitle").textContent = "Cleared";
  $("log").innerHTML = "";
  $("liveSummary").textContent = "0 sets";
  renderExerciseDatalist();
  renderHistory();
  renderPRs();
  renderStats();
}

// ===== History Modal =====
function openWorkoutModal(workout){
  $("modalTitle").textContent = fmtDate(workout.endedAt || workout.startedAt);
  const dur = workout.endedAt ? `${minutesBetween(workout.startedAt, workout.endedAt)} min` : "";
  $("modalSub").textContent = `${(workout.sets||[]).length} sets${dur ? " • " + dur : ""}`;

  const list = $("modalList");
  list.innerHTML = "";
  const grouped = groupSets(workout.sets||[]);
  Object.keys(grouped).forEach(ex=>{
    const sets = grouped[ex];
    const li = document.createElement("li");
    li.className = "item";
    const best = Math.max(...sets.map(s => calcE1RM(s.load, s.reps)));
    li.innerHTML = `
      <div class="left">
        <div><b>${escapeHtml(ex)}</b> <span class="badge">${sets.length} set${sets.length===1?"":"s"}</span></div>
        <div class="muted small">${sets.map(s => `${fmtLoadKg(s.load)}×${s.reps}${s.rpe==null?"":`@${s.rpe}`}`).join(" • ")}</div>
      </div>
      <div class="muted small kpi">${best.toFixed(1)} kg</div>
    `;
    list.appendChild(li);
  });

  openModalSheet();
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[s]));
}

// ===== NEW FEATURE: show ALL days with per-set inputs in Templates tab =====
function renderAllDayPlans(){
  const wrap = $("dayPlans");
  if(!wrap) return;

  wrap.innerHTML = "";
  const days = Object.keys(TEMPLATES);

  days.forEach((dayName) => {
    const tpl = TEMPLATES[dayName];

    const card = document.createElement("div");
    card.className = "daycard";

    const header = document.createElement("div");
    header.className = "dayheader";

    const left = document.createElement("div");
    left.innerHTML = `<div class="daytitle">${dayName}</div><div class="daymeta">${tpl.meta || ""}</div>`;

    const btnStart = document.createElement("button");
    btnStart.className = "btn ghost";
    btnStart.textContent = "Start this day";
    btnStart.addEventListener("click", ()=>{
      loadTemplate(dayName);
      window.scrollTo({top:0, behavior:"smooth"});
    });

    header.appendChild(left);
    header.appendChild(btnStart);
    card.appendChild(header);

    // exercise blocks
    tpl.plan.forEach((p, pIdx) => {
      const block = document.createElement("div");
      block.className = "item";

      const isTime = String(p.reps).toLowerCase().includes("min") || String(p.ex).toLowerCase().includes("treadmill") || String(p.ex).toLowerCase().includes("bike");

      block.innerHTML = `
        <div class="left">
          <div class="kpi">${p.ex}</div>
          <div class="muted small">${p.sets} sets • ${p.reps} • RPE ${p.rpe}</div>
        </div>
      `;

      if(isTime){
        const note = document.createElement("div");
        note.className = "muted small";
        note.textContent = "Cardio item (no set logging required).";
        block.appendChild(note);
        card.appendChild(block);
        return;
      }

      // planned set rows
      for(let s=1; s<=Number(p.sets||0); s++){
        const row = document.createElement("div");
        row.className = "planInputs";
        row.style.marginTop = "8px";

        const inKg = document.createElement("input");
        inKg.type = "number";
        inKg.inputMode = "decimal";
        inKg.placeholder = `Set ${s} kg`;

        const inReps = document.createElement("input");
        inReps.type = "number";
        inReps.inputMode = "numeric";
        inReps.placeholder = "reps";

        const inRpe = document.createElement("input");
        inRpe.type = "number";
        inRpe.step = "0.5";
        inRpe.placeholder = "RPE";

        row.appendChild(inKg);
        row.appendChild(inReps);
        row.appendChild(inRpe);

        const btn = document.createElement("button");
        btn.className = "btn";
        btn.style.marginTop = "6px";
        btn.textContent = "Add to live log";

        btn.addEventListener("click", ()=>{
          const kg = Number(inKg.value);
          const reps = Number(inReps.value);
          const rpe = inRpe.value ? Number(inRpe.value) : null;
          if(!Number.isFinite(kg) || !Number.isFinite(reps)) return;

          // ensure session and template are set
          if(!session) startSession();
          session.templateName = dayName;
          session.plan = tpl.plan;
          if(!session.planStrength){
            session.planStrength = tpl.plan.filter(x=>{
              const t = (x.ex||"").toLowerCase();
              return !(t.includes("treadmill") || t.includes("bike") || t.includes("sled") || t.includes("elliptical") || t.includes("zone 2") || t.includes("conditioning"));
            });
          }

          addSetFromTemplate(p.ex, kg, reps, rpe);

          // auto-advance the main exercise input when planned sets completed
          const done = (session.sets||[]).filter(x => sanitizeExercise(x.exercise).toLowerCase() === sanitizeExercise(p.ex).toLowerCase()).length;
          if(done >= Number(p.sets||0)){
            const next = tpl.plan.slice(pIdx+1).find(nx=>{
              const t = (nx.ex||"").toLowerCase();
              return !(String(nx.reps).toLowerCase().includes("min") || t.includes("treadmill") || t.includes("bike") || t.includes("conditioning"));
            });
            if(next) $("exercise").value = next.ex;
          } else {
            $("exercise").value = p.ex;
          }

          inKg.value = "";
          inReps.value = "";
          inRpe.value = "";
        });

        block.appendChild(row);
        block.appendChild(btn);
      }

      card.appendChild(block);
    });

    wrap.appendChild(card);
  });

  // fill reference plan text if present
  if($("planText")) $("planText").textContent = FULL_PLAN_TEXT;
}

// Service worker registration (safe if you have sw.js; otherwise it fails silently)
async function registerSW(){
  if(!("serviceWorker" in navigator)) return;
  try{
    await navigator.serviceWorker.register("./sw.js");
  }catch(e){
    // ignore
  }
}

function wireUI(){
  if($("planText")) $("planText").textContent = FULL_PLAN_TEXT;

  $("btnStart")?.addEventListener("click", startSession);
  $("btnEnd")?.addEventListener("click", endSession);
  $("btnAddSet")?.addEventListener("click", addSet);
  $("btnQuick")?.addEventListener("click", quickPlusOneRep);
  $("btnClearFields")?.addEventListener("click", clearFields);
  $("btnUndo")?.addEventListener("click", undo);

  $("search")?.addEventListener("input", () => { renderHistory(); renderPRs(); });

  document.querySelectorAll(".tab").forEach(b=>{
    b.addEventListener("click", ()=> switchTab(b.dataset.tab));
  });

  $("btnExport")?.addEventListener("click", exportData);
  $("btnImport")?.addEventListener("click", () => $("importFile")?.click());
  $("importFile")?.addEventListener("change", (e)=>{
    const file = e.target.files?.[0];
    if(file) importDataFromFile(file);
    e.target.value = "";
  });

  $("btnClearAll")?.addEventListener("click", clearAll);

  $("btnClose")?.addEventListener("click", closeModalSheet);
  modal?.addEventListener("click", (e)=> { if(e.target === modal) closeModalSheet(); });
}

function boot(){
  wireUI();
  renderExerciseDatalist();
  renderHistory();
  renderPRs();
  renderStats();
  renderAllDayPlans();   // ✅ your requested feature
  registerSW();
}
function renderSchedule(){
  const wrap = document.getElementById("scheduleList");
  if(!wrap) return;

  wrap.innerHTML = "";

  Object.keys(TEMPLATES).forEach((dayName) => {
    const tpl = TEMPLATES[dayName];

    const card = document.createElement("div");
    card.className = "tcard";

    // Preview text (first ~4 exercises)
    const preview = (tpl.plan || [])
      .slice(0, 4)
      .map(p => `• ${p.ex} (${p.sets}×${p.reps})`)
      .join("<br>");

    card.innerHTML = `
      <div class="kpi"><b>${dayName}</b></div>
      <div class="muted small" style="margin-top:4px;">${tpl.meta || ""}</div>
      <div class="muted small" style="margin-top:8px; line-height:1.35;">${preview}${(tpl.plan||[]).length>4 ? "<br>…" : ""}</div>
      <div class="row" style="margin-top:10px; gap:8px;">
        <button class="btn" data-action="start">Start this day</button>
        <button class="btn ghost" data-action="view">View</button>
      </div>
    `;

    // Wire buttons
    card.querySelector('[data-action="start"]').addEventListener("click", ()=>{
      loadTemplate(dayName);
      // jump user to Current workout
      window.scrollTo({top:0, behavior:"smooth"});
      toast(`Started: ${dayName}`);
    });

    card.querySelector('[data-action="view"]').addEventListener("click", ()=>{
      // Switch to Templates tab and scroll to that day
      switchTab("templates");
      setTimeout(()=>{
        const dayPlans = document.getElementById("dayPlans");
        if(dayPlans) dayPlans.scrollIntoView({behavior:"smooth", block:"start"});
      }, 50);
    });

    wrap.appendChild(card);
  });

  if(wrap.children.length === 0){
    wrap.innerHTML = `<div class="muted small">No schedule templates found.</div>`;
  }

function boot(){
  wireUI();
  renderExerciseDatalist();
  renderHistory();
  renderPRs();
  renderStats();
  renderAllDayPlans();
  renderSchedule();        // ✅ ADD THIS
  registerSW();
}
boot();