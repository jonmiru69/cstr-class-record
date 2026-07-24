/**
 * Universal CSTR Grading Engine
 * Supports both CSTRGrading and GradingEngine naming conventions to prevent destructuring crashes.
 */
const CSTRGrading = {
  weights: { ww: 0.40, pt: 0.40, ex: 0.20 },

  setWeights(ww, pt, ex) {
    this.weights = { ww: ww / 100, pt: pt / 100, ex: ex / 100 };
  },

  // Primary calculation function
  calculateComponent(studentScores, maxScores, category) {
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

    const ps = (totalScore / totalMax) * 100;
    const ws = ps * (this.weights[category] || 0);

    return {
      total: Math.round(totalScore * 100) / 100,
      ps: Math.round(ps * 100) / 100,
      ws: Math.round(ws * 100) / 100
    };
  },

  // Alias name so either function name works seamlessly
  calculateDivision(studentScores, maxScores, category) {
    return this.calculateComponent(studentScores, maxScores, category);
  },

  calculateFinalGrade(wwWS, ptWS, exWS) {
    return Math.round((wwWS + ptWS + exWS) * 100) / 100;
  }
};

// Bind all possible object names to the global window so app.js cannot fail
window.CSTRGrading = CSTRGrading;
window.GradingEngine = CSTRGrading;
