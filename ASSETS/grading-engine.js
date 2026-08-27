/*
 * Pure, DOM-free grading functions for the CSTR Class Record.
 * Display rounding is deliberately kept separate from calculations.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.CSTRGrading = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const FINAL_GRADE_DECIMALS = 0;
  const QA_INTRA_WEIGHTS = [0.30, 0.30, 0.40];
  // A = Absent, E = Excused, L = Late, M = Missing (present, no excuse)
  const ATTENDANCE_CODES = ["A", "E", "L", "M"];
  // Absent and Missing-without-excuse are scored as zero against that item's HPS,
  // so the activity still counts against the learner's cumulative total.
  const ZERO_SCORE_CODES = ["A", "M"];
  // Excused and Late are excluded entirely, as if the activity never happened,
  // so they never unfairly drag down the learner's grade.
  const EXCLUDED_CODES = ["E", "L"];

  function normalizedCode(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().toUpperCase();
    return ATTENDANCE_CODES.includes(trimmed) ? trimmed : null;
  }

  function isAttendanceCode(value) {
    return normalizedCode(value) !== null;
  }

  function isZeroScoreCode(value) {
    const code = normalizedCode(value);
    return code !== null && ZERO_SCORE_CODES.includes(code);
  }

  function isExcludedCode(value) {
    const code = normalizedCode(value);
    return code !== null && EXCLUDED_CODES.includes(code);
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
      const hps = numberOrNull(hpsScores[index]);
      if (hps === null || hps <= 0) return;
      if (isZeroScoreCode(rawValue)) {
        // Absent / Missing (no excuse): counts as zero against this item's HPS.
        rawTotal += 0;
        hpsTotal += hps;
        used += 1;
        return;
      }
      if (isExcludedCode(rawValue)) return; // Excused / Late: excluded entirely, like a blank slot.
      const raw = numberOrNull(rawValue);
      if (raw === null) return;
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

  // Revision 1 Support: Falls back to component normalization if the column size changes from 3.
  function calculateQuarterlyAssessment(rawScores, hpsScores, componentWeight) {
    if (rawScores.length === 3) {
      let weightedPercentage = 0;
      let activeIntraWeight = 0;
      let rawTotal = 0;
      let hpsTotal = 0;
      let used = 0;

      QA_INTRA_WEIGHTS.forEach((intraWeight, index) => {
        const hps = numberOrNull(hpsScores[index]);
        if (hps === null || hps <= 0) return;
        let raw;
        if (isZeroScoreCode(rawScores[index])) {
          raw = 0; // Absent / Missing (no excuse): counts as zero against this item's HPS.
        } else if (isExcludedCode(rawScores[index])) {
          return; // Excused / Late: excluded entirely, like a blank slot.
        } else {
          raw = numberOrNull(rawScores[index]);
          if (raw === null) return;
        }
        weightedPercentage += ((raw / hps) * 100) * intraWeight;
        activeIntraWeight += intraWeight;
        rawTotal += raw;
        hpsTotal += hps;
        used += 1;
      });

      if (!used || activeIntraWeight <= 0) {
        return { rawTotal, hpsTotal, percentage: null, weighted: null, used };
      }
      const percentage = weightedPercentage / activeIntraWeight;
      return { rawTotal, hpsTotal, percentage, weighted: percentage * (componentWeight / 100), used };
    }
    
    // Dynamic array calculation equivalent if length dynamically diverges from precisely 3:
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
    const qa = calculateQuarterlyAssessment([27, 24, 35], [30, 30, 40], 30);
    const initial = calculateInitialGrade(ww, pt, qa);
    return { ww, pt, qa, initial, passes: ww.weighted === 24 && pt.weighted === 36 && qa.weighted === 25.8 && initial.rounded === 86 };
  }

  return {
    FINAL_GRADE_DECIMALS,
    QA_INTRA_WEIGHTS,
    ATTENDANCE_CODES,
    ZERO_SCORE_CODES,
    EXCLUDED_CODES,
    numberOrNull,
    roundHalfUp,
    format,
    calculateComponent,
    calculateQuarterlyAssessment,
    calculateInitialGrade,
    hasRawAboveHps,
    isAttendanceCode,
    isZeroScoreCode,
    isExcludedCode,
    workedExample
  };
});
