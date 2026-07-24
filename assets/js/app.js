(() => {
  "use strict";

  const { calculateComponent, calculateQuarterlyAssessment, calculateInitialGrade, format, hasRawAboveHps } = window.CSTRGrading;
  const LOGIN_PASSWORD = "harty342002";
  const GIST_ID_KEY = "cstr-class-record-gist-id";
  const GIST_TOKEN_KEY = "cstr-class-record-pat";
  const app = document.querySelector("#app");
  const saveButton = document.querySelector("#saveChanges");
  const statusMessage = document.querySelector("#statusMessage");

  // This is intentionally only a convenience gate for one static-site owner.
  // It is not real security: anyone who can view this source can find the check.
  const registry = [
    { id: "g8-alfonso", group: "JHS", level: "Grade 8", subject: "Science - Saint Alfonso de Orozco", weights: [30, 40, 30], theme: "yellow", rosterSize: 42 },
    { id: "g8-john", group: "JHS", level: "Grade 8", subject: "Science - Saint John Stone", weights: [30, 40, 30], theme: "yellow", rosterSize: 42 },
    { id: "g8-pedro", group: "JHS", level: "Grade 8", subject: "Science - Saint Pedro Calungsod", weights: [30, 40, 30], theme: "yellow", rosterSize: 42 },
    { id: "g9-ezekiel", group: "JHS", level: "Grade 9", subject: "ICL-Research III - Saint Ezekiel Moreno", weights: [30, 40, 30], theme: "red", rosterSize: 42 },
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

  function render() {
    app.innerHTML = sessionStorage.getItem("cstr-class-record-login") === "true" ? renderApp() : renderLogin();
    syncSaveControl();
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
    return `<div class="app-shell">
      <header class="app-header"><div><p class="eyebrow">CSTR • San Carlos City, Negros Occidental</p>
      <h1 class="app-title">Colegio de Sto. Tomás – Recoletos, Incorporated</h1>
      <p class="muted">Website for Class Record, with respect to DepEd Order No. 15, s. 2026.</p></div>
      <div class="header-actions">${button("Settings", "open-settings")} ${button("Log out", "logout")}</div></header>
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
      <div class="legend"><span><i class="dot dot-red"></i>Raw score above HPS - correct before finalizing</span><span>QA slots use fixed 30% / 30% / 40% intra-weights</span></div>
      ${renderRecordTable(section, period)}</div>`;
  }

  function renderRecordTable(section, period) {
    const scoreHeaders = (prefix, count, label) => Array.from({ length: count }, (_, index) => `<th scope="col" title="${label} ${index + 1}">${prefix}${index + 1}</th>`).join("");
    const hpsInputs = (kind, values) => values.map((value, index) => `<td><input type="number" min="0" step="any" inputmode="decimal" data-hps="${kind}" data-index="${index}" value="${safeValue(value)}" aria-label="${kind.toUpperCase()} ${index + 1} highest possible score"></td>`).join("");
    const rows = period.roster.map((learner, rowIndex) => renderLearnerRow(learner, rowIndex, period, section)).join("");
    return `<div class="table-wrap"><table class="record-table"><thead><tr><th class="number-cell" scope="col">#</th><th class="name-cell" scope="col">Learner name</th>${scoreHeaders("WW", 10, "Written Work")}${scoreHeaders("PT", 8, "Performance Task")}<th scope="col">ST1</th><th scope="col">ST2</th><th scope="col">Exam</th><th scope="col">WW PS</th><th scope="col">WW WS</th><th scope="col">PT PS</th><th scope="col">PT WS</th><th scope="col">QA PS</th><th scope="col">QA WS</th><th scope="col">Initial Grade</th></tr>
      <tr class="hps-row"><th colspan="2" scope="row">HPS (shared per assessment)</th>${hpsInputs("ww", period.wwHps)}${hpsInputs("pt", period.ptHps)}${hpsInputs("qa", period.qaHps)}<td colspan="7">Highest Possible Scores</td></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderLearnerRow(learner, rowIndex, period, section) {
    const scoreInputs = (kind, values, hpsValues) => values.map((value, index) => `<td><input class="${hasRawAboveHps(value, hpsValues[index]) ? "invalid" : ""}" type="number" min="0" step="any" inputmode="decimal" data-score="${kind}" data-row="${rowIndex}" data-index="${index}" value="${safeValue(value)}" aria-label="Learner ${rowIndex + 1} ${kind.toUpperCase()} ${index + 1}"></td>`).join("");
    const result = learnerResult(learner, period, section.weights);
    return `<tr data-learner-row="${rowIndex}"><th class="number-cell" scope="row">${rowIndex + 1}</th><td class="name-cell"><input class="text-input" data-name-row="${rowIndex}" value="${safeValue(learner.name)}" aria-label="Learner ${rowIndex + 1} name"></td>${scoreInputs("ww", learner.ww, period.wwHps)}${scoreInputs("pt", learner.pt, period.ptHps)}${scoreInputs("qa", learner.qa, period.qaHps)}${summaryCells(result)}</tr>`;
  }

  function learnerResult(learner, period, weights) {
    const ww = calculateComponent(learner.ww, period.wwHps, weights[0]);
    const pt = calculateComponent(learner.pt, period.ptHps, weights[1]);
    const qa = calculateQuarterlyAssessment(learner.qa, period.qaHps, weights[2]);
    return { ww, pt, qa, initial: calculateInitialGrade(ww, pt, qa) };
  }

  function summaryCells(result) {
    return `<td class="summary-cell summary-ww-ps">${format(result.ww.percentage, 2)}</td><td class="summary-cell summary-ww-ws">${format(result.ww.weighted, 2)}</td><td class="summary-cell summary-pt-ps">${format(result.pt.percentage, 2)}</td><td class="summary-cell summary-pt-ws">${format(result.pt.weighted, 2)}</td><td class="summary-cell summary-qa-ps">${format(result.qa.percentage, 2)}</td><td class="summary-cell summary-qa-ws">${format(result.qa.weighted, 2)}</td><td class="summary-cell initial-cell summary-initial">${format(result.initial.rounded, 0)}</td>`;
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
    row.querySelector(".summary-ww-ps").textContent = format(result.ww.percentage, 2);
    row.querySelector(".summary-ww-ws").textContent = format(result.ww.weighted, 2);
    row.querySelector(".summary-pt-ps").textContent = format(result.pt.percentage, 2);
    row.querySelector(".summary-pt-ws").textContent = format(result.pt.weighted, 2);
    row.querySelector(".summary-qa-ps").textContent = format(result.qa.percentage, 2);
    row.querySelector(".summary-qa-ws").textContent = format(result.qa.weighted, 2);
    row.querySelector(".summary-initial").textContent = format(result.initial.rounded, 0);
    ["ww", "pt", "qa"].forEach((kind) => row.querySelectorAll(`[data-score="${kind}"]`).forEach((input) => {
      const index = Number(input.dataset.index);
      input.classList.toggle("invalid", hasRawAboveHps(learner[kind][index], period[`${kind}Hps`][index]));
    }));
  }

  function updateAllSummaries() { currentPeriod().roster.forEach((_, index) => updateLiveSummary(index)); }

  function setStatus(message, type = "") {
    statusMessage.textContent = message;
    statusMessage.className = `save-status visible ${type}`;
    saveButton.classList.toggle("saving", type === "saving");
    saveButton.classList.toggle("error", type === "error");
  }

  function syncSaveControl() {
    saveButton.disabled = false;
    if (sessionStorage.getItem("cstr-class-record-login") !== "true") setStatus("Sign in to save class-record data.");
    else if (!localStorage.getItem(GIST_ID_KEY) || !localStorage.getItem(GIST_TOKEN_KEY)) setStatus("Add your Gist ID and PAT in Settings to enable sync.");
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

  // Settings lives in a modal appended to body, so delegated clicks must listen on document.
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
    if (action === "open-settings") renderSettings();
    if (action === "close-settings") closeSettings();
    if (action === "save-settings") saveSettings();
    if (action === "load-gist") { saveSettings(); loadFromGist(); }
    if (action === "choose-photo") choosePhoto();
  });

  app.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset.nameRow !== undefined) { currentPeriod().roster[Number(input.dataset.nameRow)].name = input.value; }
    if (input.dataset.periodName !== undefined) { currentPeriod().name = input.value; }
    if (input.dataset.score) {
      const kind = input.dataset.score; const row = Number(input.dataset.row); const index = Number(input.dataset.index);
      currentPeriod().roster[row][kind][index] = input.value; updateLiveSummary(row);
    }
    if (input.dataset.hps) { currentPeriod()[`${input.dataset.hps}Hps`][Number(input.dataset.index)] = input.value; updateAllSummaries(); }
  });

  app.addEventListener("change", (event) => { if (event.target.id === "photoInput") handlePhoto(event.target.files[0]); });
  saveButton.addEventListener("click", saveToGist);
  render();
})();
