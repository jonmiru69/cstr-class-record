/*
 * Pure, DOM-free grading functions for the CSTR Class Record.
 * Updated to support dynamically resizing Quarterly Assessment columns.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CSTRGrading = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const FINAL_GRADE_DECIMALS = 0;
  const ATTENDANCE_CODES = ["A", "E", "L"];

  function isAttendanceCode(value) {
    if (typeof value !== "string") return false;
    return ATTENDANCE_CODES.includes(value.trim().toUpperCase());
  }

  function numberOrNull(value) {
    if (value === "" || value === null || value === undefined) return null;
    if (isAttendanceCode(value)) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function roundHalfUp(value, decimals) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** decimals;
    return Math.floor((value * factor) + 0.5 + Number.EPSILON) / factor;
  }

  function format(value, decimals) {
    return Number.isFinite(value) ? value.toFixed(decimals) : "—";
  }

  function calculateComponent(rawScores, hpsScores, componentWeight) {
    let rawTotal = 0;
    let hpsTotal = 0;
    let used = 0;

    rawScores.forEach((rawValue, index) => {
      const raw = numberOrNull(rawValue);
      const hps = numberOrNull(hpsScores[index]);
      if (raw === null || hps === null || hps <= 0) return;
      rawTotal += raw;
      hpsTotal += hps;
      used += 1;
    });

    if (!used || hpsTotal <= 0) {
      return { rawTotal, hpsTotal, percentage: null, weighted: null, used };
    }
    const percentage = (rawTotal / hpsTotal) * 100;
    return {
      rawTotal,
      hpsTotal,
      percentage,
      weighted: percentage * (componentWeight / 100),
      used
    };
  }

  function calculateQuarterlyAssessment(rawScores, hpsScores, componentWeight) {
    // Functions identically to components to allow infinite dynamic columns
    return calculateComponent(rawScores, hpsScores, componentWeight);
  }

  function calculateInitialGrade(writtenWork, performanceTask, quarterlyAssessment) {
    const parts = [writtenWork.weighted, performanceTask.weighted, quarterlyAssessment.weighted];
    if (parts.some((value) => !Number.isFinite(value))) return { precise: null, rounded: null };
    const precise = parts.reduce((sum, value) => sum + value, 0);
    return { precise, rounded: roundHalfUp(precise, FINAL_GRADE_DECIMALS) };
  }

  function hasRawAboveHps(raw, hps) {
    const rawNumber = numberOrNull(raw);
    const hpsNumber = numberOrNull(hps);
    return rawNumber !== null && hpsNumber !== null && rawNumber > hpsNumber;
  }

  function workedExample() {
    const ww = calculateComponent([8, 9, 7], [10, 10, 10], 30);
    const pt = calculateComponent([18, 17, 19], [20, 20, 20], 40);
    const qa = calculateQuarterlyAssessment([25, 25], [30, 30], 30);
    const initial = calculateInitialGrade(ww, pt, qa);
    return { ww, pt, qa, initial, passes: ww.weighted === 24 && pt.weighted === 36 && qa.weighted === 25 && initial.rounded === 85 };
  }

  return {
    FINAL_GRADE_DECIMALS,
    ATTENDANCE_CODES,
    numberOrNull,
    roundHalfUp,
    format,
    calculateComponent,
    calculateQuarterlyAssessment,
    calculateInitialGrade,
    hasRawAboveHps,
    isAttendanceCode,
    workedExample
  };
});
