(() => {
  "use strict";

  const { calculateComponent, calculateQuarterlyAssessment, calculateInitialGrade, format, hasRawAboveHps, isAttendanceCode } = window.CSTRGrading;
  const LOGIN_PASSWORD = "harty342002";
  const GIST_ID_KEY = "cstr-class-record-gist-id";
  const GIST_TOKEN_KEY = "cstr-class-record-pat";
  const app = document.querySelector("#app");

  // Subject Configurations mapping directly to standard component weights [WW%, PT%, QA%]
  const SUBJECT_CONFIGS = {
    "English": [30, 50, 20],
    "Filipino": [30, 50, 20],
    "Math": [40, 40, 20],
    "Science": [40, 40, 20],
    "Araling Panlipunan": [30, 50, 20]
  };

  const registry = [
    { id: "g8-alfonso", group: "JHS", level: "Grade 8", subject: "Science", weights: [40, 40, 20], theme: "purple", accent: "purple", rosterSize: 42 },
    { id: "g8-john", group: "JHS", level: "Grade 8", subject: "Science", weights: [40, 40, 20], theme: "green", accent: "green", rosterSize: 42 },
    { id: "g8-pedro", group: "JHS", level: "Grade 8", subject: "Science", weights: [40, 40, 20], theme: "blue", accent: "blue", rosterSize: 42 },
    { id: "g9-ezekiel", group: "JHS", level: "Grade 9", subject: "Science", weights: [40, 40, 20], theme: "red", accent: "red", rosterSize: 42 },
    { id: "g11-physics-carmel", group: "SHS", level: "Grade 11", subject: "Science", weights: [40, 40, 20], theme: "blue", accent: "charcoal", rosterSize: 42 },
    { id: "g11-general-carmel", group: "SHS", level: "Grade 11", subject: "Science", weights: [40, 40, 20], theme: "blue", accent: "baby-blue", rosterSize: 42 },
    { id: "g11-consolacion", group: "SHS", level: "Grade 11", subject: "Science", weights: [40, 40, 20], theme: "blue", accent: "deep-red", rosterSize: 42 }
  ];

  let currentView = "home";
  let activeGroup = "JHS";
  let activeSectionId = registry[0].id;
  let activePeriodIndex = 0;
  let state = createInitialState();

  let isDataLoaded = false;
  let isLoading = false;
  let selectionState = { active: false, startRow: null, startCol: null, endRow: null, endCol: null };

  function emptyRoster(size, wwLen = 10, ptLen = 8, qaLen = 3) {
    return Array.from({ length: size }, () => ({ name: "", ww: Array(wwLen).fill(""), pt: Array(ptLen).fill(""), qa: Array(qaLen).fill("") }));
  }

  function initialPeriod(section) {
    return {
      name: section.group === "JHS" ? "1st Grading" : "1st Quarter, 1st Semester",
      wwDates: Array(10).fill(""), ptDates: Array(8).fill(""), qaDates: Array(3).fill(""),
      wwHps: Array(10).fill(""), ptHps: Array(8).fill(""), qaHps: Array(3).fill(""),
      roster: emptyRoster(section.rosterSize, 10, 8, 3)
    };
  }

  function createInitialState() {
    return {
      version: 2,
      photo: "",
      sections: Object.fromEntries(registry.map((section) => [section.id, { 
        subject: section.subject, weights: [...section.weights], periods: [initialPeriod(section)] 
      }]))
    };
  }

  function normalizeState(saved) {
    const base = createInitialState();
    if (!saved || typeof saved !== "object") return base;
    base.photo = typeof saved.photo === "string" ? saved.photo : "";
    registry.forEach((section) => {
      const loaded = saved.sections && saved.sections[section.id];
      if (!loaded || !Array.isArray(loaded.periods) || !loaded.periods.length) return;
      
      // Migrate subject configs
      if (loaded.subject) base.sections[section.id].subject = loaded.subject;
      if (loaded.weights) base.sections[section.id].weights = [...loaded.weights];

      base.sections[section.id].periods = loaded.periods.map((period) => {
        const wwLen = Array.isArray(period.wwDates) ? Math.max(1, period.wwDates.length) : 10;
        const ptLen = Array.isArray(period.ptDates) ? Math.max(1, period.ptDates.length) : 8;
        const qaLen = Array.isArray(period.qaDates) ? Math.max(1, period.qaDates.length) : 3;

        return {
          name: typeof period.name === "string" && period.name.trim() ? period.name : initialPeriod(section).name,
          wwDates: fitArray(period.wwDates, wwLen), ptDates: fitArray(period.ptDates, ptLen), qaDates: fitArray(period.qaDates, qaLen),
          wwHps: fitArray(period.wwHps, wwLen), ptHps: fitArray(period.ptHps, ptLen), qaHps: fitArray(period.qaHps, qaLen),
          roster: Array.from({ length: section.rosterSize }, (_, index) => {
            const learner = Array.isArray(period.roster) ? period.roster[index] : null;
            return {
              name: learner && typeof learner.name === "string" ? learner.name : "",
              ww: fitArray(learner && learner.ww, wwLen), pt: fitArray(learner && learner.pt, ptLen), qa: fitArray(learner && learner.qa, qaLen)
            };
          })
        };
      });
    });
    return base;
  }

  function fitArray(values, length) {
    return Array.from({ length }, (_, index) => Array.isArray(values) && values[index] !== undefined ? values[index] : "");
  }

  function currentSectionConfig() { return state.sections[activeSectionId]; }
  function currentSection() { return registry.find((s) => s.id === activeSectionId) || registry[0]; }
  function currentPeriod() { return currentSectionConfig().periods[activePeriodIndex]; }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }
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
      if (!name) return ""; if (getLearnerCategory(name)) return "—"; count += 1; return count;
    });
    return { numbering, totalLearners: count };
  }

  function updateAllNumberingAndCounts() {
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
    const period = currentPeriod();
    if (!period || !period.roster) return;
    let maxLen = 14;
    period.roster.forEach((learner) => {
      const len = (learner.name || "").length; if (len > maxLen) maxLen = len;
    });
    document.querySelectorAll(".name-cell input").forEach((input) => { if (input.value.length > maxLen) maxLen = input.value.length; });
    const newWidth = Math.max(180, Math.ceil(maxLen * 8.8 + 36));
    document.documentElement.style.setProperty("--name-col-width", `${newWidth}px`);
  }

  function updateHeaderScroll() {
    const header = document.querySelector(".app-header");
    if (header) header.classList.toggle("header-shrunk", window.scrollY > 30);
  }

  window.addEventListener("scroll", updateHeaderScroll, { passive: true });

  function sanitizeScoreValue(raw) {
    if (raw === "" || raw === null || raw === undefined) return "";
    const trimmed = String(raw).trim().toUpperCase();
    if (trimmed === "A" || trimmed === "E" || trimmed === "L") return trimmed;
    const numeric = trimmed.replace(/[^0-9.]/g, "");
    const firstDot = numeric.indexOf(".");
    if (firstDot === -1) return numeric;
    return numeric.slice(0, firstDot + 1) + numeric.slice(firstDot + 1).replace(/\./g, "");
  }

  function render() {
    app.innerHTML = sessionStorage.getItem("cstr-class-record-login") === "true" ? renderApp() : renderLogin();
    syncSaveControl(); adjustNameColumnWidth(); updateAllNumberingAndCounts(); updateHeaderScroll();
  }

  function renderLogin() {
    return `<section class="login-screen"><div class="card">
      <p class="eyebrow">CSTR Class Record</p><h1>Owner login</h1>
      <p class="muted">This convenience gate is for the class-record owner.</p>
      <label class="field-label">Password<input id="loginPassword" type="password" autocomplete="current-password" required></label>
      ${button("Login", "login", "button button-primary")}
      <p id="loginError" class="login-error" role="alert"></p>
    </div></section>`;
  }

  function renderApp() {
    const content = currentView === "home" ? renderHome() : currentView === "chooser" ? renderClassRecord() : renderSectionRecord();
    return `<header class="app-header"><div class="app-header-inner">
      <div class="app-header-brand">
        <span class="header-logo"><img src="ASSETS/cstr-logo.png" alt="Colegio de Sto. Tomás – Recoletos crest"></span>
        <div><p class="eyebrow">CSTR • San Carlos City, Negros Occidental</p>
        <h1 class="app-title">Colegio de Sto. Tomás – Recoletos, Incorporated</h1>
        <p class="muted">Website for Class Record, with respect to DepEd Order No. 15, s. 2026.</p></div>
      </div>
      <div class="header-actions-wrap">
        <div class="header-actions">${button("💾 Save Changes", "save-changes", "button button-primary", `id="saveChanges"`)} ${button("Settings", "open-settings")} ${button("Log out", "logout")}</div>
        <p id="statusMessage" class="save-status" role="status" aria-live="polite"></p>
      </div>
    </div></header>
    <div class="search-bar"><div class="search-bar-inner">
      <div class="header-search" role="search"><input id="studentSearch" type="search" autocomplete="off" placeholder="Search student's full name"><button type="button" class="button" data-action="search-student">Search</button></div>
    </div></div>
    <div class="app-shell"><nav class="tabs"><button class="tab" type="button" data-action="go-home" aria-selected="${currentView === "home"}">Home</button><button class="tab" type="button" data-action="go-records" aria-selected="${currentView === "chooser" || currentView === "record"}">Class Record</button></nav>${content}</div>`;
  }

  function renderHome() {
    const portrait = state.photo ? `<img class="profile-photo" src="${state.photo}" alt="Teacher portrait">` : `<span class="silhouette"></span><span class="photo-caption">Upload photo</span>`;
    return `<section class="home-grid"><div><input id="photoInput" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" hidden>
      <button class="photo-frame" type="button" data-action="choose-photo">${portrait}</button></div>
      <div><p class="eyebrow">Class record owner</p><p class="teacher-block">Class record by full-time faculty member, Junior High School Science and Research teacher, Senior High School Physics and General Science teacher and Research adviser — <strong>RAMELITO JR. C. SANCHEZ, LPT.</strong></p>
      <div class="home-cta">${button("Proceed to Class Record →", "go-records", "button button-primary")}</div></div></section>`;
  }

  function renderClassRecord() {
    const edge = (group) => group === "JHS" ? `<span class="level-edge edge-green"></span><span class="level-edge edge-yellow"></span><span class="level-edge edge-red"></span><span class="level-edge edge-blue"></span>` : `<span class="level-edge edge-charcoal"></span><span class="level-edge edge-baby-blue"></span><span class="level-edge edge-deep-red"></span>`;
    const groupCards = ["JHS", "SHS"].map((group) => `<button type="button" class="level-card level-card-${group.toLowerCase()} ${activeGroup === group ? "is-active" : ""}" data-action="select-group" data-group="${group}">${edge(group)}<span class="level-card-kicker">${group}</span><strong>${group === "JHS" ? "Junior High School" : "Senior High School"}</strong><small>Choose a level to view its sections</small></button>`).join("");
    const sections = registry.filter((section) => section.group === activeGroup);
    const sectionCards = sections.map((section) => `<button type="button" class="section-card accent-${section.accent}" data-action="select-section" data-section="${section.id}"><span>${escapeHtml(section.level)}</span><strong>${escapeHtml(state.sections[section.id].subject)}</strong><small>Open grade sheet</small></button>`).join("");
    return `<section class="record-chooser"><div class="section-heading"><div><p class="eyebrow">Class Record</p><h2>Select a level and section</h2></div></div><div class="level-grid">${groupCards}</div><div class="chooser-divider"><span>${activeGroup === "JHS" ? "Junior High School sections" : "Senior High School sections"}</span></div><div class="section-card-grid">${sectionCards}</div></section>`;
  }

  function renderSectionRecord() {
    const section = currentSection();
    const config = currentSectionConfig();
    const periods = config.periods;
    if (activePeriodIndex >= periods.length) activePeriodIndex = 0;
    const period = currentPeriod();
    const { totalLearners } = computeLearnerNumbering(period.roster);
    const periodTabs = periods.map((entry, index) => `<button type="button" class="tab theme-${section.theme}" data-action="select-period" data-period="${index}" aria-selected="${activePeriodIndex === index}">${escapeHtml(entry.name)}</button>`).join("");
    
    // Subject Selector Generation
    const subjectOptions = Object.keys(SUBJECT_CONFIGS).map(subj => `<option value="${subj}" ${config.subject === subj ? 'selected' : ''}>${subj}</option>`).join("");
    
    return `<div class="record-section"><div class="record-back">${button("← Back to sections", "go-records")}</div>
      <div class="section-heading"><div>
        <div class="section-title-wrap">
          <h2>${escapeHtml(section.level)}</h2>
          <select class="subject-dropdown" id="subjectSelector">${subjectOptions}</select>
          <span id="liveLearnerCount" class="learner-count-badge">${totalLearners} Learner${totalLearners === 1 ? "" : "s"}</span>
        </div>
        <div class="record-meta"><span>Weights: <strong>${config.weights.join(" / ")}</strong></span><span>Capacity: <strong>${section.rosterSize}</strong></span></div>
      </div></div>
      <div class="period-tabs">${periodTabs}</div>
      <div class="period-toolbar"><label for="periodName">Period name</label><input id="periodName" class="period-name" value="${safeValue(period.name)}" data-period-name>
      ${button("+ Add Grading Period", "add-period", "button button-yellow")}</div>
      <p class="paste-hint"><strong>Tip:</strong> You can add or remove columns for WW, PT, and QA directly from their headers. Changing subjects automatically updates internal weights.</p>
      ${renderRecordTable(section, config, period)}</div>`;
  }

  function renderRecordTable(section, config, period) {
    const renderHeaders = (kind, values) => values.map((value, index) => {
      const borderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      return `<th scope="col" class="activity-date-cell ${borderClass}"><input class="activity-date" type="text" maxlength="12" placeholder="Date" data-date="${kind}" data-index="${index}" value="${safeValue(value)}"></th>`;
    }).join("");
    const renderHps = (kind, values) => values.map((value, index) => {
      const borderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      return `<td class="${borderClass}"><input type="number" min="0" step="any" inputmode="decimal" data-hps="${kind}" data-index="${index}" value="${safeValue(value)}"></td>`;
    }).join("");
    const { numbering } = computeLearnerNumbering(period.roster);
    const rows = period.roster.map((learner, rowIndex) => renderLearnerRow(learner, rowIndex, period, config, numbering[rowIndex])).join("");
    
    const wwLen = period.wwDates.length;
    const ptLen = period.ptDates.length;
    const qaLen = period.qaDates.length;

    const controlBtns = (kind) => `<div class="col-controls"><button type="button" class="col-btn" data-action="add-col" data-kind="${kind}">+</button><button type="button" class="col-btn" data-action="del-col" data-kind="${kind}">-</button></div>`;

    return `<div class="table-wrap"><table class="record-table compact-record"><thead>
      <tr class="component-row"><th class="number-cell" scope="col" rowspan="3">#</th><th class="name-cell" scope="col" rowspan="3">Learner name</th><th class="component-header component-ww" scope="colgroup" colspan="${wwLen + 3}">Written Works (${config.weights[0]}%) ${controlBtns('ww')}</th><th class="component-header component-pt border-start-pt" scope="colgroup" colspan="${ptLen + 3}">Performance Tasks (${config.weights[1]}%) ${controlBtns('pt')}</th><th class="component-header component-qa border-start-qa" scope="colgroup" colspan="${qaLen + 3}">Quarterly Assessment (${config.weights[2]}%) ${controlBtns('qa')}</th><th class="initial-header" scope="col" rowspan="3">Initial<br>Grade</th></tr>
      <tr class="activity-row">${renderHeaders("ww", period.wwDates)}<th class="component-summary component-ww" scope="col">Total WW</th><th class="component-summary component-ww" scope="col">PS</th><th class="component-summary component-ww" scope="col">WS<br>(${config.weights[0]}%)</th>${renderHeaders("pt", period.ptDates)}<th class="component-summary component-pt" scope="col">Total PT</th><th class="component-summary component-pt" scope="col">PS</th><th class="component-summary component-pt" scope="col">WS<br>(${config.weights[1]}%)</th>${renderHeaders("qa", period.qaDates)}<th class="component-summary component-qa" scope="col">Total QA</th><th class="component-summary component-qa" scope="col">PS</th><th class="component-summary component-qa" scope="col">WS<br>(${config.weights[2]}%)</th></tr>
      <tr class="hps-row"><th colspan="${wwLen}" scope="row">Highest Possible Scores</th><th class="component-summary component-ww">Raw / HPS</th><th class="component-summary component-ww">Percentage</th><th class="component-summary component-ww">Weighted</th><th colspan="${ptLen}" scope="row" class="border-start-pt">Highest Possible Scores</th><th class="component-summary component-pt">Raw / HPS</th><th class="component-summary component-pt">Percentage</th><th class="component-summary component-pt">Weighted</th><th colspan="${qaLen}" scope="row" class="border-start-qa">Highest Possible Scores</th><th class="component-summary component-qa">Raw / HPS</th><th class="component-summary component-qa">Percentage</th><th class="component-summary component-qa">Weighted</th></tr>
      <tr class="hps-input-row"><th colspan="2" scope="row">Enter HPS</th>${renderHps("ww", period.wwHps)}<td colspan="3">&nbsp;</td>${renderHps("pt", period.ptHps)}<td colspan="3">&nbsp;</td>${renderHps("qa", period.qaHps)}<td colspan="3">&nbsp;</td><td>&nbsp;</td></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderLearnerRow(learner, rowIndex, period, config, numDisplay) {
    const cat = getLearnerCategory(learner.name);
    const catClass = cat ? `row-category row-category-${cat}` : "";

    const renderScores = (kind, values, hpsValues) => values.map((value, index) => {
      const tdBorderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      const inputClasses = [hasRawAboveHps(value, hpsValues[index]) ? "invalid" : "", isAttendanceCode(value) ? "code-cell" : ""].filter(Boolean).join(" ");
      return `<td class="${tdBorderClass}"><input class="${inputClasses}" type="text" maxlength="6" autocomplete="off" data-score="${kind}" data-row="${rowIndex}" data-index="${index}" value="${safeValue(cat ? "" : value)}" ${cat ? 'disabled tabindex="-1"' : ''}></td>`;
    }).join("");
    const result = learnerResult(learner, period, config.weights);
    return `<tr class="${catClass}" data-learner-row="${rowIndex}"><th class="number-cell" scope="row">${numDisplay !== undefined ? numDisplay : ""}</th><td class="name-cell"><input class="text-input" data-name-row="${rowIndex}" value="${safeValue(learner.name)}"></td>${renderScores("ww", learner.ww, period.wwHps)}${summaryCells(result, "ww")}${renderScores("pt", learner.pt, period.ptHps)}${summaryCells(result, "pt")}${renderScores("qa", learner.qa, period.qaHps)}${summaryCells(result, "qa")}<td class="summary-cell initial-cell summary-initial">${format(result.initial.rounded, 0)}</td></tr>`;
  }

  function learnerResult(learner, period, weights) {
    const ww = calculateComponent(learner.ww, period.wwHps, weights[0]);
    const pt = calculateComponent(learner.pt, period.ptHps, weights[1]);
    const qa = calculateQuarterlyAssessment(learner.qa, period.qaHps, weights[2]);
    return { ww, pt, qa, initial: calculateInitialGrade(ww, pt, qa) };
  }

  function formatScore(value) { return !Number.isFinite(value) ? "—" : (Number.isInteger(value) ? String(value) : value.toFixed(2)); }
  function scoreTotal(comp) { return comp.used ? `${formatScore(comp.rawTotal)} / ${formatScore(comp.hpsTotal)}` : "—"; }
  function summaryCells(result, kind) {
    const comp = result[kind];
    return `<td class="summary-cell summary-${kind}-total">${scoreTotal(comp)}</td><td class="summary-cell summary-${kind}-ps">${format(comp.percentage, 2)}</td><td class="summary-cell summary-${kind}-ws">${format(comp.weighted, 2)}</td>`;
  }

  function addPeriod() {
    const config = currentSectionConfig();
    const period = initialPeriod(currentSection());
    period.name = `Grading Period ${config.periods.length + 1}`;
    config.periods.push(period);
    activePeriodIndex = config.periods.length - 1;
    render();
  }

  function updateLiveSummary(rowIndex) {
    const period = currentPeriod();
    const config = currentSectionConfig();
    const learner = period.roster[rowIndex];
    const row = document.querySelector(`[data-learner-row="${rowIndex}"]`);
    if (!row) return;
    const result = learnerResult(learner, period, config.weights);
    row.querySelector(".summary-ww-total").textContent = scoreTotal(result.ww);
    row.querySelector(".summary-ww-ps").textContent = format(result.ww.percentage, 2);
    row.querySelector(".summary-ww-ws").textContent = format(result.ww.weighted, 2);
    row.querySelector(".summary-pt-total").textContent = scoreTotal(result.pt);
    row.querySelector(".summary-pt-ps").textContent = format(result.pt.percentage, 2);
    row.querySelector(".summary-pt-ws").textContent = format(result.pt.weighted, 2);
    row.querySelector(".summary-qa-total").textContent = scoreTotal(result.qa);
    row.querySelector(".summary-qa-ps").textContent = format(result.qa.percentage, 2);
    row.querySelector(".summary-qa-ws").textContent = format(result.qa.weighted, 2);
    row.querySelector(".summary-initial").textContent = format(result.initial.rounded, 0);
    ["ww", "pt", "qa"].forEach((kind) => row.querySelectorAll(`[data-score="${kind}"]`).forEach((input) => {
      const index = Number(input.dataset.index);
      input.classList.toggle("invalid", hasRawAboveHps(learner[kind][index], period[`${kind}Hps`][index]));
      input.classList.toggle("code-cell", isAttendanceCode(learner[kind][index]));
    }));
  }

  function updateAllSummaries() { currentPeriod().roster.forEach((_, i) => updateLiveSummary(i)); }

  function setStatus(message, type = "") {
    const status = document.querySelector("#statusMessage");
    if (status) { status.textContent = message; status.className = `save-status ${type}`; }
    const btn = document.querySelector("#saveChanges");
    if (btn) { btn.classList.toggle("saving", type === "saving"); btn.classList.toggle("error", type === "error"); }
  }

  function syncSaveControl() {
    const btn = document.querySelector("#saveChanges");
    if (!btn) return;
    const hasCreds = Boolean(localStorage.getItem(GIST_ID_KEY) && localStorage.getItem(GIST_TOKEN_KEY));
    if (!hasCreds) { btn.disabled = false; setStatus("Add Settings to enable sync."); }
    else if (isLoading) { btn.disabled = true; setStatus("Syncing...", "saving"); }
    else if (!isDataLoaded) { btn.disabled = true; setStatus("⚠️ DATA LOCKED: Load first.", "error"); }
    else { btn.disabled = false; setStatus("Ready to save. ✓"); }
  }

  async function saveToGist() {
    if (sessionStorage.getItem("cstr-class-record-login") !== "true") return;
    const gistId = localStorage.getItem(GIST_ID_KEY); const token = localStorage.getItem(GIST_TOKEN_KEY);
    if (!gistId || !token) return;
    if (!isDataLoaded) return;
    setStatus("Saving...", "saving");
    try {
      const getResponse = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, { headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}` }, cache: "no-store" });
      const existingGist = await getResponse.json();
      const existingFile = existingGist.files["cstr-class-record-data.json"] || Object.values(existingGist.files)[0];
      const existingContent = existingFile ? (existingFile.truncated ? await (await fetch(existingFile.raw_url, { headers: { "Authorization": `Bearer ${token}` }, cache: "no-store" })).text() : existingFile.content) : "{}";
      let allUsersData; try { allUsersData = JSON.parse(existingContent || "{}"); } catch(e) { allUsersData = {}; }
      allUsersData[LOGIN_PASSWORD] = state;
      const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, { method: "PATCH", headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ files: { "cstr-class-record-data.json": { content: JSON.stringify(allUsersData) } } }) });
      if (!response.ok) throw new Error(`${response.status}`);
      setStatus("Saved ✓");
    } catch (e) { setStatus(`Error: ${e.message}`, "error"); }
  }

  async function loadFromGist() {
    const gistId = localStorage.getItem(GIST_ID_KEY); const token = localStorage.getItem(GIST_TOKEN_KEY);
    if (!gistId || !token) return;
    isLoading = true; syncSaveControl(); setStatus("Loading...", "saving");
    try {
      const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, { headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}` }, cache: "no-store" });
      const gist = await response.json(); const file = gist.files["cstr-class-record-data.json"] || Object.values(gist.files)[0];
      const content = file.truncated ? await (await fetch(file.raw_url, { headers: { "Authorization": `Bearer ${token}` }, cache: "no-store" })).text() : file.content;
      const parsed = JSON.parse(content || "{}");
      state = normalizeState(parsed[LOGIN_PASSWORD] || parsed);
      activePeriodIndex = 0; isDataLoaded = true; isLoading = false;
      render(); setStatus("Loaded ✓");
    } catch (e) { isLoading = false; isDataLoaded = false; render(); setStatus("Load Error", "error"); }
  }

  function fieldStartColumn(target) {
    if (target.dataset.nameRow !== undefined) return 0;
    const p = currentPeriod();
    const idx = Number(target.dataset.index);
    if (target.dataset.score === "ww") return 1 + idx;
    if (target.dataset.score === "pt") return 1 + p.wwDates.length + idx;
    if (target.dataset.score === "qa") return 1 + p.wwDates.length + p.ptDates.length + idx;
    return null;
  }

  function getCellCoords(input) {
    const row = Number(input.dataset.nameRow !== undefined ? input.dataset.nameRow : input.dataset.row);
    const col = fieldStartColumn(input);
    return (Number.isFinite(row) && col !== null) ? { row, col } : null;
  }

  function getSelectionBounds() {
    if (!selectionState.active && selectionState.startRow === null) return null;
    return { minRow: Math.min(selectionState.startRow, selectionState.endRow), maxRow: Math.max(selectionState.startRow, selectionState.endRow), minCol: Math.min(selectionState.startCol, selectionState.endCol), maxCol: Math.max(selectionState.startCol, selectionState.endCol) };
  }

  function highlightSelection() {
    const bounds = getSelectionBounds();
    document.querySelectorAll(".record-table tbody input").forEach((input) => {
      const coords = getCellCoords(input);
      if (!coords || !bounds) { input.classList.remove("cell-selected"); return; }
      input.classList.toggle("cell-selected", coords.row >= bounds.minRow && coords.row <= bounds.maxRow && coords.col >= bounds.minCol && coords.col <= bounds.maxCol && (bounds.minRow !== bounds.maxRow || bounds.minCol !== bounds.maxCol));
    });
  }

  function clearSelection() {
    selectionState = { active: false, startRow: null, startCol: null, endRow: null, endCol: null };
    document.querySelectorAll(".cell-selected").forEach((el) => el.classList.remove("cell-selected"));
  }

  app.addEventListener("mousedown", (e) => {
    const input = e.target.closest(".record-table tbody input");
    if (!input || e.button !== 0) { if (!e.target.closest(".record-table tbody")) clearSelection(); return; }
    const coords = getCellCoords(input); if (!coords) return;
    selectionState.active = true; selectionState.startRow = selectionState.endRow = coords.row; selectionState.startCol = selectionState.endCol = coords.col; highlightSelection();
  });
  app.addEventListener("mouseover", (e) => {
    if (!selectionState.active || e.buttons !== 1) return;
    const coords = getCellCoords(e.target.closest(".record-table tbody input")); if (!coords) return;
    selectionState.endRow = coords.row; selectionState.endCol = coords.col; highlightSelection();
  });
  document.addEventListener("mouseup", () => { selectionState.active = false; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearSelection();
    const bounds = getSelectionBounds(); if (!bounds || (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol)) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(); const p = currentPeriod();
      for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
          if (c === 0) p.roster[r].name = "";
          else if (c <= p.wwDates.length) p.roster[r].ww[c - 1] = "";
          else if (c <= p.wwDates.length + p.ptDates.length) p.roster[r].pt[c - 1 - p.wwDates.length] = "";
          else p.roster[r].qa[c - 1 - p.wwDates.length - p.ptDates.length] = "";
        }
      }
      render(); setStatus("Cleared block.");
    }
  });

  app.addEventListener("change", (e) => {
    if (e.target.id === "subjectSelector") {
      const newSubject = e.target.value;
      const config = currentSectionConfig();
      config.subject = newSubject;
      if (SUBJECT_CONFIGS[newSubject]) config.weights = [...SUBJECT_CONFIGS[newSubject]];
      render();
    }
  });

  app.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]"); if (!target) return;
    const action = target.dataset.action;
    
    // Dynamic Columns +/-
    if (action === "add-col") {
      const kind = target.dataset.kind;
      const period = currentPeriod();
      period[`${kind}Dates`].push(""); period[`${kind}Hps`].push("");
      period.roster.forEach(l => l[kind].push(""));
      render(); return;
    }
    if (action === "del-col") {
      const kind = target.dataset.kind;
      const period = currentPeriod();
      if (period[`${kind}Dates`].length > 1) {
        period[`${kind}Dates`].pop(); period[`${kind}Hps`].pop();
        period.roster.forEach(l => l[kind].pop());
        render();
      }
      return;
    }

    if (action === "login") { if (document.querySelector("#loginPassword").value === LOGIN_PASSWORD) { sessionStorage.setItem("cstr-class-record-login", "true"); render(); if (localStorage.getItem(GIST_ID_KEY)) loadFromGist(); else { isDataLoaded = true; syncSaveControl(); } } }
    if (action === "logout") { sessionStorage.removeItem("cstr-class-record-login"); currentView = "home"; render(); }
    if (action === "go-home") { currentView = "home"; render(); }
    if (action === "go-records") { currentView = "chooser"; render(); }
    if (action === "select-group") { activeGroup = target.dataset.group; activeSectionId = registry.find(s => s.group === activeGroup).id; activePeriodIndex = 0; currentView = "chooser"; render(); }
    if (action === "select-section") { activeSectionId = target.dataset.section; activeGroup = currentSection().group; activePeriodIndex = 0; currentView = "record"; render(); }
    if (action === "select-period") { activePeriodIndex = Number(target.dataset.period); render(); }
    if (action === "add-period") addPeriod();
    if (action === "save-changes") saveToGist();
  });

  app.addEventListener("input", (e) => {
    const input = e.target;
    if (input.dataset.nameRow !== undefined) {
      const row = Number(input.dataset.nameRow); const l = currentPeriod().roster[row]; l.name = input.value;
      if (getLearnerCategory(l.name)) { l.ww.fill(""); l.pt.fill(""); l.qa.fill(""); render(); } else { updateLiveSummary(row); updateAllNumberingAndCounts(); }
      adjustNameColumnWidth();
    }
    if (input.dataset.periodName !== undefined) currentPeriod().name = input.value;
    if (input.dataset.date) currentPeriod()[`${input.dataset.date}Dates`][Number(input.dataset.index)] = input.value;
    if (input.dataset.score) {
      const kind = input.dataset.score; const r = Number(input.dataset.row); const i = Number(input.dataset.index);
      const val = sanitizeScoreValue(input.value); if (val !== input.value) input.value = val;
      currentPeriod().roster[r][kind][i] = val; updateLiveSummary(r);
    }
    if (input.dataset.hps) { currentPeriod()[`${input.dataset.hps}Hps`][Number(input.dataset.index)] = input.value; updateAllSummaries(); }
  });

  function applyBulkPaste(startRow, startCol, text) {
    const period = currentPeriod();
    if (!Number.isFinite(startRow) || startCol === null) return;
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
    const wwLen = period.wwDates.length; const ptLen = period.ptDates.length; const qaLen = period.qaDates.length;
    let rowsFilled = 0; let truncated = false;
    lines.forEach((line, off) => {
      const r = startRow + off; if (r >= period.roster.length) { truncated = true; return; }
      line.split("\t").forEach((val, cOff) => {
        const c = startCol + cOff; const v = sanitizeScoreValue(val.trim());
        if (c >= 1 + wwLen + ptLen + qaLen) { truncated = true; return; }
        if (c === 0) period.roster[r].name = val.trim();
        else if (c <= wwLen) period.roster[r].ww[c - 1] = v;
        else if (c <= wwLen + ptLen) period.roster[r].pt[c - 1 - wwLen] = v;
        else period.roster[r].qa[c - 1 - wwLen - ptLen] = v;
      });
      rowsFilled++;
    });
    period.roster.forEach(l => { if (getLearnerCategory(l.name)) { l.ww.fill(""); l.pt.fill(""); l.qa.fill(""); } });
    clearSelection(); render(); setStatus(`Pasted ${rowsFilled} rows.${truncated ? " (Some data skipped)" : ""}`);
  }

  app.addEventListener("paste", (e) => {
    const target = e.target; if (!target.dataset.nameRow && !target.dataset.score && !selectionState.active) return;
    const text = (e.clipboardData || window.clipboardData).getData("text"); if (!text || !/[\t\n]/.test(text)) return;
    e.preventDefault(); const bounds = getSelectionBounds();
    applyBulkPaste(bounds ? bounds.minRow : getCellCoords(target).row, bounds ? bounds.minCol : getCellCoords(target).col, text);
  });

  function initApp() { render(); if (sessionStorage.getItem("cstr-class-record-login") === "true") { if (localStorage.getItem(GIST_ID_KEY)) loadFromGist(); else { isDataLoaded = true; syncSaveControl(); } } }
  initApp();
})();
