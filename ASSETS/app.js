(() => {
  "use strict";

  const { calculateComponent, calculateQuarterlyAssessment, calculateInitialGrade, format, hasRawAboveHps, isAttendanceCode } = window.CSTRGrading;
  const VALID_PASSWORDS = ["harty342002", "maamsamcstr1234"];
  const GIST_ID_KEY = "cstr-class-record-gist-id";
  const GIST_TOKEN_KEY = "cstr-class-record-pat";
  const app = document.querySelector("#app");

  const registry = [
    { id: "g8-alfonso", group: "JHS", level: "Grade 8", subject: "Science - Saint Alfonso de Orozco", theme: "purple", accent: "purple", rosterSize: 42 },
    { id: "g8-john", group: "JHS", level: "Grade 8", subject: "Science - Saint John Stone", theme: "green", accent: "green", rosterSize: 42 },
    { id: "g8-pedro", group: "JHS", level: "Grade 8", subject: "Science - Saint Pedro Calungsod", theme: "blue", accent: "blue", rosterSize: 42 },
    { id: "g9-ezekiel", group: "JHS", level: "Grade 9", subject: "ICL-Research III - Saint Ezekiel Moreno", theme: "red", accent: "red", rosterSize: 42 },
    { id: "g11-physics-carmel", group: "SHS", level: "Grade 11", subject: "Physics 1 - Our Lady of Mount Carmel", theme: "blue", accent: "charcoal", rosterSize: 42 },
    { id: "g11-general-carmel", group: "SHS", level: "Grade 11", subject: "General Science 11 - Our Lady of Mount Carmel", theme: "blue", accent: "baby-blue", rosterSize: 42 },
    { id: "g11-consolacion", group: "SHS", level: "Grade 11", subject: "General Science 11 - Our Lady of Consolacion", theme: "blue", accent: "deep-red", rosterSize: 42 }
  ];

  const DEFAULT_SUBJECT = "SCIENCE";
  const SUBJECT_WEIGHTS = {
    ENGLISH: { ww: 20, pt: 50, qa: 30, qaIntra: [0.30, 0.30, 0.40] },
    MATHEMATICS: { ww: 20, pt: 50, qa: 30, qaIntra: [0.30, 0.30, 0.40] },
    SCIENCE: { ww: 20, pt: 50, qa: 30, qaIntra: [0.30, 0.30, 0.40] },
    FILIPINO: { ww: 20, pt: 50, qa: 30, qaIntra: [0.30, 0.30, 0.40] },
    "ARALING PANLIPUNAN": { ww: 20, pt: 50, qa: 30, qaIntra: [0.30, 0.30, 0.40] },
    MAPEH: { ww: 20, pt: 50, qa: 30, qaIntra: [0.30, 0.30, 0.40] }
  };
  const SUBJECT_OPTIONS = Object.keys(SUBJECT_WEIGHTS);

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
      wwDates: Array(10).fill(""),
      ptDates: Array(8).fill(""),
      qaDates: Array(3).fill(""),
      wwHps: Array(10).fill(""),
      ptHps: Array(8).fill(""),
      qaHps: Array(3).fill(""),
      roster: emptyRoster(section.rosterSize, 10, 8, 3)
    };
  }

  function createInitialState() {
    return {
      version: 1,
      photo: "",
      sections: Object.fromEntries(registry.map((section) => [section.id, { subject: DEFAULT_SUBJECT, periods: [initialPeriod(section)] }]))
    };
  }

  function currentWeights(section) {
    const subject = (state.sections[section.id] && state.sections[section.id].subject) || DEFAULT_SUBJECT;
    return SUBJECT_WEIGHTS[subject] || SUBJECT_WEIGHTS[DEFAULT_SUBJECT];
  }

  function normalizeState(saved) {
    const base = createInitialState();
    if (!saved || typeof saved !== "object") return base;
    base.photo = typeof saved.photo === "string" ? saved.photo : "";
    registry.forEach((section) => {
      const loaded = saved.sections && saved.sections[section.id];
      if (!loaded) return;
      base.sections[section.id].subject = SUBJECT_OPTIONS.includes(loaded.subject) ? loaded.subject : DEFAULT_SUBJECT;
      base.sections[section.id].level = loaded.level;
      base.sections[section.id].customSubject = loaded.customSubject;
      base.sections[section.id].theme = loaded.theme;
      base.sections[section.id].accent = loaded.accent;

      if (!Array.isArray(loaded.periods) || !loaded.periods.length) return;
      
      base.sections[section.id].periods = loaded.periods.map((period) => {
        // Dynamic Length Safety Protocol (Prevents Data Wipe on Load)
        const wwLen = Array.isArray(period.wwDates) ? Math.max(period.wwDates.length, 1) : 10;
        const ptLen = Array.isArray(period.ptDates) ? Math.max(period.ptDates.length, 1) : 8;
        const qaLen = Array.isArray(period.qaDates) ? Math.max(period.qaDates.length, 1) : 3;

        return {
          name: typeof period.name === "string" && period.name.trim() ? period.name : initialPeriod(section).name,
          wwDates: fitArray(period.wwDates, wwLen),
          ptDates: fitArray(period.ptDates, ptLen),
          qaDates: fitArray(period.qaDates, qaLen),
          wwHps: fitArray(period.wwHps, wwLen),
          ptHps: fitArray(period.ptHps, ptLen),
          qaHps: fitArray(period.qaHps, qaLen),
          roster: Array.from({ length: section.rosterSize }, (_, index) => {
            const learner = Array.isArray(period.roster) ? period.roster[index] : null;
            return {
              name: learner && typeof learner.name === "string" ? learner.name : "",
              ww: fitArray(learner && learner.ww, wwLen),
              pt: fitArray(learner && learner.pt, ptLen),
              qa: fitArray(learner && learner.qa, qaLen)
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

  function currentSection() { return registry.find((section) => section.id === activeSectionId) || registry[0]; }
  function currentPeriod() { return state.sections[activeSectionId].periods[activePeriodIndex]; }
  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
  function safeValue(value) { return escapeHtml(value === undefined || value === null ? "" : value); }
  function button(label, action, className = "button", extra = "") { return `<button type="button" class="${className}" data-action="${action}" ${extra}>${label}</button>`; }
  function componentControls(kind) { return `<div class="component-controls"><button type="button" class="ctrl-btn" data-action="add-col" data-kind="${kind}" title="Add column">+</button><button type="button" class="ctrl-btn" data-action="sub-col" data-kind="${kind}" title="Remove column">-</button></div>`; }

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
      const len = (learner.name || "").length;
      if (len > maxLen) maxLen = len;
    });
    document.querySelectorAll(".name-cell input").forEach((input) => {
      if (input.value.length > maxLen) maxLen = input.value.length;
    });
    const newWidth = Math.max(180, Math.ceil(maxLen * 8.8 + 36));
    document.documentElement.style.setProperty("--name-col-width", `${newWidth}px`);
  }

  function updateHeaderScroll() {
    const header = document.querySelector(".app-header");
    if (!header) return;
    if (window.scrollY > 30) header.classList.add("header-shrunk");
    else header.classList.remove("header-shrunk");
  }

  window.addEventListener("scroll", updateHeaderScroll, { passive: true });

  function sanitizeScoreValue(raw) {
    if (raw === "" || raw === null || raw === undefined) return "";
    const trimmed = String(raw).trim();
    const upper = trimmed.toUpperCase();
    if (upper === "A" || upper === "E" || upper === "L") return upper;
    const numeric = trimmed.replace(/[^0-9.]/g, "");
    const firstDot = numeric.indexOf(".");
    if (firstDot === -1) return numeric;
    return numeric.slice(0, firstDot + 1) + numeric.slice(firstDot + 1).replace(/\./g, "");
  }

  function render() {
    app.innerHTML = sessionStorage.getItem("cstr-class-record-login") === "true" ? renderApp() : renderLogin();
    syncSaveControl();
    adjustNameColumnWidth();
    updateAllNumberingAndCounts();
    updateHeaderScroll();
  }

  function renderLogin() {
    return `<section class="login-screen"><div class="card">
      <p class="eyebrow">CSTR Class Record</p><h1>Owner login</h1>
      <p class="muted">This convenience gate is for the class-record owner. It is not a substitute for secure authentication.</p>
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
      <div class="header-search" role="search"><label class="sr-only" for="studentSearch">Search student by full name</label><input id="studentSearch" type="search" autocomplete="off" placeholder="Search student's full name"><button type="button" class="button" data-action="search-student">Search</button></div>
    </div></div>
    <div class="app-shell">
      <nav class="tabs" aria-label="Main navigation">
        <button class="tab" type="button" data-action="go-home" aria-selected="${currentView === "home"}">Home</button>
        <button class="tab" type="button" data-action="go-records" aria-selected="${currentView === "chooser" || currentView === "record"}">Class Record</button>
      </nav>${content}</div>`;
  }

  function renderHome() {
    const portrait = state.photo ? `<img class="profile-photo" src="${state.photo}" alt="Teacher portrait">` : `<span class="silhouette" aria-hidden="true"></span><span class="photo-caption">Upload photo</span>`;
    return `<section class="home-grid"><div><input id="photoInput" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" hidden>
      <button class="photo-frame" type="button" data-action="choose-photo" aria-label="Upload teacher photo">${portrait}</button></div>
      <div><p class="eyebrow">Class record owner</p><p class="teacher-block">Class record by full-time faculty member, Junior High School Science and Research teacher, Senior High School Physics and General Science teacher and Research adviser — <strong>RAMELITO JR. C. SANCHEZ, LPT.</strong></p>
      <div class="home-cta">${button("Proceed to Class Record →", "go-records", "button button-primary")}</div>
      <p id="photoNote" class="form-note">Photo uploads accept PNG and JPEG files only.</p></div></section>`;
  }

  function renderClassRecord() {
    const edge = (group) => group === "JHS" ? `<span class="level-edge edge-green"></span><span class="level-edge edge-yellow"></span><span class="level-edge edge-red"></span><span class="level-edge edge-blue"></span>` : `<span class="level-edge edge-charcoal"></span><span class="level-edge edge-baby-blue"></span><span class="level-edge edge-deep-red"></span>`;
    const groupCards = ["JHS", "SHS"].map((group) => `<button type="button" class="level-card level-card-${group.toLowerCase()} ${activeGroup === group ? "is-active" : ""}" data-action="select-group" data-group="${group}">${edge(group)}<span class="level-card-kicker">${group}</span><strong>${group === "JHS" ? "Junior High School" : "Senior High School"}</strong><small>Choose a level to view its sections</small></button>`).join("");
    const sections = registry.filter((section) => section.group === activeGroup);
    
    const sectionCards = sections.map((section) => {
      const secState = state.sections[section.id] || {};
      const displayLevel = secState.level || section.level;
      const displaySubject = secState.customSubject || section.subject;
      const displayAccent = secState.accent || section.accent;
      return `<button type="button" class="section-card accent-${displayAccent}" data-action="select-section" data-section="${section.id}"><span>${escapeHtml(displayLevel)}</span><strong>${escapeHtml(displaySubject)}</strong><small>Open grade sheet</small></button>`;
    }).join("");
    
    return `<section class="record-chooser"><div class="section-heading"><div><p class="eyebrow">Class Record</p><h2>Select a level and section</h2><p class="muted">Choose a school level first, then open the specific section. Grade sheets stay hidden until a section is selected.</p></div></div><div class="level-grid" aria-label="School levels">${groupCards}</div><div class="chooser-divider"><span>${activeGroup === "JHS" ? "Junior High School sections" : "Senior High School sections"}</span></div><div class="section-card-grid" aria-label="${activeGroup} sections">${sectionCards}</div></section>`;
  }

  function renderSectionRecord() {
    const section = currentSection();
    const secState = state.sections[section.id] || {};
    const periods = secState.periods;
    if (activePeriodIndex >= periods.length) activePeriodIndex = 0;
    const period = currentPeriod();
    const weights = currentWeights(section);
    const activeSubject = secState.subject || DEFAULT_SUBJECT;
    const { totalLearners } = computeLearnerNumbering(period.roster);
    const displayTheme = secState.theme || section.theme;
    
    const periodTabs = periods.map((entry, index) => `<button type="button" class="tab theme-${displayTheme}" data-action="select-period" data-period="${index}" aria-selected="${activePeriodIndex === index}">${escapeHtml(entry.name)}</button>`).join("");
    const subjectOptions = SUBJECT_OPTIONS.map((subject) => `<option value="${subject}" ${subject === activeSubject ? "selected" : ""}>${subject}</option>`).join("");
    
    return `<div class="record-section"><div class="record-back">${button("← Back to sections", "go-records")}</div>
      <div class="section-heading"><div>
        <div class="section-title-wrap"><h2>${escapeHtml(secState.customSubject || section.subject)}</h2>
          <button type="button" class="kebab-btn" data-action="edit-section" title="Edit Class Section" aria-label="Edit Section">⋮</button>
          <label class="subject-picker"><span class="subject-picker-label">Subject</span><select class="subject-select" data-subject-select aria-label="Subject used for this sheet's grading weights">${subjectOptions}</select></label>
          <span id="liveLearnerCount" class="learner-count-badge">${totalLearners} Learner${totalLearners === 1 ? "" : "s"}</span></div>
        <div class="record-meta"><span><strong>${escapeHtml(secState.level || section.level)}</strong></span><span>Weights: <strong>${weights.ww} / ${weights.pt} / ${weights.qa}</strong></span><span>Roster capacity: <strong>${section.rosterSize}</strong></span></div>
      </div></div>
      <div class="period-tabs" aria-label="Grading period tabs">${periodTabs}</div>
      <div class="period-toolbar"><label for="periodName">Period name</label><input id="periodName" class="period-name" value="${safeValue(period.name)}" data-period-name>
      ${button("+ Add Grading Period", "add-period", "button button-yellow")}</div>
      <p class="paste-hint"><strong>Bulk multi-select & paste tip:</strong> click and drag across input cells vertically or horizontally to select blocks. Use <strong>Ctrl+C</strong> to copy, <strong>Ctrl+X</strong> to cut, <strong>Delete</strong> to clear, or paste (Ctrl+V) copied spreadsheet blocks straight from Excel/Sheets.</p>
      <div class="legend"><span><i class="dot dot-red"></i>Raw score above HPS - correct before finalizing</span><span><i class="dot dot-code"></i>A = Absent, counted as a zero against that item's HPS · E = Excused, L = Late, excluded from computation as if the activity never happened</span></div>
      ${renderRecordTable(section, period, weights)}</div>`;
  }

  function renderRecordTable(section, period, weights) {
    const dateHeaders = (kind, values, labels = []) => values.map((value, index) => {
      const label = labels[index] ? `<span>${labels[index]}</span>` : `<span>${kind.toUpperCase()} ${index + 1}</span>`;
      const borderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      return `<th scope="col" class="activity-date-cell ${borderClass}">${label}<input class="activity-date" type="text" maxlength="12" placeholder="Date" data-date="${kind}" data-index="${index}" value="${safeValue(value)}" aria-label="${kind.toUpperCase()} activity ${index + 1} date"></th>`;
    }).join("");
    const hpsInputs = (kind, values) => values.map((value, index) => {
      const borderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      return `<td class="${borderClass}"><input type="number" min="0" step="any" inputmode="decimal" data-hps="${kind}" data-index="${index}" value="${safeValue(value)}" aria-label="${kind.toUpperCase()} ${index + 1} highest possible score"></td>`;
    }).join("");
    
    // Dynamically size QA labels and default weights
    const qaLabels = period.qaDates.map((_, index) => {
        const label = index === 0 ? "ST 1" : index === 1 ? "ST 2" : index === 2 ? "Term Exam" : `QA ${index + 1}`;
        const w = weights.qaIntra[index] !== undefined ? weights.qaIntra[index] : (1 / period.qaDates.length);
        return `${label} (${Math.round(w * 100)}%)`;
    });

    const { numbering } = computeLearnerNumbering(period.roster);
    const rows = period.roster.map((learner, rowIndex) => renderLearnerRow(learner, rowIndex, period, section, weights, numbering[rowIndex])).join("");
    
    return `<div class="table-wrap"><table class="record-table compact-record"><thead>
      <tr class="component-row"><th class="number-cell" scope="col" rowspan="3">#</th><th class="name-cell" scope="col" rowspan="3">Learner name</th><th class="component-header component-ww" scope="colgroup" colspan="${period.wwDates.length + 3}"><div class="header-with-controls">Written Works (${weights.ww}%)${componentControls("ww")}</div></th><th class="component-header component-pt border-start-pt" scope="colgroup" colspan="${period.ptDates.length + 3}"><div class="header-with-controls">Performance Tasks (${weights.pt}%)${componentControls("pt")}</div></th><th class="component-header component-qa border-start-qa" scope="colgroup" colspan="${period.qaDates.length + 3}"><div class="header-with-controls">Quarterly Assessment (${weights.qa}%)${componentControls("qa")}</div></th><th class="initial-header" scope="col" rowspan="3">Initial<br>Grade</th></tr>
      <tr class="activity-row">${dateHeaders("ww", period.wwDates)}<th class="component-summary component-ww" scope="col">Total WW</th><th class="component-summary component-ww" scope="col">PS</th><th class="component-summary component-ww" scope="col">WS<br>(${weights.ww}%)</th>${dateHeaders("pt", period.ptDates)}<th class="component-summary component-pt" scope="col">Total PT</th><th class="component-summary component-pt" scope="col">PS</th><th class="component-summary component-pt" scope="col">WS<br>(${weights.pt}%)</th>${dateHeaders("qa", period.qaDates, qaLabels)}<th class="component-summary component-qa" scope="col">Total QA</th><th class="component-summary component-qa" scope="col">PS</th><th class="component-summary component-qa" scope="col">WS<br>(${weights.qa}%)</th></tr>
      <tr class="hps-row"><th colspan="${period.wwDates.length}" scope="row">Highest Possible Scores (HPS)</th><th class="component-summary component-ww">Raw / HPS</th><th class="component-summary component-ww">Percentage</th><th class="component-summary component-ww">Weighted</th><th colspan="${period.ptDates.length}" scope="row" class="border-start-pt">Highest Possible Scores (HPS)</th><th class="component-summary component-pt">Raw / HPS</th><th class="component-summary component-pt">Percentage</th><th class="component-summary component-pt">Weighted</th><th colspan="${period.qaDates.length}" scope="row" class="border-start-qa">Highest Possible Scores (HPS)</th><th class="component-summary component-qa">Raw / HPS</th><th class="component-summary component-qa">Percentage</th><th class="component-summary component-qa">Weighted</th></tr>
      <tr class="hps-input-row"><th colspan="2" scope="row">Enter HPS</th>${hpsInputs("ww", period.wwHps)}<td colspan="3">&nbsp;</td>${hpsInputs("pt", period.ptHps)}<td colspan="3">&nbsp;</td>${hpsInputs("qa", period.qaHps)}<td colspan="3">&nbsp;</td><td>&nbsp;</td></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderLearnerRow(learner, rowIndex, period, section, weights, numDisplay) {
    const cat = getLearnerCategory(learner.name);
    const catClass = cat ? `row-category row-category-${cat}` : "";

    const scoreInputs = (kind, values, hpsValues) => values.map((value, index) => {
      const tdBorderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      const inputClasses = [hasRawAboveHps(value, hpsValues[index]) ? "invalid" : "", isAttendanceCode(value) ? "code-cell" : ""].filter(Boolean).join(" ");
      return `<td class="${tdBorderClass}"><input class="${inputClasses}" type="text" inputmode="text" maxlength="6" autocomplete="off" data-score="${kind}" data-row="${rowIndex}" data-index="${index}" value="${safeValue(cat ? "" : value)}" ${cat ? 'disabled tabindex="-1"' : ''} title="Enter a numeric score, or A (Absent), E (Excused), L (Late)" aria-label="Learner ${rowIndex + 1} ${kind.toUpperCase()} ${index + 1}"></td>`;
    }).join("");
    const result = learnerResult(learner, period, weights);
    return `<tr class="${catClass}" data-learner-row="${rowIndex}"><th class="number-cell" scope="row">${numDisplay !== undefined ? numDisplay : ""}</th><td class="name-cell"><input class="text-input" data-name-row="${rowIndex}" value="${safeValue(learner.name)}" aria-label="Learner ${rowIndex + 1} name"></td>${scoreInputs("ww", learner.ww, period.wwHps)}${summaryCells(result, "ww")}${scoreInputs("pt", learner.pt, period.ptHps)}${summaryCells(result, "pt")}${scoreInputs("qa", learner.qa, period.qaHps)}${summaryCells(result, "qa")}<td class="summary-cell initial-cell summary-initial">${format(result.initial.rounded, 0)}</td></tr>`;
  }

  function learnerResult(learner, period, weights) {
    const ww = calculateComponent(learner.ww, period.wwHps, weights.ww);
    const pt = calculateComponent(learner.pt, period.ptHps, weights.pt);
    const qa = calculateQuarterlyAssessment(learner.qa, period.qaHps, weights.qa, weights.qaIntra);
    return { ww, pt, qa, initial: calculateInitialGrade(ww, pt, qa) };
  }

  function formatScore(value) {
    if (!Number.isFinite(value)) return "—";
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  function scoreTotal(component) {
    return component.used ? `${formatScore(component.rawTotal)} / ${formatScore(component.hpsTotal)}` : "—";
  }

  function summaryCells(result, kind) {
    const component = result[kind];
    return `<td class="summary-cell component-total summary-${kind}-total">${scoreTotal(component)}</td><td class="summary-cell summary-${kind}-ps">${format(component.percentage, 2)}</td><td class="summary-cell summary-${kind}-ws">${format(component.weighted, 2)}</td>`;
  }

  function nextPeriodName(section, count) {
    const jhs = ["1st Grading", "2nd Grading", "3rd Grading", "4th Grading"];
    const shs = ["1st Quarter, 1st Semester", "2nd Quarter, 1st Semester", "1st Quarter, 2nd Semester", "2nd Quarter, 2nd Semester"];
    const choices = section.group === "JHS" ? jhs : shs;
    return choices[count] || `Additional Grading Period ${count + 1}`;
  }

  function addPeriod() {
    const section = currentSection();
    const periods = state.sections[section.id].periods;
    const period = initialPeriod(section);
    period.name = nextPeriodName(section, periods.length);
    periods.push(period);
    activePeriodIndex = periods.length - 1;
    render();
  }

  function normalizedName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function isPeriodFinalized(period, section) {
    const learners = period.roster.filter((learner) => learner.name.trim() && !getLearnerCategory(learner.name));
    const weights = currentWeights(section);
    return learners.length > 0 && learners.every((learner) => Number.isFinite(learnerResult(learner, period, weights).initial.rounded));
  }

  function searchStudent() {
    const input = document.querySelector("#studentSearch");
    const query = normalizedName(input && input.value);
    if (!query) { showSearchModal("Enter the student's complete name to check a grade."); return; }
    const matches = [];
    registry.forEach((section) => {
      const weights = currentWeights(section);
      state.sections[section.id].periods.forEach((period) => {
        period.roster.forEach((learner) => {
          if (!normalizedName(learner.name).includes(query) || getLearnerCategory(learner.name)) return;
          const result = learnerResult(learner, period, weights);
          matches.push({ section, period, learner, result, finalized: isPeriodFinalized(period, section) });
        });
      });
    });
    if (!matches.length) { showSearchModal("No exact student-name match was found. Please check the complete name and try again."); return; }
    const cards = matches.map(({ section, period, learner, result, finalized }) => {
      const secState = state.sections[section.id] || {};
      const dispLevel = secState.level || section.level;
      const dispSubject = secState.customSubject || section.subject;
      return `<article class="student-grade-result"><p class="eyebrow">${escapeHtml(dispLevel)} &bull; ${escapeHtml(period.name)}</p><h3>${escapeHtml(learner.name)}</h3><p class="student-subject">${escapeHtml(dispSubject)}</p>${finalized ? `<p class="student-grade-label">Initial Grade</p><p class="student-grade">${format(result.initial.rounded, 0)}</p>` : `<p class="grade-pending">Grades are not yet finalized for this section.</p>`}</article>`;
    }).join("");
    showSearchModal(cards, true);
  }

  function showSearchModal(message, isHtml = false) {
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `<section class="modal search-result-modal" role="dialog" aria-modal="true" aria-labelledby="studentSearchTitle"><div class="section-heading"><div><p class="eyebrow">Private grade check</p><h2 id="studentSearchTitle">Student result</h2></div>${button("Close", "close-search")}</div><div class="student-results">${isHtml ? message : `<p class="muted">${escapeHtml(message)}</p>`}</div></section>`;
    document.body.append(modal);
  }

  function updateLiveSummary(rowIndex) {
    const period = currentPeriod();
    const section = currentSection();
    const learner = period.roster[rowIndex];
    const row = document.querySelector(`[data-learner-row="${rowIndex}"]`);
    if (!row) return;
    const result = learnerResult(learner, period, currentWeights(section));
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

  function updateAllSummaries() { currentPeriod().roster.forEach((_, index) => updateLiveSummary(index)); }

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
    if (!hasCreds) {
      btn.disabled = false;
      setStatus("Add your Gist ID and PAT in Settings to enable sync.");
    } else if (isLoading) {
      btn.disabled = true;
      setStatus("Syncing with GitHub Gist... Please wait.", "saving");
    } else if (!isDataLoaded) {
      btn.disabled = true;
      setStatus("⚠️ DATA LOCKED: Click 'Load saved data' in Settings before saving to prevent overwriting.", "error");
    } else {
      btn.disabled = false;
      setStatus("Ready to save. ✓");
    }
  }

  async function saveToGist() {
    if (sessionStorage.getItem("cstr-class-record-login") !== "true") { setStatus("Sign in before saving.", "error"); return; }
    const gistId = localStorage.getItem(GIST_ID_KEY);
    const token = localStorage.getItem(GIST_TOKEN_KEY);
    if (!gistId || !token) { setStatus("Enter the Gist ID and Personal Access Token in Settings first.", "error"); return; }
    
    if (!isDataLoaded) {
      setStatus("⚠️ BLOCKED: Cannot save un-synchronized data! Please reload data from Settings first.", "error");
      alert("SECURITY BLOCK:\n\nYou are attempting to save while your remote GitHub data has not been confirmed loaded into this session.\n\nTo prevent overwriting and permanently losing your saved class records, saving has been blocked. Please open Settings and click 'Load saved data' first.");
      return;
    }

    setStatus("Saving...", "saving");
    try {
      const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
        method: "PATCH",
        headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ files: { "cstr-class-record-data.json": { content: JSON.stringify(state) } } })
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      setStatus("Saved ✓");
    } catch (error) { setStatus(`Error - check connection/token: ${error.message}`, "error"); }
  }

  async function loadFromGist() {
    const gistId = localStorage.getItem(GIST_ID_KEY);
    const token = localStorage.getItem(GIST_TOKEN_KEY);
    if (!gistId || !token) { setStatus("Enter the Gist ID and Personal Access Token first.", "error"); return; }
    
    isLoading = true;
    syncSaveControl();
    setStatus("Loading saved data from GitHub...", "saving");
    try {
      const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, { 
        headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}` },
        cache: "no-store" 
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const gist = await response.json();
      const file = gist.files["cstr-class-record-data.json"] || Object.values(gist.files)[0];
      if (!file) throw new Error("No JSON file was found in this Gist.");
      const content = file.truncated ? await (await fetch(file.raw_url, { headers: { "Authorization": `Bearer ${token}` }, cache: "no-store" })).text() : file.content;
      
      state = normalizeState(JSON.parse(content || "{}"));
      activePeriodIndex = 0;
      isDataLoaded = true;
      isLoading = false;
      render();
      setStatus("Saved data loaded successfully ✓");
    } catch (error) { 
      isLoading = false;
      isDataLoaded = false;
      render();
      setStatus(`Load Error: ${error.message}. Save is locked to protect data.`, "error"); 
    }
  }

  function renderSettings() {
    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle"><div class="section-heading"><div><p class="eyebrow">GitHub Gist sync</p><h2 id="settingsTitle">Settings</h2></div>${button("Close", "close-settings")}</div>
      <div class="settings-grid"><label>Gist ID<input id="gistId" value="${safeValue(localStorage.getItem(GIST_ID_KEY) || "")}" autocomplete="off"></label><label>GitHub Personal Access Token<input id="gistToken" type="password" value="${safeValue(localStorage.getItem(GIST_TOKEN_KEY) || "")}" autocomplete="off"></label></div>
      <p class="settings-note">These credentials are stored only in this browser's localStorage. Do not commit a token to the repository. Each device needs its own credentials to read and save the shared Gist.</p>
      <div class="stack-actions">${button("Save credentials", "save-settings", "button button-primary")} ${button("Load saved data", "load-gist")}</div></section>`;
    document.body.append(modal);
  }

  function renderEditSection() {
    const section = currentSection();
    const secState = state.sections[section.id] || {};
    const colors = ["black", "brown", "red", "blue", "green", "yellow", "purple", "orange", "pink", "gray"];
    const colorOptions = colors.map(c => `<option value="${c}" ${(secState.theme || section.theme) === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join("");
    const levels = Array.from({length: 12}, (_, i) => i + 1);
    const levelOptions = levels.map(l => `<option value="Grade ${l}" ${(secState.level || section.level) === `Grade ${l}` ? 'selected' : ''}>Grade ${l}</option>`).join("");

    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <section class="modal" role="dialog" aria-modal="true">
        <div class="section-heading">
          <div><p class="eyebrow">Class Section</p><h2>Edit Class Details</h2></div>
          ${button("Close", "close-settings")}
        </div>
        <div class="settings-grid">
          <label>Grade Level
            <select class="text-input" id="editLevel">${levelOptions}</select>
          </label>
          <label>Subject Display Name
            <input id="editSubject" value="${safeValue(secState.customSubject || section.subject)}" autocomplete="off">
          </label>
          <label>Classroom Color Code
            <select class="text-input" id="editTheme">${colorOptions}</select>
          </label>
        </div>
        <div class="stack-actions" style="margin-top: 24px;">
          ${button("Save Section Settings", "save-section", "button button-primary")}
        </div>
      </section>
    `;
    document.body.append(modal);
  }

  function closeSettings() { document.querySelector(".modal-backdrop")?.remove(); }

  function saveSettings() {
    const gistId = document.querySelector("#gistId").value.trim();
    const token = document.querySelector("#gistToken").value.trim();
    if (!gistId || !token) { setStatus("Both a Gist ID and Personal Access Token are required.", "error"); return; }
    localStorage.setItem(GIST_ID_KEY, gistId);
    localStorage.setItem(GIST_TOKEN_KEY, token);
    closeSettings();
    setStatus("Settings saved. Auto-loading data now...");
    loadFromGist();
  }

  function choosePhoto() { document.querySelector("#photoInput")?.click(); }

  function handlePhoto(file) {
    const allowedType = file && ["image/png", "image/jpeg"].includes(file.type);
    const allowedExtension = file && /\.(png|jpe?g)$/i.test(file.name);
    const note = document.querySelector("#photoNote");
    if (!allowedType || !allowedExtension) { if (note) { note.textContent = "Only .png, .jpg, and .jpeg image files are accepted."; note.classList.add("error"); } return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 500 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        state.photo = canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.88);
        render();
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  const getFieldOrderLength = () => {
    const period = currentPeriod();
    return 1 + period.wwDates.length + period.ptDates.length + period.qaDates.length;
  };

  function fieldStartColumn(target) {
    const period = currentPeriod();
    if (target.dataset.nameRow !== undefined) return 0;
    if (target.dataset.score === "ww") return 1 + Number(target.dataset.index);
    if (target.dataset.score === "pt") return 1 + period.wwDates.length + Number(target.dataset.index);
    if (target.dataset.score === "qa") return 1 + period.wwDates.length + period.ptDates.length + Number(target.dataset.index);
    return null;
  }

  function getCellCoords(input) {
    const row = Number(input.dataset.nameRow !== undefined ? input.dataset.nameRow : input.dataset.row);
    const col = fieldStartColumn(input);
    return (Number.isFinite(row) && col !== null) ? { row, col } : null;
  }

  function getSelectionBounds() {
    if (!selectionState.active && selectionState.startRow === null) return null;
    const minRow = Math.min(selectionState.startRow, selectionState.endRow);
    const maxRow = Math.max(selectionState.startRow, selectionState.endRow);
    const minCol = Math.min(selectionState.startCol, selectionState.endCol);
    const maxCol = Math.max(selectionState.startCol, selectionState.endCol);
    return { minRow, maxRow, minCol, maxCol };
  }

  function highlightSelection() {
    const bounds = getSelectionBounds();
    document.querySelectorAll(".record-table tbody input").forEach((input) => {
      const coords = getCellCoords(input);
      if (!coords || !bounds) { input.classList.remove("cell-selected"); return; }
      const isSelected = coords.row >= bounds.minRow && coords.row <= bounds.maxRow &&
                         coords.col >= bounds.minCol && coords.col <= bounds.maxCol &&
                         (bounds.minRow !== bounds.maxRow || bounds.minCol !== bounds.maxCol);
      input.classList.toggle("cell-selected", isSelected);
    });
  }

  function clearSelection() {
    selectionState = { active: false, startRow: null, startCol: null, endRow: null, endCol: null };
    document.querySelectorAll(".cell-selected").forEach((el) => el.classList.remove("cell-selected"));
  }

  app.addEventListener("mousedown", (event) => {
    const input = event.target.closest(".record-table tbody input");
    if (!input || event.button !== 0) { if (!event.target.closest(".record-table tbody")) clearSelection(); return; }
    const coords = getCellCoords(input);
    if (!coords) return;
    selectionState.active = true;
    selectionState.startRow = selectionState.endRow = coords.row;
    selectionState.startCol = selectionState.endCol = coords.col;
    highlightSelection();
  });

  app.addEventListener("mouseover", (event) => {
    if (!selectionState.active || event.buttons !== 1) return;
    const input = event.target.closest(".record-table tbody input");
    if (!input) return;
    const coords = getCellCoords(input);
    if (!coords) return;
    selectionState.endRow = coords.row;
    selectionState.endCol = coords.col;
    highlightSelection();
  });

  document.addEventListener("mouseup", () => { if (selectionState.active) selectionState.active = false; });

  document.addEventListener("keydown", (event) => {
    const bounds = getSelectionBounds();
    const hasMultiSelection = bounds && (bounds.minRow !== bounds.maxRow || bounds.minCol !== bounds.maxCol);
    if (!hasMultiSelection) return;

    if (event.key === "Escape") { clearSelection(); return; }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const period = currentPeriod();
      for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
        const l = period.roster[r];
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
          if (c === 0) l.name = "";
          else if (c <= period.wwDates.length) l.ww[c - 1] = "";
          else if (c <= period.wwDates.length + period.ptDates.length) l.pt[c - 1 - period.wwDates.length] = "";
          else if (c < getFieldOrderLength()) l.qa[c - 1 - period.wwDates.length - period.ptDates.length] = "";
        }
      }
      render();
      setStatus(`Cleared selected block.`);
      return;
    }
  });

  document.addEventListener("copy", (event) => {
    const bounds = getSelectionBounds();
    if (!bounds || (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol && document.activeElement.tagName === "INPUT")) return;
    const period = currentPeriod();
    const lines = [];
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const rowVals = [];
      const l = period.roster[r];
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        if (c === 0) rowVals.push(l.name || "");
        else if (c <= period.wwDates.length) rowVals.push(l.ww[c - 1] || "");
        else if (c <= period.wwDates.length + period.ptDates.length) rowVals.push(l.pt[c - 1 - period.wwDates.length] || "");
        else rowVals.push(l.qa[c - 1 - period.wwDates.length - period.ptDates.length] || "");
      }
      lines.push(rowVals.join("\t"));
    }
    event.clipboardData.setData("text/plain", lines.join("\n"));
    event.preventDefault();
    setStatus(`Copied ${bounds.maxRow - bounds.minRow + 1} rows × ${bounds.maxCol - bounds.minCol + 1} columns to clipboard.`);
  });

  document.addEventListener("cut", (event) => {
    const bounds = getSelectionBounds();
    if (!bounds || (bounds.minRow === bounds.maxRow && bounds.minCol === bounds.maxCol && document.activeElement.tagName === "INPUT")) return;
    const period = currentPeriod();
    const lines = [];
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const rowVals = [];
      const l = period.roster[r];
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        if (c === 0) { rowVals.push(l.name || ""); l.name = ""; }
        else if (c <= period.wwDates.length) { rowVals.push(l.ww[c - 1] || ""); l.ww[c - 1] = ""; }
        else if (c <= period.wwDates.length + period.ptDates.length) { rowVals.push(l.pt[c - 1 - period.wwDates.length] || ""); l.pt[c - 1 - period.wwDates.length] = ""; }
        else { rowVals.push(l.qa[c - 1 - period.wwDates.length - period.ptDates.length] || ""); l.qa[c - 1 - period.wwDates.length - period.ptDates.length] = ""; }
      }
      lines.push(rowVals.join("\t"));
    }
    event.clipboardData.setData("text/plain", lines.join("\n"));
    event.preventDefault();
    render();
    setStatus(`Cut ${bounds.maxRow - bounds.minRow + 1} rows × ${bounds.maxCol - bounds.minCol + 1} columns.`);
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "login") {
      const password = document.querySelector("#loginPassword").value;
      const error = document.querySelector("#loginError");
      if (VALID_PASSWORDS.includes(password)) { 
        sessionStorage.setItem("cstr-class-record-login", "true"); 
        render(); 
        if (localStorage.getItem(GIST_ID_KEY) && localStorage.getItem(GIST_TOKEN_KEY)) {
          loadFromGist(); 
        } else {
          isDataLoaded = true;
          syncSaveControl();
        }
      }
      else { error.textContent = "Incorrect password. Please try again."; error.classList.add("error"); }
    }
    if (action === "logout") { sessionStorage.removeItem("cstr-class-record-login"); currentView = "home"; render(); }
    if (action === "go-home") { currentView = "home"; render(); }
    if (action === "go-records") { currentView = "chooser"; render(); }
    if (action === "select-group") { activeGroup = target.dataset.group; activeSectionId = registry.find((section) => section.group === activeGroup).id; activePeriodIndex = 0; currentView = "chooser"; render(); }
    if (action === "select-section") { activeSectionId = target.dataset.section; activeGroup = currentSection().group; activePeriodIndex = 0; currentView = "record"; render(); }
    if (action === "select-period") { activePeriodIndex = Number(target.dataset.period); render(); }
    if (action === "add-period") addPeriod();
    if (action === "save-changes") saveToGist();
    if (action === "open-settings") renderSettings();
    if (action === "close-settings") closeSettings();
    if (action === "save-settings") saveSettings();
    if (action === "load-gist") { saveSettings(); loadFromGist(); }
    if (action === "choose-photo") choosePhoto();
    if (action === "search-student") searchStudent();
    if (action === "close-search") closeSettings();
    if (action === "edit-section") renderEditSection();
    if (action === "save-section") {
      const section = currentSection();
      if (!state.sections[section.id]) state.sections[section.id] = {};
      state.sections[section.id].level = document.querySelector("#editLevel").value;
      state.sections[section.id].customSubject = document.querySelector("#editSubject").value.trim();
      state.sections[section.id].theme = document.querySelector("#editTheme").value;
      state.sections[section.id].accent = document.querySelector("#editTheme").value;
      closeSettings();
      render();
      setStatus("Section details updated locally. Remember to Save Changes.", "saving");
    }
    if (action === "add-col") {
      const kind = target.dataset.kind;
      const period = currentPeriod();
      period[`${kind}Dates`].push("");
      period[`${kind}Hps`].push("");
      period.roster.forEach(l => l[kind].push(""));
      render();
      setStatus(`Added a new column to ${kind.toUpperCase()}.`);
    }
    if (action === "sub-col") {
      const kind = target.dataset.kind;
      const period = currentPeriod();
      if (period[`${kind}Dates`].length > 1) {
        period[`${kind}Dates`].pop();
        period[`${kind}Hps`].pop();
        period.roster.forEach(l => l[kind].pop());
        render();
        setStatus(`Removed the last column from ${kind.toUpperCase()}.`);
      } else {
        setStatus(`Cannot remove the only column remaining in ${kind.toUpperCase()}.`, "error");
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target && event.target.id === "studentSearch") { event.preventDefault(); searchStudent(); }
  });

  app.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset.nameRow !== undefined) { 
      const rowIndex = Number(input.dataset.nameRow);
      const learner = currentPeriod().roster[rowIndex];
      learner.name = input.value;
      const cat = getLearnerCategory(learner.name);
      if (cat) {
        learner.ww.fill("");
        learner.pt.fill("");
        learner.qa.fill("");
        render();
      } else {
        const rowEl = document.querySelector(`[data-learner-row="${rowIndex}"]`);
        if (rowEl && rowEl.classList.contains("row-category")) {
          render();
        } else {
          updateLiveSummary(rowIndex);
          updateAllNumberingAndCounts();
        }
      }
      adjustNameColumnWidth();
    }
    if (input.dataset.periodName !== undefined) { currentPeriod().name = input.value; }
    if (input.dataset.date) { currentPeriod()[`${input.dataset.date}Dates`][Number(input.dataset.index)] = input.value; }
    if (input.dataset.score) {
      const kind = input.dataset.score; const row = Number(input.dataset.row); const index = Number(input.dataset.index);
      const sanitized = sanitizeScoreValue(input.value);
      if (sanitized !== input.value) input.value = sanitized;
      currentPeriod().roster[row][kind][index] = sanitized; updateLiveSummary(row);
    }
    if (input.dataset.hps) { currentPeriod()[`${input.dataset.hps}Hps`][Number(input.dataset.index)] = input.value; updateAllSummaries(); }
  });

  function applyBulkPaste(startRow, startCol, text) {
    const section = currentSection();
    const period = currentPeriod();
    if (!Number.isFinite(startRow) || startCol === null) return;

    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (!lines.length) return;

    let rowsFilled = 0;
    let truncated = false;
    const totalCols = getFieldOrderLength();

    lines.forEach((line, lineOffset) => {
      const rowIndex = startRow + lineOffset;
      if (rowIndex >= section.rosterSize) { truncated = true; return; }
      const learner = period.roster[rowIndex];
      const cells = line.split("\t");
      cells.forEach((cellValue, cellOffset) => {
        const column = startCol + cellOffset;
        if (column >= totalCols) { truncated = true; return; }
        const value = cellValue.trim();
        if (column === 0) { learner.name = value; return; }
        if (column <= period.wwDates.length) { learner.ww[column - 1] = sanitizeScoreValue(value); return; }
        if (column <= period.wwDates.length + period.ptDates.length) { learner.pt[column - 1 - period.wwDates.length] = sanitizeScoreValue(value); return; }
        learner.qa[column - 1 - period.wwDates.length - period.ptDates.length] = sanitizeScoreValue(value);
      });
      rowsFilled += 1;
    });

    period.roster.forEach((l) => {
      if (getLearnerCategory(l.name)) {
        l.ww.fill("");
        l.pt.fill("");
        l.qa.fill("");
      }
    });

    clearSelection();
    render();
    const overflowNote = truncated ? " Some pasted data went past the roster size or the last QA column and was left out." : "";
    setStatus(`Bulk paste filled ${rowsFilled} row${rowsFilled === 1 ? "" : "s"}.${overflowNote}`);
  }

  app.addEventListener("paste", (event) => {
    const target = event.target;
    const isPasteable = target && target.dataset && (target.dataset.nameRow !== undefined || target.dataset.score !== undefined);
    if (!isPasteable && !selectionState.active) return;
    const text = (event.clipboardData || window.clipboardData).getData("text");
    if (!text || !/[\t\n\r]/.test(text)) return;
    event.preventDefault();

    const bounds = getSelectionBounds();
    if (bounds) {
      applyBulkPaste(bounds.minRow, bounds.minCol, text);
    } else {
      const coords = getCellCoords(target);
      if (coords) applyBulkPaste(coords.row, coords.col, text);
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.id === "photoInput") { handlePhoto(event.target.files[0]); return; }
    if (event.target.dataset.subjectSelect !== undefined) {
      const section = currentSection();
      if (!state.sections[section.id]) state.sections[section.id] = {};
      state.sections[section.id].subject = SUBJECT_OPTIONS.includes(event.target.value) ? event.target.value : DEFAULT_SUBJECT;
      render();
      setStatus("Subject weight config changed. Remember to Save Changes.");
    }
  });
  
  function initApp() {
    render();
    if (sessionStorage.getItem("cstr-class-record-login") === "true") {
      if (localStorage.getItem(GIST_ID_KEY) && localStorage.getItem(GIST_TOKEN_KEY)) {
        loadFromGist(); 
      } else {
        isDataLoaded = true; 
        syncSaveControl();
      }
    }
  }

  initApp();
})();
