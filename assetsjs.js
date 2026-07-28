(() => {
  "use strict";

  const { calculateComponent, calculateQuarterlyAssessment, calculateInitialGrade, format, hasRawAboveHps, isAttendanceCode } = window.CSTRGrading;
  const LOGIN_PASSWORD = "harty342002";
  const GIST_ID_KEY = "cstr-class-record-gist-id";
  const GIST_TOKEN_KEY = "cstr-class-record-pat";
  const app = document.querySelector("#app");

  const registry = [
    { id: "g8-alfonso", group: "JHS", level: "Grade 8", subject: "Science - Saint Alfonso de Orozco", weights: [20, 50, 30], theme: "purple", rosterSize: 42 },
    { id: "g8-john", group: "JHS", level: "Grade 8", subject: "Science - Saint John Stone", weights: [20, 50, 30], theme: "green", rosterSize: 42 },
    { id: "g8-pedro", group: "JHS", level: "Grade 8", subject: "Science - Saint Pedro Calungsod", weights: [20, 50, 30], theme: "blue", rosterSize: 42 },
    { id: "g9-ezekiel", group: "JHS", level: "Grade 9", subject: "ICL-Research III - Saint Ezekiel Moreno", weights: [20, 50, 30], theme: "red", rosterSize: 42 },
    { id: "g11-physics-carmel", group: "SHS", level: "Grade 11", subject: "Physics 1 - Our Lady of Mount Carmel", weights: [20, 50, 30], theme: "blue", rosterSize: 42 },
    { id: "g11-general-carmel", group: "SHS", level: "Grade 11", subject: "General Science 11 - Our Lady of Mount Carmel", weights: [20, 50, 30], theme: "blue", rosterSize: 42 },
    { id: "g11-consolacion", group: "SHS", level: "Grade 11", subject: "General Science 11 - Our Lady of Consolacion", weights: [20, 50, 30], theme: "blue", rosterSize: 42 }
  ];

  let currentView = "home";
  let activeGroup = "JHS";
  let activeSectionId = registry[0].id;
  let activePeriodIndex = 0;
  let state = createInitialState();

  function emptyRoster(size) {
    return Array.from({ length: size }, () => ({ name: "", ww: Array(10).fill(""), pt: Array(8).fill(""), qa: Array(3).fill("") }));
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
      roster: emptyRoster(section.rosterSize)
    };
  }

  function createInitialState() {
    return {
      version: 1,
      photo: "",
      sections: Object.fromEntries(registry.map((section) => [section.id, { periods: [initialPeriod(section)] }]))
    };
  }

  function normalizeState(saved) {
    const base = createInitialState();
    if (!saved || typeof saved !== "object") return base;
    base.photo = typeof saved.photo === "string" ? saved.photo : "";
    registry.forEach((section) => {
      const loaded = saved.sections && saved.sections[section.id];
      if (!loaded || !Array.isArray(loaded.periods) || !loaded.periods.length) return;
      base.sections[section.id].periods = loaded.periods.map((period) => ({
        name: typeof period.name === "string" && period.name.trim() ? period.name : initialPeriod(section).name,
        wwDates: fitArray(period.wwDates, 10),
        ptDates: fitArray(period.ptDates, 8),
        qaDates: fitArray(period.qaDates, 3),
        wwHps: fitArray(period.wwHps, 10),
        ptHps: fitArray(period.ptHps, 8),
        qaHps: fitArray(period.qaHps, 3),
        roster: Array.from({ length: section.rosterSize }, (_, index) => {
          const learner = Array.isArray(period.roster) ? period.roster[index] : null;
          return {
            name: learner && typeof learner.name === "string" ? learner.name : "",
            ww: fitArray(learner && learner.ww, 10),
            pt: fitArray(learner && learner.pt, 8),
            qa: fitArray(learner && learner.qa, 3)
          };
        })
      }));
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

  // Revision 3b: Detect "Boys" and "Girls" category rows
  function getLearnerCategory(name) {
    if (typeof name !== "string") return null;
    const clean = name.trim().toLowerCase();
    if (clean === "boys") return "boys";
    if (clean === "girls") return "girls";
    return null;
  }

  // Revision 3a: Automatically calculate longest name and adjust column width
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

  // Revision 1: Check scroll depth to toggle shrunk sticky header
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
    const content = currentView === "home" ? renderHome() : renderClassRecord();
    return `<header class="app-header"><div class="app-header-inner">
      <div class="app-header-brand">
        <span class="header-logo"><img src="assets/img/cstr-logo.png" alt="Colegio de Sto. Tomás – Recoletos crest"></span>
        <div><p class="eyebrow">CSTR • San Carlos City, Negros Occidental</p>
        <h1 class="app-title">Colegio de Sto. Tomás – Recoletos, Incorporated</h1>
        <p class="muted">Website for Class Record, with respect to DepEd Order No. 15, s. 2026.</p></div>
      </div>
      <div class="header-actions-wrap">
        <div class="header-actions">${button("💾 Save Changes", "save-changes", "button button-primary", `id="saveChanges"`)} ${button("Settings", "open-settings")} ${button("Log out", "logout")}</div>
        <p id="statusMessage" class="save-status" role="status" aria-live="polite"></p>
      </div>
    </div></header>
    <div class="app-shell">
      <nav class="tabs" aria-label="Main navigation">
        <button class="tab" type="button" data-action="go-home" aria-selected="${currentView === "home"}">Home</button>
        <button class="tab" type="button" data-action="go-records" aria-selected="${currentView === "records"}">Class Record</button>
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
    const groupTabs = ["JHS", "SHS"].map((group) => `<button type="button" class="tab" data-action="select-group" data-group="${group}" aria-selected="${activeGroup === group}">${group === "JHS" ? "Junior High School" : "Senior High School"}</button>`).join("");
    const sections = registry.filter((section) => section.group === activeGroup);
    if (!sections.some((section) => section.id === activeSectionId)) { activeSectionId = sections[0].id; activePeriodIndex = 0; }
    const sectionTabs = sections.map((section) => `<button type="button" class="tab theme-${section.theme}" data-action="select-section" data-section="${section.id}" aria-selected="${activeSectionId === section.id}">${escapeHtml(section.subject)}</button>`).join("");
    return `<section><div class="section-heading"><div><p class="eyebrow">Class Record</p><h2>Class Record</h2><p class="muted">Choose a school group, then a section. Blank assessment slots are excluded from calculations.</p></div></div>
      <div class="tabs" aria-label="Class Record tabs"><button class="tab" type="button" aria-selected="true">Subjects</button></div>
      <div class="tabs" aria-label="School group tabs">${groupTabs}</div><div class="section-tabs" aria-label="Section tabs">${sectionTabs}</div>${renderSectionRecord()}</section>`;
  }

  function renderSectionRecord() {
    const section = currentSection();
    const periods = state.sections[section.id].periods;
    if (activePeriodIndex >= periods.length) activePeriodIndex = 0;
    const period = currentPeriod();
    const periodTabs = periods.map((entry, index) => `<button type="button" class="tab theme-${section.theme}" data-action="select-period" data-period="${index}" aria-selected="${activePeriodIndex === index}">${escapeHtml(entry.name)}</button>`).join("");
    return `<div class="record-section"><div class="section-heading"><div><h2>${escapeHtml(section.subject)}</h2><div class="record-meta"><span><strong>${section.level}</strong></span><span>Weights: <strong>${section.weights.join(" / ")}</strong></span><span>Roster capacity: <strong>${section.rosterSize}</strong></span></div></div></div>
      <div class="period-tabs" aria-label="Grading period tabs">${periodTabs}</div>
      <div class="period-toolbar"><label for="periodName">Period name</label><input id="periodName" class="period-name" value="${safeValue(period.name)}" data-period-name>
      ${button("+ Add Grading Period", "add-period", "button button-yellow")}</div>
      <p class="paste-hint"><strong>Bulk paste tip:</strong> click any Learner name cell or any score cell, then paste a block of rows/columns copied straight from Excel or Google Sheets (Ctrl+V / Cmd+V). It fills across the matching cells automatically, starting from the cell you clicked, and lines everything up with the correct columns and rows.</p>
      <div class="legend"><span><i class="dot dot-red"></i>Raw score above HPS - correct before finalizing</span><span><i class="dot dot-code"></i>A = Absent · E = Excused · L = Late, all excluded from the grade computation</span><span>QA slots use fixed 30% / 30% / 40% intra-weights</span></div>
      ${renderRecordTable(section, period)}</div>`;
  }

  // Revision 5: Added explicit border-start-pt and border-start-qa classes to index 0 of PT and QA
  function renderRecordTable(section, period) {
    const dateHeaders = (kind, values, labels = []) => values.map((value, index) => {
      const label = labels[index] ? `<span>${labels[index]}</span>` : "";
      const borderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      return `<th scope="col" class="activity-date-cell ${borderClass}">${label}<input class="activity-date" type="text" maxlength="12" placeholder="Date" data-date="${kind}" data-index="${index}" value="${safeValue(value)}" aria-label="${kind.toUpperCase()} activity ${index + 1} date"></th>`;
    }).join("");
    const hpsInputs = (kind, values) => values.map((value, index) => {
      const borderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      return `<td class="${borderClass}"><input type="number" min="0" step="any" inputmode="decimal" data-hps="${kind}" data-index="${index}" value="${safeValue(value)}" aria-label="${kind.toUpperCase()} ${index + 1} highest possible score"></td>`;
    }).join("");
    const rows = period.roster.map((learner, rowIndex) => renderLearnerRow(learner, rowIndex, period, section)).join("");
    return `<div class="table-wrap"><table class="record-table compact-record"><thead>
      <tr class="component-row"><th class="number-cell" scope="col" rowspan="3">#</th><th class="name-cell" scope="col" rowspan="3">Learner name</th><th class="component-header component-ww" scope="colgroup" colspan="13">Written Works (${section.weights[0]}%)</th><th class="component-header component-pt border-start-pt" scope="colgroup" colspan="11">Performance Tasks (${section.weights[1]}%)</th><th class="component-header component-qa border-start-qa" scope="colgroup" colspan="6">Quarterly Assessment (${section.weights[2]}%)</th><th class="initial-header" scope="col" rowspan="3">Initial<br>Grade</th></tr>
      <tr class="activity-row">${dateHeaders("ww", period.wwDates)}<th class="component-summary component-ww" scope="col">Total WW</th><th class="component-summary component-ww" scope="col">PS</th><th class="component-summary component-ww" scope="col">WS<br>(${section.weights[0]}%)</th>${dateHeaders("pt", period.ptDates)}<th class="component-summary component-pt" scope="col">Total PT</th><th class="component-summary component-pt" scope="col">PS</th><th class="component-summary component-pt" scope="col">WS<br>(${section.weights[1]}%)</th>${dateHeaders("qa", period.qaDates, ["ST 1 (30%)", "ST 2 (30%)", "Term Exam (40%)"])}<th class="component-summary component-qa" scope="col">Total QA</th><th class="component-summary component-qa" scope="col">PS</th><th class="component-summary component-qa" scope="col">WS<br>(${section.weights[2]}%)</th></tr>
      <tr class="hps-row"><th colspan="10" scope="row">Highest Possible Scores (HPS)</th><th class="component-summary component-ww">Raw / HPS</th><th class="component-summary component-ww">Percentage</th><th class="component-summary component-ww">Weighted</th><th colspan="8" scope="row" class="border-start-pt">Highest Possible Scores (HPS)</th><th class="component-summary component-pt">Raw / HPS</th><th class="component-summary component-pt">Percentage</th><th class="component-summary component-pt">Weighted</th><th colspan="3" scope="row" class="border-start-qa">Highest Possible Scores (HPS)</th><th class="component-summary component-qa">Raw / HPS</th><th class="component-summary component-qa">Percentage</th><th class="component-summary component-qa">Weighted</th></tr>
      <tr class="hps-input-row"><th colspan="2" scope="row">Enter HPS</th>${hpsInputs("ww", period.wwHps)}<td colspan="3">&nbsp;</td>${hpsInputs("pt", period.ptHps)}<td colspan="3">&nbsp;</td>${hpsInputs("qa", period.qaHps)}<td colspan="3">&nbsp;</td><td>&nbsp;</td></tr>
      </thead><tbody>${rows}</tbody></table></div>`;
  }

  // Revision 3b & Revision 5: Category styling, disabled score boxes, and boundary line classes
  function renderLearnerRow(learner, rowIndex, period, section) {
    const cat = getLearnerCategory(learner.name);
    const catClass = cat ? `row-category row-category-${cat}` : "";

    const scoreInputs = (kind, values, hpsValues) => values.map((value, index) => {
      const tdBorderClass = (index === 0 && kind === "pt") ? "border-start-pt" : (index === 0 && kind === "qa") ? "border-start-qa" : "";
      const inputClasses = [hasRawAboveHps(value, hpsValues[index]) ? "invalid" : "", isAttendanceCode(value) ? "code-cell" : ""].filter(Boolean).join(" ");
      return `<td class="${tdBorderClass}"><input class="${inputClasses}" type="text" inputmode="text" maxlength="6" autocomplete="off" data-score="${kind}" data-row="${rowIndex}" data-index="${index}" value="${safeValue(cat ? "" : value)}" ${cat ? 'disabled tabindex="-1"' : ''} title="Enter a numeric score, or A (Absent), E (Excused), L (Late)" aria-label="Learner ${rowIndex + 1} ${kind.toUpperCase()} ${index + 1}"></td>`;
    }).join("");
    const result = learnerResult(learner, period, section.weights);
    return `<tr class="${catClass}" data-learner-row="${rowIndex}"><th class="number-cell" scope="row">${rowIndex + 1}</th><td class="name-cell"><input class="text-input" data-name-row="${rowIndex}" value="${safeValue(learner.name)}" aria-label="Learner ${rowIndex + 1} name"></td>${scoreInputs("ww", learner.ww, period.wwHps)}${summaryCells(result, "ww")}${scoreInputs("pt", learner.pt, period.ptHps)}${summaryCells(result, "pt")}${scoreInputs("qa", learner.qa, period.qaHps)}${summaryCells(result, "qa")}<td class="summary-cell initial-cell summary-initial">${format(result.initial.rounded, 0)}</td></tr>`;
  }

  function learnerResult(learner, period, weights) {
    const ww = calculateComponent(learner.ww, period.wwHps, weights[0]);
    const pt = calculateComponent(learner.pt, period.ptHps, weights[1]);
    const qa = calculateQuarterlyAssessment(learner.qa, period.qaHps, weights[2]);
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

  function updateLiveSummary(rowIndex) {
    const period = currentPeriod();
    const section = currentSection();
    const learner = period.roster[rowIndex];
    const row = document.querySelector(`[data-learner-row="${rowIndex}"]`);
    if (!row) return;
    const result = learnerResult(learner, period, section.weights);
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
    btn.disabled = false;
    if (!localStorage.getItem(GIST_ID_KEY) || !localStorage.getItem(GIST_TOKEN_KEY)) setStatus("Add your Gist ID and PAT in Settings to enable sync.");
    else setStatus("Ready to save.");
  }

  async function saveToGist() {
    if (sessionStorage.getItem("cstr-class-record-login") !== "true") { setStatus("Sign in before saving.", "error"); return; }
    const gistId = localStorage.getItem(GIST_ID_KEY);
    const token = localStorage.getItem(GIST_TOKEN_KEY);
    if (!gistId || !token) { setStatus("Enter the Gist ID and Personal Access Token in Settings first.", "error"); return; }
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
    setStatus("Loading saved data...", "saving");
    try {
      const response = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, { headers: { "Accept": "application/vnd.github+json", "Authorization": `Bearer ${token}` } });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      const gist = await response.json();
      const file = gist.files["cstr-class-record-data.json"] || Object.values(gist.files)[0];
      if (!file) throw new Error("No JSON file was found in this Gist.");
      const content = file.truncated ? await (await fetch(file.raw_url, { headers: { "Authorization": `Bearer ${token}` } })).text() : file.content;
      state = normalizeState(JSON.parse(content || "{}"));
      activePeriodIndex = 0;
      render();
      setStatus("Saved data loaded ✓");
    } catch (error) { setStatus(`Error - check connection/token: ${error.message}`, "error"); }
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

  function closeSettings() { document.querySelector(".modal-backdrop")?.remove(); }

  function saveSettings() {
    const gistId = document.querySelector("#gistId").value.trim();
    const token = document.querySelector("#gistToken").value.trim();
    if (!gistId || !token) { setStatus("Both a Gist ID and Personal Access Token are required.", "error"); return; }
    localStorage.setItem(GIST_ID_KEY, gistId);
    localStorage.setItem(GIST_TOKEN_KEY, token);
    closeSettings();
    setStatus("Settings saved on this device.");
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

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "login") {
      const password = document.querySelector("#loginPassword").value;
      const error = document.querySelector("#loginError");
      if (password === LOGIN_PASSWORD) { sessionStorage.setItem("cstr-class-record-login", "true"); render(); if (localStorage.getItem(GIST_ID_KEY) && localStorage.getItem(GIST_TOKEN_KEY)) loadFromGist(); }
      else { error.textContent = "Incorrect password. Please try again."; error.classList.add("error"); }
    }
    if (action === "logout") { sessionStorage.removeItem("cstr-class-record-login"); currentView = "home"; render(); }
    if (action === "go-home") { currentView = "home"; render(); }
    if (action === "go-records") { currentView = "records"; render(); }
    if (action === "select-group") { activeGroup = target.dataset.group; activeSectionId = registry.find((section) => section.group === activeGroup).id; activePeriodIndex = 0; render(); }
    if (action === "select-section") { activeSectionId = target.dataset.section; activeGroup = currentSection().group; activePeriodIndex = 0; render(); }
    if (action === "select-period") { activePeriodIndex = Number(target.dataset.period); render(); }
    if (action === "add-period") addPeriod();
    if (action === "save-changes") saveToGist();
    if (action === "open-settings") renderSettings();
    if (action === "close-settings") closeSettings();
    if (action === "save-settings") saveSettings();
    if (action === "load-gist") { saveSettings(); loadFromGist(); }
    if (action === "choose-photo") choosePhoto();
  });

  // Revision 3a & 3b: Handle dynamic width and category score clearing on typing
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

  const FIELD_ORDER_LENGTH = 22;
  function fieldStartColumn(target) {
    if (target.dataset.nameRow !== undefined) return 0;
    if (target.dataset.score === "ww") return 1 + Number(target.dataset.index);
    if (target.dataset.score === "pt") return 11 + Number(target.dataset.index);
    if (target.dataset.score === "qa") return 19 + Number(target.dataset.index);
    return null;
  }

  function applyBulkPaste(target, text) {
    const section = currentSection();
    const period = currentPeriod();
    const startRow = Number(target.dataset.nameRow !== undefined ? target.dataset.nameRow : target.dataset.row);
    const startColumn = fieldStartColumn(target);
    if (!Number.isFinite(startRow) || startColumn === null) return;

    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (!lines.length) return;

    let rowsFilled = 0;
    let truncated = false;

    lines.forEach((line, lineOffset) => {
      const rowIndex = startRow + lineOffset;
      if (rowIndex >= section.rosterSize) { truncated = true; return; }
      const learner = period.roster[rowIndex];
      const cells = line.split("\t");
      cells.forEach((cellValue, cellOffset) => {
        const column = startColumn + cellOffset;
        if (column >= FIELD_ORDER_LENGTH) { truncated = true; return; }
        const value = cellValue.trim();
        if (column === 0) { learner.name = value; return; }
        if (column <= 10) { learner.ww[column - 1] = sanitizeScoreValue(value); return; }
        if (column <= 18) { learner.pt[column - 11] = sanitizeScoreValue(value); return; }
        learner.qa[column - 19] = sanitizeScoreValue(value);
      });
      rowsFilled += 1;
    });

    // Revision 3b: Wipe numeric scores if pasted into a Boys/Girls category row
    period.roster.forEach((l) => {
      if (getLearnerCategory(l.name)) {
        l.ww.fill("");
        l.pt.fill("");
        l.qa.fill("");
      }
    });

    render();
    const overflowNote = truncated ? " Some pasted data went past the roster size or the last QA column and was left out." : "";
    setStatus(`Bulk paste filled ${rowsFilled} row${rowsFilled === 1 ? "" : "s"}.${overflowNote}`);
  }

  app.addEventListener("paste", (event) => {
    const target = event.target;
    const isPasteable = target && target.dataset && (target.dataset.nameRow !== undefined || target.dataset.score !== undefined);
    if (!isPasteable) return;
    const text = (event.clipboardData || window.clipboardData).getData("text");
    if (!text || !/[\t\n\r]/.test(text)) return;
    event.preventDefault();
    applyBulkPaste(target, text);
  });

  app.addEventListener("change", (event) => { if (event.target.id === "photoInput") handlePhoto(event.target.files[0]); });
  render();
})();