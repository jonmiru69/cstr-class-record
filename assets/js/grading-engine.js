/**
 * CSTR Grading Engine
 * Handles mathematically accurate weighted percentage calculations.
 */
const GradingEngine = {
  // Default percentage weights (e.g., WW 40%, PT 40%, EX 20%)
  weights: {
    ww: 0.40,
    pt: 0.40,
    ex: 0.20
  },

  /**
   * Updates component weights
   */
  setWeights(ww, pt, ex) {
    this.weights = { ww: ww / 100, pt: pt / 100, ex: ex / 100 };
  },

  /**
   * Calculates total, percentage score (PS), and weighted score (WS) for a category
   * @param {Array<number>} studentScores - Array of scores achieved by student
   * @param {Array<number>} maxScores - Array of highest possible scores
   * @param {string} category - 'ww', 'pt', or 'ex'
   */
  calculateDivision(studentScores, maxScores, category) {
    let totalScore = 0;
    let totalMax = 0;

    for (let i = 0; i < studentScores.length; i++) {
      const score = parseFloat(studentScores[i]) || 0;
      const max = parseFloat(maxScores[i]) || 0;
      if (max > 0) {
        totalScore += score;
        totalMax += max;
      }
    }

    if (totalMax === 0) {
      return { total: 0, ps: 0, ws: 0 };
    }

    const percentageScore = (totalScore / totalMax) * 100;
    const weightedScore = percentageScore * (this.weights[category] || 0);

    return {
      total: Math.round(totalScore * 100) / 100,
      ps: Math.round(percentageScore * 100) / 100,
      ws: Math.round(weightedScore * 100) / 100
    };
  },

  /**
   * Calculates the Final Initial Grade by summing all Weighted Scores
   */
  calculateFinalGrade(wwWS, ptWS, exWS) {
    const finalGrade = wwWS + ptWS + exWS;
    return Math.round(finalGrade * 100) / 100;
  }
};
