(() => {
  "use strict";

  const { calculateComponent, calculateQuarterlyAssessment, calculateInitialGrade, format, hasRawAboveHps, isAttendanceCode, numberOrNull } = window.CSTRGrading;
  const LOGIN_PASSWORD = "harty342002";
  const GIST_ID_KEY = "cstr-class-record-gist-id";
  const GIST_TOKEN_KEY = "cstr-class-record-pat";
  const app = document.querySelector("#app");

  // Updated registry to include the newly defined border classes
  const registry = [
    { id: "g8-alfonso", group: "JHS", level: "Grade 8", subject: "Science - Saint Alfonso de Orozco", weights: [20, 50, 30], borderClass: "border-jhs", theme: "purple", rosterSize: 42 },
    { id: "g8-john", group: "JHS", level: "Grade 8", subject: "Science - Saint John Stone", weights: [20, 50, 30], borderClass: "border-jhs", theme: "green", rosterSize: 42 },
    { id: "g8-pedro", group: "JHS", level: "Grade 8", subject: "Science - Saint Pedro Calungsod", weights: [20, 50, 30], borderClass: "border-jhs", theme: "blue", rosterSize: 42 },
    { id: "g9-ezekiel", group: "JHS", level: "Grade 9", subject: "ICL-Research III - Saint Ezekiel Moreno", weights: [20, 50, 30], borderClass: "border-jhs", theme: "red", rosterSize: 42 },
    { id: "g11-physics-carmel", group: "SHS", level: "Grade 11", subject: "Physics 1 - Our Lady of Mount Carmel", weights: [20, 50, 30], borderClass: "border-olmc-physics", theme: "blue", rosterSize: 42 },
    { id: "g11-general-carmel", group: "SHS", level: "Grade 11", subject: "General Science 11 - Our Lady of Mount Carmel", weights: [20, 50, 30], borderClass: "border-olmc-gensci", theme: "blue", rosterSize: 42 },
    { id: "g11-consolacion", group: "SHS", level: "Grade 11", subject: "General Science 11 - Our Lady of Consolacion", weights: [20, 50, 30], borderClass: "border-olc-gensci", theme: "blue", rosterSize: 42 }
  ];

  // Updated views: "home", "levels", "sections", "records"
  let currentView = "home";
  let activeGroup = null;
  let activeSectionId = null;
  let activePeriodIndex = 0;
  let state = createInitialState();

  let isDataLoaded = false;
  let isLoading = false;
  let selectionState = { active: false, startRow: null, startCol: null, endRow: null, endCol: null };

  function emptyRoster(size) { return Array.from({ length: size }, () => ({ name: "", ww: Array(10).fill(""), pt: Array(8).fill(""), qa: Array(3).fill("") })); }

  function initialPeriod(section) {
    return {
      name: section.group === "JHS" ? "1st Grading" : "1st Quarter, 1st Semester",
      wwDates: Array(10).fill(""), ptDates: Array(8).fill(""), qaDates: Array(3).fill(""),
      wwHps: Array(10).fill(""), ptHps: Array(8).fill(""), qaHps: Array(3).fill(""),
      roster: emptyRoster(section.rosterSize)
    };
  }

  function createInitialState() {
    return { version: 1, photo: "", sections: Object.fromEntries(registry.map((section) => [section.id, { periods: [initialPeriod(section)] }])) };
  }

  // (Normalized State and array fitters are retained from Source 1 unmodified)
  function normalizeState(saved) {
    const base = createInitialState();
    if (!saved || typeof saved !== "object") return base;
    base.photo = typeof saved.photo === "string" ? saved.photo : "";
    registry.forEach((section) => {
      const loaded = saved.sections && saved.sections[section.id];
      if (!loaded || !Array.isArray(loaded.periods) || !loaded.periods.length) return;
      base.sections[section.id].periods = loaded.periods.map((period) => ({
        name: typeof period.name === "string" && period.name.trim() ? period.name : initialPeriod(section).name,
        wwDates: fitArray(period.wwDates, 10), ptDates: fitArray(period.ptDates, 8), qaDates: fitArray(period.qaDates, 3),
        wwHps: fitArray(period.wwHps, 10), ptHps: fitArray(period.ptHps, 8), qaHps: fitArray(period.qaHps, 3),
        roster: Array.from({ length: section.rosterSize }, (_, index) => {
          const learner = Array.isArray(period.roster) ? period.roster[index] : null;
          return { name: learner && typeof learner.name === "string" ? learner.name : "", ww: fitArray(learner && learner.ww, 10), pt: fitArray(learner && learner.pt, 8), qa: fitArray(learner && learner.qa, 3) };
        })
      }));
    });
    return base;
  }
  function fitArray(values, length) { return Array.from({ length }, (_, index) => Array.isArray(values) && values[index] !== undefined ? values[index] : ""); }

  function currentSection() { return registry.find((section) => section.id === activeSectionId) || registry[0]; }
  function currentPeriod() { return state.sections[activeSectionId].periods[activePeriodIndex]; }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
  function safeValue(value) { return escapeHtml(value === undefined || value === null ? "" : value); }
  function button(label, action, className = "button", extra = "") { return `<button type="button" class="${className}" data-action="${action}" ${extra}>${label}</button>`; }

  function getLearnerCategory(name) {
    if (typeof name !== "string") return null;
    const clean = name.trim().toLowerCase();
    if (clean.includes("boys")) return "boys";
    if (clean.includes("girls")) return "girls";
    return null;
  }

  function computeLearnerNumbering(roster) {
    let count = 0;
    const numbering = roster.map((learner) => {
      const name = (learner.name || "").trim();
      if (!name) return ""; 
      if (getLearnerCategory(name)) return "—"; 
      count += 1;
      return count;
    });
    return { numbering, totalLearners: count };
  }

  function updateAllNumberingAndCounts() {
    if (currentView !== "records") return;
    const period = currentPeriod();
    if (!period || !period.roster) return;
    const { numbering, totalLearners } = computeLearnerNumbering(period.roster);
    document.querySelectorAll("tr[data-learner-row]").forEach((row, idx) => {
      const numCell = row.querySelector(".number-cell");
      if (numCell) numCell.textContent = numbering[idx] !== undefined ? numbering[idx] : "";
    });
    const countBadge = document.querySelector("#liveLearnerCount");
    if (countBadge) countBadge.textContent = `${totalLearners} Learner${totalLearners === 1 ? "" : "s"}`;
  }

  function adjustNameColumnWidth() {
    if (currentView !== "records") return;
    const period = currentPeriod();
    if (!period || !period.roster) return;
    let maxLen = 14;
    period.roster.forEach((learner) => { const len = (learner.name || "").length; if (len > maxLen) maxLen = len; });
    document.querySelectorAll(".name-cell input").forEach((input) => { if (input.value.length > maxLen) maxLen = input.value.length; });
    const newWidth = Math.max(200, Math.ceil(maxLen * 8.8 + 36));
    document.documentElement.style.setProperty("--name-col-width", `${newWidth}px`);
  }

  function render() {
    app.innerHTML = sessionStorage.getItem("cstr-class-record-login") === "true" ? renderApp() : renderLogin();
    syncSaveControl();
    if (currentView === "records") {
      adjustNameColumnWidth();
      updateAllNumberingAndCounts();
    }
  }

  function renderLogin() {
    return `<section class="login-screen"><div class="card">
      <p class="eyebrow">CSTR Class Record</p><h1>Owner login</h1>
      <label class="field-label">Password<input id="loginPassword" type="password" autocomplete="current-password" required></label>
      ${button("Login", "login", "button button-primary")}
      <p id="loginError" class="login-error" role="alert"></p>
    </div></section>`;
  }

  function renderApp() {
    let content = "";
    if (currentView === "home") content = renderHome();
    else if (currentView === "levels") content = renderLevelSelection();
    else if (currentView === "sections") content = renderSectionSelection();
    else content = renderClassRecord();

    return `<header class="app-header"><div class="app-header-inner">
      <div class="app-header-brand">
        <span class="header-logo"><img src="assets/img/cstr-logo.png" alt="CSTR crest"></span>
        <div><p class="eyebrow">CSTR • San Carlos City, Negros Occidental</p>
        <h1 class="app-title">Colegio de Sto. Tomás – Recoletos</h1></div>
      </div>
      <div class="header-actions-wrap">
        <div class="header-actions">
          <form id="studentSearchForm" class="search-form" onsubmit="event.preventDefault(); window.searchStudent();">
            <input type="text" id="searchInput" placeholder="Search student by name..." autocomplete="off">
            <button type="submit">Search</button>
          </form>
          ${button("💾 Save", "save-changes", "button button-primary", `id="saveChanges"`)} 
          ${button("Settings", "open-settings")} 
          ${button("Log out", "logout")}
        </div>
        <p id="statusMessage" class="save-status" role="status" aria-live="polite"></p>
      </div>
    </div></header>
    <div class="app-shell">
      <nav class="tabs" aria-label="Main navigation">
        <button class="tab" type="button" data-action="go-home" aria-selected="${currentView === "home"}">Home</button>
        <button class="tab" type="button" data-action="go-levels" aria-selected="${currentView !== "home"}">Class Record Data</button>
      </nav>${content}</div>`;
  }

  // --- Revised Navigation Structure ---
  function renderLevelSelection() {
    return `<section><div class="section-heading"><div><p class="eyebrow">Class Record</p><h2>Select Education Level</h2></div></div>
      <div class="nav-grid">
        <div class="nav-square level border-jhs" data-action="select-level" data-group="JHS">
          Junior High School<div class="nav-subject">Grades 7 to 10</div>
        </div>
        <div class="nav-square level border-olmc-physics" data-action="select-level" data-group="SHS">
          Senior High School<div class="nav-subject">Grades 11 and 12</div>
        </div>
      </div></section>`;
  }

  function renderSectionSelection() {
    const sections = registry.filter((s) => s.group === activeGroup);
    const squares = sections.map((s) => `
      <div class="nav-square section ${s.borderClass}" data-action="select-section" data-section="${s.id}">
        ${s.level} <div class="nav-subject">${escapeHtml(s.subject)}</div>
      </div>`).join("");

    return `<section><div class="section-heading"><div>
      <p class="eyebrow">${activeGroup === "JHS" ? "Junior High School" : "Senior High School"}</p>
      <h2>Select a Section</h2></div>
      ${button("← Back to Levels", "go-levels", "button")}
      </div>
      <div class="nav-grid">${squares}</div></section>`;
  }

  function renderClassRecord() {
    const section = currentSection();
    const periods = state.sections[section.id].periods;
    if (activePeriodIndex >= periods.length) activePeriodIndex = 0;
    const period = currentPeriod();
    const { totalLearners } = computeLearnerNumbering(period.roster);
    
    const periodTabs = periods.map((entry, index) => `<button type="button" class="tab theme-${section.theme}" data-action="select-period" data-period="${index}" aria-selected="${activePeriodIndex === index}">${escapeHtml(entry.name)}</button>`).join("");
    
    return `<section class="record-section">
      <div class="section-heading"><div>
        <button type="button" class="button" data-action="go-sections" style="margin-bottom: 12px;">← Back to Sections</button>
        <div class="section-title-wrap"><h2>${escapeHtml(section.subject)}</h2><span id="liveLearnerCount" class="learner-count-badge">${totalLearners} Learners</span></div>
        <div class="record-meta"><span><strong>${section.level}</strong></span><span>Weights: <strong>${section.weights.join(" / ")}</strong></span></div>
      </div></div>
      <div class="period-tabs">${periodTabs}</div>
      <div class="period-toolbar"><input id="periodName" class="period-name" value="${safeValue(period.name)}" data-period-name> ${button("+ Add Period", "add-period", "button button-yellow")}</div>
      ${renderRecordTable(section, period)}
    </section>`;
  }

  function renderHome() {
    const portrait = state.photo ? `<img class="profile-photo" src="${state.photo}">` : `<span class="silhouette"></span>`;
    return `<section class="home-grid"><div><input id="photoInput" type="file" accept="image/*" hidden>
      <button class="photo-frame" type="button" data-action="choose-photo">${portrait}</button></div>
      <div><p class="eyebrow">Class record owner</p><p class="teacher-block"><strong>RAMELITO JR. C. SANCHEZ, LPT.</strong></p>
      <div class="home-cta">${button("Proceed to Class Record →", "go-levels", "button button-primary")}</div></div></section>`;
  }

  // Record Tables and calculation logic remains exactly standard
  function renderRecordTable(section, period) {
    const dateHeaders = (kind, values) => values.map((val, i) => {
      const borderClass = (i === 0 && (kind === "pt" || kind === "qa")) ? `border-start-${kind}` : "";
      return `<th class="activity-date-cell ${borderClass}"><input class="activity-date" type="text" data-date="${kind}" data-index="${i}" value="${safeValue(val)}" placeholder="Date"></th>`;
    }).join("");
    const hpsInputs = (kind, values) => values.map((val, i) => {
      const borderClass = (i === 0 && (kind === "pt" || kind === "qa")) ? `border-start-${kind}` : "";
      return `<td class="${borderClass}"><input type="number" min="0" data-hps="${kind}" data-index="${i}" value="${safeValue(val)}"></td>`;
    }).join("");
    const { numbering } = computeLearnerNumbering(period.roster);
    const rows = period.roster.map((learner, rowIndex) => renderLearnerRow(learner, rowIndex, period, section, numbering[rowIndex])).join("");
    
    return `<div class="table-wrap"><table class="record-table compact-record"><thead>
      <tr class="component-row"><th class="number-cell" rowspan="3">#</th><th class="name-cell" rowspan="3">Learner name</th><th class="component-header component-ww" colspan="13">Written Works</th><th class="component-header component-pt border-start-pt" colspan="11">Performance Tasks</th><th class="component-header component-qa border-start-qa" colspan="6">Quarterly Assessment</th><th class="initial-header" rowspan="3">Initial<br>Grade</th></tr>
      <tr class="activity-row">${dateHeaders("ww", period.wwDates)}<th class="component-summary component-ww">Total</th><th class="component-summary component-ww">PS</th><th class="component-summary component-ww">WS</th>${dateHeaders("pt", period.ptDates)}<th class="component-summary component-pt">Total</th><th class="component-summary component-pt">PS</th><th class="component-summary component-pt">WS</th>${dateHeaders("qa", period.qaDates)}<th class="component-summary component-qa">Total</th><th class="component-summary component-qa">PS</th><th class="component-summary component-qa">WS</th></tr>
      <tr class="hps-input-row"><th colspan="2">Enter HPS</th>${hpsInputs("ww", period.wwHps)}<td colspan="3">&nbsp;</td>${hpsInputs("pt", period.ptHps)}<td colspan="3">&nbsp;</td>${hpsInputs("qa", period.qaHps)}<td colspan="3">&nbsp;</td></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderLearnerRow(learner, rowIndex, period, section, numDisplay) {
    const cat = getLearnerCategory(learner.name);
    const catClass = cat ? `row-category row-category-${cat}` : "";
    const scoreInputs = (kind, values, hpsValues) => values.map((val, i) => {
      const bClass = (i === 0 && (kind === "pt" || kind === "qa")) ? `border-start-${kind}` : "";
      const inputClass = [hasRawAboveHps(val, hpsValues[i]) ? "invalid" : "", isAttendanceCode(val) ? "code-cell" : ""].filter(Boolean).join(" ");
      return `<td class="${bClass}"><input class="${inputClass}" type="text" data-score="${kind}" data-row="${rowIndex}" data-index="${i}" value="${safeValue(cat ? "" : val)}" ${cat ? 'disabled tabindex="-1"' : ''}></td>`;
    }).join("");
    const result = learnerResult(learner, period, section.weights);
    return `<tr class="${catClass}" data-learner-row="${rowIndex}"><th class="number-cell">${numDisplay !== undefined ? numDisplay : ""}</th><td class="name-cell"><input class="text-input" data-name-row="${rowIndex}" value="${safeValue(learner.name)}"></td>${scoreInputs("ww", learner.ww, period.wwHps)}${summaryCells(result, "ww")}${scoreInputs("pt", learner.pt, period.ptHps)}${summaryCells(result, "pt")}${scoreInputs("qa", learner.qa, period.qaHps)}${summaryCells(result, "qa")}<td class="summary-cell initial-cell summary-initial">${format(result.initial.rounded, 0)}</td></tr>`;
  }

  function learnerResult(learner, period, weights) {
    const ww = calculateComponent(learner.ww, period.wwHps, weights[0]);
    const pt = calculateComponent(learner.pt, period.ptHps, weights[1]);
    const qa = calculateQuarterlyAssessment(learner.qa, period.qaHps, weights[2]);
    return { ww, pt, qa, initial: calculateInitialGrade(ww, pt, qa) };
  }

  function summaryCells(result, kind) {
    const component = result[kind];
    const total = component.used ? `${format(component.rawTotal, 0)} / ${format(component.hpsTotal, 0)}` : "—";
    return `<td class="summary-cell component-total summary-${kind}-total">${total}</td><td class="summary-cell summary-${kind}-ps">${format(component.percentage, 2)}</td><td class="summary-cell summary-${kind}-ws">${format(component.weighted, 2)}</td>`;
  }

  function sanitizeScoreValue(raw) {
    if (raw === "" || raw === null || raw === undefined) return "";
    const trimmed = String(raw).trim();
    const upper = trimmed.toUpperCase();
    if (upper === "A" || upper === "E" || upper === "L") return upper;
    const numeric = trimmed.replace(/[^0-9.]/g, "");
    return numeric;
  }

  function updateLiveSummary(rowIndex) {
    const period = currentPeriod(); const section = currentSection(); const learner = period.roster[rowIndex];
    const row = document.querySelector(`[data-learner-row="${rowIndex}"]`); if (!row) return;
    const result = learnerResult(learner, period, section.weights);
    
    const sc = (kind) => {
      row.querySelector(`.summary-${kind}-total`).textContent = result[kind].used ? `${format(result[kind].rawTotal, 0)} / ${format(result[kind].hpsTotal, 0)}` : "—";
      row.querySelector(`.summary-${kind}-ps`).textContent = format(result[kind].percentage, 2);
      row.querySelector(`.summary-${kind}-ws`).textContent = format(result[kind].weighted, 2);
      row.querySelectorAll(`[data-score="${kind}"]`).forEach((input) => {
        const index = Number(input.dataset.index);
        input.classList.toggle("invalid", hasRawAboveHps(learner[kind][index], period[`${kind}Hps`][index]));
        input.classList.toggle("code-cell", isAttendanceCode(learner[kind][index]));
      });
    };
    ["ww", "pt", "qa"].forEach(sc);
    row.querySelector(".summary-initial").textContent = format(result.initial.rounded, 0);
  }
  function updateAllSummaries() { currentPeriod().roster.forEach((_, index) => updateLiveSummary(index)); }

  // Search Student Logic
  window.searchStudent = function() {
    const input = document.getElementById("searchInput");
    if (!input || !input.value.trim()) return;
    const query = input.value.trim().toLowerCase();
    
    let found = null;
    for (const sec of registry) {
      const sectionData = state.sections[sec.id];
      for (let pIdx = 0; pIdx < sectionData.periods.length; pIdx++) {
        const period = sectionData.periods[pIdx];
        const learner = period.roster.find(l => l.name && l.name.toLowerCase().includes(query) && !getLearnerCategory(l.name));
        if (learner) { found = { sec, period, learner }; break; }
      }
      if (found) break;
    }

    if (!found) { alert("Student not found in the records."); return; }

    // Validate if Grade Sheet is 'finished' (up to initial grade definition):
    // Rule: Every slot that has an HPS set, MUST have a raw score for that student. And at least one HPS must exist overall.
    let isFinished = true; let hasAtLeastOneHps = false;
    const checkArrays = (rawArr, hpsArr) => {
      for (let i = 0; i < hpsArr.length; i++) {
        if (numberOrNull(hpsArr[i]) !== null) {
          hasAtLeastOneHps = true;
          if (rawArr[i] === "") { isFinished = false; }
        }
      }
    };
    checkArrays(found.learner.ww, found.period.wwHps);
    checkArrays(found.learner.pt, found.period.ptHps);
    checkArrays(found.learner.qa, found.period.qaHps);
    
    if (!hasAtLeastOneHps) isFinished = false;
    const result = learnerResult(found.learner, found.period, found.sec.weights);

    // Build Search Modal UI
    const modalHtml = `<div class="modal-backdrop"><section class="modal search-modal-content">
      <h2 class="student-name">${escapeHtml(found.learner.name)}</h2>
      <div class="student-section">${found.sec.level} • ${escapeHtml(found.sec.subject)}</div>
      
      ${isFinished ? 
        `<div class="search-modal-grade"><span class="grade-value">${format(result.initial.rounded, 0)}</span><span class="grade-status">Initial Grade</span></div>` : 
        `<div class="search-modal-grade unfinished"><span class="grade-status">Grades are not yet made/finished/finalized</span></div>`
      }
      
      ${button("Close Profile", "close-settings", "button close-settings")}
    </section></div>`;
    
    document.body.insertAdjacentHTML("beforeend", modalHtml);
  };

  // Remaining Handlers (Sync, Settings, Grid Clicks)
  function setStatus(message, type = "") {
    const status = document.querySelector("#statusMessage");
    if (status) { status.textContent = message; status.className = `save-status ${type}`; }
  }

  function syncSaveControl() {
    const btn = document.querySelector("#saveChanges"); if (!btn) return;
    const hasCreds = Boolean(localStorage.getItem(GIST_ID_KEY) && localStorage.getItem(GIST_TOKEN_KEY));
    if (!hasCreds) { btn.disabled = false; setStatus("Add Gist credentials in Settings to sync."); }
    else if (isLoading) { btn.disabled = true; setStatus("Syncing...", "saving"); }
    else if (!isDataLoaded) { btn.disabled = true; setStatus("DATA LOCKED: Load from Settings first.", "error"); }
    else { btn.disabled = false; setStatus("Ready to save. ✓"); }
  }

  function addPeriod() {
    const section = currentSection(); const periods = state.sections[section.id].periods;
    const period = initialPeriod(section);
    period.name = `Period ${periods.length + 1}`;
    periods.push(period); activePeriodIndex = periods.length - 1; render();
  }

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]"); if (!target) return;
    const action = target.dataset.action;
    
    if (action === "login") {
      if (document.querySelector("#loginPassword").value === LOGIN_PASSWORD) {
        sessionStorage.setItem("cstr-class-record-login", "true"); isDataLoaded = true; currentView = "levels"; render();
      } else { document.querySelector("#loginError").textContent = "Incorrect password."; }
    }
    if (action === "logout") { sessionStorage.removeItem("cstr-class-record-login"); currentView = "home"; render(); }
    if (action === "go-home") { currentView = "home"; render(); }
    if (action === "go-levels") { currentView = "levels"; render(); }
    if (action === "go-sections") { currentView = "sections"; render(); }
    
    if (action === "select-level") { activeGroup = target.dataset.group; currentView = "sections"; render(); }
    if (action === "select-section") { activeSectionId = target.dataset.section; activePeriodIndex = 0; currentView = "records"; render(); }
    if (action === "select-period") { activePeriodIndex = Number(target.dataset.period); render(); }
    if (action === "add-period") addPeriod();
    if (action === "close-settings") document.querySelector(".modal-backdrop")?.remove();
  });

  app.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset.nameRow !== undefined) { 
      const rowIndex = Number(input.dataset.nameRow); const learner = currentPeriod().roster[rowIndex];
      learner.name = input.value;
      if (getLearnerCategory(learner.name)) { learner.ww.fill(""); learner.pt.fill(""); learner.qa.fill(""); render(); }
      else { updateLiveSummary(rowIndex); updateAllNumberingAndCounts(); adjustNameColumnWidth(); }
    }
    if (input.dataset.periodName !== undefined) currentPeriod().name = input.value;
    if (input.dataset.date) currentPeriod()[`${input.dataset.date}Dates`][Number(input.dataset.index)] = input.value;
    if (input.dataset.score) {
      const kind = input.dataset.score; const row = Number(input.dataset.row); const index = Number(input.dataset.index);
      const sanitized = sanitizeScoreValue(input.value);
      if (sanitized !== input.value) input.value = sanitized;
      currentPeriod().roster[row][kind][index] = sanitized; updateLiveSummary(row);
    }
    if (input.dataset.hps) { currentPeriod()[`${input.dataset.hps}Hps`][Number(input.dataset.index)] = input.value; updateAllSummaries(); }
  });

  function initApp() {
    if (sessionStorage.getItem("cstr-class-record-login") === "true") { isDataLoaded = true; currentView = "levels"; }
    render();
  }
  initApp();
})();
