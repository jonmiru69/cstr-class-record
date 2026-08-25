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
  const ATTENDANCE_CODES = ["A", "E", "L"];

  // A = Absent, E = Excused, L = Late. All three are valid non-numeric cell
  // entries (see isAttendanceCode, used for display/validation styling), but
  // they are no longer treated identically in the grade computation:
  //   - Absent (A) counts as an actual score of zero against that item's
  //     HPS, so it pulls the average down (it still needs an HPS on record
  //     to know what "zero out of what" means).
  //   - Excused (E) and Late (L) are excluded from both sides of the ratio,
  //     as if the activity never happened, exactly like a blank slot.
  function isAttendanceCode(value) {
    if (typeof value !== "string") return false;
    return ATTENDANCE_CODES.includes(value.trim().toUpperCase());
  }

  function isAbsentCode(value) {
    if (typeof value !== "string") return false;
    return value.trim().toUpperCase() === "A";
  }

  function isExcusedOrLateCode(value) {
    if (typeof value !== "string") return false;
    const code = value.trim().toUpperCase();
    return code === "E" || code === "L";
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

      if (isAbsentCode(rawValue)) {
        // Absent: score as zero against the full HPS, but only if an HPS
        // has actually been recorded for this item.
        if (hps === null || hps <= 0) return;
        hpsTotal += hps;
        used += 1;
        return;
      }

      if (isExcusedOrLateCode(rawValue)) return; // treated as nonexistent

      const raw = numberOrNull(rawValue);
      // An unfilled item is excluded from both sides of the ratio.
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

  function calculateQuarterlyAssessment(rawScores, hpsScores, componentWeight, intraWeights = QA_INTRA_WEIGHTS) {
    let weightedPercentage = 0;
    let activeIntraWeight = 0;
    let rawTotal = 0;
    let hpsTotal = 0;
    let used = 0;

    intraWeights.forEach((intraWeight, index) => {
      const rawValue = rawScores[index];
      const hps = numberOrNull(hpsScores[index]);

      if (isAbsentCode(rawValue)) {
        if (hps === null || hps <= 0) return;
        activeIntraWeight += intraWeight; // contributes 0% at this intra-weight
        hpsTotal += hps;
        used += 1;
        return;
      }

      if (isExcusedOrLateCode(rawValue)) return; // treated as nonexistent

      const raw = numberOrNull(rawValue);
      // A blank QA slot is excluded, then the active fixed weights are normalized.
      if (raw === null || hps === null || hps <= 0) return;
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

  // Demonstrates the Absent-vs-Excused rule: HPS is [10, 10, 10]; the learner
  // scores 8 on item 1, is Absent (A) on item 2, and Excused (E) on item 3.
  // Absent must count as 0/10 (drags the percentage down); Excused must be
  // skipped entirely (as if item 3 never existed on the sheet).
  function workedExampleAttendance() {
    const ww = calculateComponent([8, "A", "E"], [10, 10, 10], 20);
    const passes = ww.rawTotal === 8 && ww.hpsTotal === 20 && ww.used === 2 && ww.percentage === 40 && ww.weighted === 8;
    return { ww, passes };
  }

  return {
    FINAL_GRADE_DECIMALS,
    QA_INTRA_WEIGHTS,
    ATTENDANCE_CODES,
    numberOrNull,
    roundHalfUp,
    format,
    calculateComponent,
    calculateQuarterlyAssessment,
    calculateInitialGrade,
    hasRawAboveHps,
    isAttendanceCode,
    isAbsentCode,
    isExcusedOrLateCode,
    workedExample,
    workedExampleAttendance
  };
});
