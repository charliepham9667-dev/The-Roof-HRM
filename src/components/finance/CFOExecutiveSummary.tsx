import { useMemo } from 'react';
import { 
  TrendingUp, 
  CheckCircle, 
  Target,
  BarChart3,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { PnlMonthly } from '../../hooks/usePLData';

// ============================================================================
// TYPES
// ============================================================================

interface CFOExecutiveSummaryProps {
  currentMonth: PnlMonthly | null;      // Selected month from filter
  previousMonth: PnlMonthly | null;     // Previous month for MoM comparison
  budgetMonth: PnlMonthly | null;       // Budget for selected month
  allMonths: PnlMonthly[];              // For trend analysis
  year: number;
}

type HealthStatus = 'At Risk' | 'Average' | 'Good' | 'Excellent';

type BHIRating = 'Excellent' | 'Good' | 'Average' | 'At Risk';

interface BHIPillarScores {
  profitability: number;  // P score (0-100)
  growth: number;         // G score (0-100)
  efficiency: number;     // E score (0-100)
  resilience: number;     // R score (0-100)
}

interface BHIResult {
  score: number;           // Final 0-100 score
  rating: BHIRating;
  pillarScores: BHIPillarScores;
  redFlags: string[];       // Triggered penalties
  executiveSummary: string; // 3-sentence summary
  actions: {
    cost: string;
    revenue: string;
  };
}

interface MoMAnalysis {
  revenueChange: number;
  revenueChangePercent: number;
  laborChange: number;
  laborChangePercent: number;
  laborRatioChange: number; // Change in labor as % of revenue
  cogsChange: number;
  cogsChangePercent: number;
  cogsRatioChange: number;
  ebitChange: number;
  ebitChangePercent: number;
  grossMarginChange: number;
  categoryChanges: { name: string; change: number; changePercent: number }[];
  isStructural: boolean;
  structuralAssessment: string;
}

interface KeyDriver {
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  metric?: string;
}

interface CFOCommentary {
  beneathSurface: string;
  warningSignals: string[];
  sustainability: string;
}

interface StrategicAction {
  priority: number;
  action: string;
  rationale: string;
  category: 'margin' | 'cost' | 'revenue';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B đ`;
  }
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M đ`;
  }
  return `${value.toLocaleString()} đ`;
};

const formatPercent = (value: number): string => {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
};

const getMonthName = (month: number): string => {
  return new Date(2024, month - 1).toLocaleString('default', { month: 'long' });
};

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Calculate Business Health Index (BHI) using weighted formula:
 * BHI = (P × 0.40) + (G × 0.25) + (E × 0.20) + (R × 0.15)
 * 
 * P = Profitability (40% weight) - Based on EBIT Margin
 * G = Growth & Momentum (25% weight) - Based on MoM Revenue Growth
 * E = Efficiency (20% weight) - Based on Labor Ratio and COGS
 * R = Resilience & Diversification (15% weight) - Based on revenue concentration
 */
function calculateBHI(
  current: PnlMonthly,
  previous: PnlMonthly | null
): BHIResult {
  const redFlags: string[] = [];
  
  // ========================================
  // 1. PROFITABILITY (P) - 40% Weight
  // Target: EBIT Margin >= 25%
  // ========================================
  const ebitMargin = current.grossSales > 0 ? (current.ebit / current.grossSales) * 100 : 0;
  let profitabilityScore: number;
  
  if (ebitMargin >= 25) {
    profitabilityScore = 100;
  } else if (ebitMargin >= 10) {
    // Linear scale: 100 - (25 - margin) * 4
    profitabilityScore = 100 - (25 - ebitMargin) * 4;
  } else {
    profitabilityScore = 0;
    redFlags.push(`Low EBIT Margin (${ebitMargin.toFixed(1)}%)`);
  }
  
  // ========================================
  // 2. GROWTH & MOMENTUM (G) - 25% Weight
  // Target: MoM Revenue Growth >= 15%
  // ========================================
  let growthScore = 0;
  let momGrowth = 0;
  
  if (previous && previous.grossSales > 0) {
    momGrowth = ((current.grossSales - previous.grossSales) / previous.grossSales) * 100;
    
    if (momGrowth >= 15) {
      growthScore = 100;
    } else if (momGrowth >= 0) {
      // Linear scale: growth * 6.6
      growthScore = momGrowth * 6.6;
    } else {
      growthScore = 0;
      redFlags.push(`Negative Revenue Growth (${momGrowth.toFixed(1)}%)`);
    }
    
    // Penalty: Cap at 60 if any core category declines by >20%
    const categoryChanges = [
      { name: 'Food', prev: previous.revenueFood, curr: current.revenueFood },
      { name: 'Cocktails', prev: previous.revenueCocktails, curr: current.revenueCocktails },
      { name: 'Spirits', prev: previous.revenueSpirits, curr: current.revenueSpirits },
      { name: 'Beer', prev: previous.revenueBeer, curr: current.revenueBeer },
    ];
    
    for (const cat of categoryChanges) {
      if (cat.prev > 0) {
        const catChange = ((cat.curr - cat.prev) / cat.prev) * 100;
        if (catChange < -20) {
          growthScore = Math.min(growthScore, 60);
          redFlags.push(`${cat.name} Decline (${catChange.toFixed(1)}%)`);
        }
      }
    }
  } else {
    // No previous month data - neutral score
    growthScore = 50;
  }
  
  // ========================================
  // 3. EFFICIENCY (E) - 20% Weight
  // Target: Labor Ratio stable, COGS <= 30%
  // ========================================
  let efficiencyScore = 100;
  const currentLaborRatio = current.grossSales > 0 ? (current.laborCost / current.grossSales) * 100 : 0;
  const currentCogsRatio = current.grossSales > 0 ? (current.cogs / current.grossSales) * 100 : 0;
  
  // Subtract 10 points for every 1% increase in Labor Ratio MoM
  if (previous && previous.grossSales > 0) {
    const previousLaborRatio = (previous.laborCost / previous.grossSales) * 100;
    const laborRatioChange = currentLaborRatio - previousLaborRatio;
    
    if (laborRatioChange > 0) {
      const laborPenalty = laborRatioChange * 10;
      efficiencyScore -= laborPenalty;
      if (laborRatioChange > 2) {
        redFlags.push(`Labor Ratio Increase (+${laborRatioChange.toFixed(1)}%)`);
      }
    }
  }
  
  // Subtract 20 points if COGS exceeds 35%
  if (currentCogsRatio > 35) {
    efficiencyScore -= 20;
    redFlags.push(`High COGS (${currentCogsRatio.toFixed(1)}%)`);
  }
  
  efficiencyScore = Math.max(0, efficiencyScore);
  
  // ========================================
  // 4. RESILIENCE & DIVERSIFICATION (R) - 15% Weight
  // Target: No single category > 35% of total revenue
  // ========================================
  const totalRevenue = current.grossSales || 1;
  const categoryPercentages = [
    { name: 'Wine', pct: (current.revenueWine / totalRevenue) * 100 },
    { name: 'Spirits', pct: (current.revenueSpirits / totalRevenue) * 100 },
    { name: 'Cocktails', pct: (current.revenueCocktails / totalRevenue) * 100 },
    { name: 'Shisha', pct: (current.revenueShisha / totalRevenue) * 100 },
    { name: 'Beer', pct: (current.revenueBeer / totalRevenue) * 100 },
    { name: 'Food', pct: (current.revenueFood / totalRevenue) * 100 },
  ];
  
  const maxCategory = categoryPercentages.reduce((max, cat) => 
    cat.pct > max.pct ? cat : max, { name: '', pct: 0 });
  
  let resilienceScore: number;
  if (maxCategory.pct <= 35) {
    resilienceScore = 100;
  } else {
    // Score = 100 - (max% - 35) * 3
    resilienceScore = Math.max(0, 100 - (maxCategory.pct - 35) * 3);
    if (maxCategory.pct > 45) {
      redFlags.push(`Revenue Concentration (${maxCategory.name}: ${maxCategory.pct.toFixed(0)}%)`);
    }
  }
  
  // ========================================
  // CALCULATE FINAL BHI SCORE
  // BHI = (P × 0.40) + (G × 0.25) + (E × 0.20) + (R × 0.15)
  // ========================================
  const finalScore = Math.round(
    (profitabilityScore * 0.40) +
    (growthScore * 0.25) +
    (efficiencyScore * 0.20) +
    (resilienceScore * 0.15)
  );
  
  // ========================================
  // DETERMINE RATING
  // ========================================
  let rating: BHIRating;
  if (finalScore >= 85) rating = 'Excellent';
  else if (finalScore >= 70) rating = 'Good';
  else if (finalScore >= 50) rating = 'Average';
  else rating = 'At Risk';
  
  // ========================================
  // GENERATE EXECUTIVE SUMMARY (3 sentences)
  // ========================================
  const monthName = getMonthName(current.month);
  let summaryParts: string[] = [];
  
  // Sentence 1: Overall performance
  if (finalScore >= 85) {
    summaryParts.push(`${monthName} delivered exceptional business performance with a BHI of ${finalScore}/100.`);
  } else if (finalScore >= 70) {
    summaryParts.push(`${monthName} showed solid business fundamentals with a BHI of ${finalScore}/100.`);
  } else if (finalScore >= 50) {
    summaryParts.push(`${monthName} reflected mixed performance requiring attention, with a BHI of ${finalScore}/100.`);
  } else {
    summaryParts.push(`${monthName} signals business stress with a concerning BHI of ${finalScore}/100.`);
  }
  
  // Sentence 2: Key driver
  const strongestPillar = [
    { name: 'profitability', score: profitabilityScore },
    { name: 'growth momentum', score: growthScore },
    { name: 'operational efficiency', score: efficiencyScore },
    { name: 'revenue diversification', score: resilienceScore },
  ].reduce((max, p) => p.score > max.score ? p : max);
  
  if (strongestPillar.score >= 80) {
    summaryParts.push(`Strong ${strongestPillar.name} (${strongestPillar.score}/100) was the primary driver.`);
  } else {
    summaryParts.push(`No single pillar showed exceptional strength, indicating balanced but modest performance.`);
  }
  
  // Sentence 3: Red flags or positive outlook
  if (redFlags.length > 0) {
    summaryParts.push(`Key concerns include: ${redFlags.slice(0, 2).join(', ')}.`);
  } else {
    summaryParts.push(`All key metrics are within healthy ranges with no material red flags.`);
  }
  
  // ========================================
  // GENERATE STRATEGIC ACTIONS
  // ========================================
  let costAction: string;
  let revenueAction: string;
  
  // Cost action based on weakest cost-related pillar
  if (efficiencyScore < 70) {
    if (currentCogsRatio > 30) {
      costAction = `Review supplier contracts and menu pricing to reduce COGS from ${currentCogsRatio.toFixed(1)}% toward the 30% target.`;
    } else {
      costAction = `Optimize labor scheduling to improve the labor-to-revenue ratio, currently at ${currentLaborRatio.toFixed(1)}%.`;
    }
  } else {
    costAction = `Maintain current cost controls while exploring automation opportunities to protect margins.`;
  }
  
  // Revenue action based on growth and resilience
  if (growthScore < 70) {
    if (momGrowth < 0) {
      revenueAction = `Launch targeted promotions to reverse the ${Math.abs(momGrowth).toFixed(1)}% revenue decline and restore growth momentum.`;
    } else {
      revenueAction = `Intensify marketing efforts to achieve the 15% MoM growth target; current growth is ${momGrowth.toFixed(1)}%.`;
    }
  } else if (resilienceScore < 70) {
    revenueAction = `Diversify revenue streams to reduce dependency on ${maxCategory.name} (${maxCategory.pct.toFixed(0)}% of revenue).`;
  } else {
    revenueAction = `Capitalize on momentum by expanding successful categories and testing new revenue streams.`;
  }
  
  return {
    score: finalScore,
    rating,
    pillarScores: {
      profitability: Math.round(profitabilityScore),
      growth: Math.round(growthScore),
      efficiency: Math.round(efficiencyScore),
      resilience: Math.round(resilienceScore),
    },
    redFlags,
    executiveSummary: summaryParts.join(' '),
    actions: {
      cost: costAction,
      revenue: revenueAction,
    },
  };
}

/**
 * Analyze month-over-month changes
 */
function analyzeMoMChanges(
  current: PnlMonthly,
  previous: PnlMonthly | null,
  allMonths: PnlMonthly[]
): MoMAnalysis {
  if (!previous) {
    return {
      revenueChange: 0,
      revenueChangePercent: 0,
      laborChange: 0,
      laborChangePercent: 0,
      laborRatioChange: 0,
      cogsChange: 0,
      cogsChangePercent: 0,
      cogsRatioChange: 0,
      ebitChange: 0,
      ebitChangePercent: 0,
      grossMarginChange: 0,
      categoryChanges: [],
      isStructural: false,
      structuralAssessment: 'First month of data - no comparison available.'
    };
  }

  // Revenue changes
  const revenueChange = current.grossSales - previous.grossSales;
  const revenueChangePercent = previous.grossSales > 0 
    ? (revenueChange / previous.grossSales) * 100 
    : 0;

  // Labor changes
  const laborChange = current.laborCost - previous.laborCost;
  const laborChangePercent = previous.laborCost > 0 
    ? (laborChange / previous.laborCost) * 100 
    : 0;
  const currentLaborRatio = current.grossSales > 0 ? (current.laborCost / current.grossSales) * 100 : 0;
  const prevLaborRatio = previous.grossSales > 0 ? (previous.laborCost / previous.grossSales) * 100 : 0;
  const laborRatioChange = currentLaborRatio - prevLaborRatio;

  // COGS changes
  const cogsChange = current.cogs - previous.cogs;
  const cogsChangePercent = previous.cogs > 0 
    ? (cogsChange / previous.cogs) * 100 
    : 0;
  const currentCogsRatio = current.grossSales > 0 ? (current.cogs / current.grossSales) * 100 : 0;
  const prevCogsRatio = previous.grossSales > 0 ? (previous.cogs / previous.grossSales) * 100 : 0;
  const cogsRatioChange = currentCogsRatio - prevCogsRatio;

  // EBIT changes
  const ebitChange = current.ebit - previous.ebit;
  const ebitChangePercent = previous.ebit !== 0 
    ? (ebitChange / Math.abs(previous.ebit)) * 100 
    : (current.ebit > 0 ? 100 : -100);

  // Gross margin change
  const currentGrossMargin = current.grossSales > 0 
    ? ((current.grossSales - current.cogs) / current.grossSales) * 100 
    : 0;
  const prevGrossMargin = previous.grossSales > 0 
    ? ((previous.grossSales - previous.cogs) / previous.grossSales) * 100 
    : 0;
  const grossMarginChange = currentGrossMargin - prevGrossMargin;

  // Category-level changes
  const categories = [
    { name: 'Cocktails', current: current.revenueCocktails, previous: previous.revenueCocktails },
    { name: 'Spirits', current: current.revenueSpirits, previous: previous.revenueSpirits },
    { name: 'Shisha', current: current.revenueShisha, previous: previous.revenueShisha },
    { name: 'Wine', current: current.revenueWine, previous: previous.revenueWine },
    { name: 'Food', current: current.revenueFood, previous: previous.revenueFood },
    { name: 'Beer', current: current.revenueBeer, previous: previous.revenueBeer },
    { name: 'Balloons', current: current.revenueBalloons, previous: previous.revenueBalloons },
    { name: 'Other', current: current.revenueOther, previous: previous.revenueOther },
  ];

  const categoryChanges = categories
    .map(cat => ({
      name: cat.name,
      change: cat.current - cat.previous,
      changePercent: cat.previous > 0 ? ((cat.current - cat.previous) / cat.previous) * 100 : 0
    }))
    .filter(cat => Math.abs(cat.change) > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  // Structural vs Temporary assessment
  let isStructural = false;
  let structuralAssessment = '';

  if (allMonths.length >= 3) {
    const last3Months = allMonths.slice(-3);
    const revenuesTrend = last3Months.map(m => m.grossSales);
    const isConsistentGrowth = revenuesTrend[2] > revenuesTrend[1] && revenuesTrend[1] > revenuesTrend[0];
    const isConsistentDecline = revenuesTrend[2] < revenuesTrend[1] && revenuesTrend[1] < revenuesTrend[0];

    if (isConsistentGrowth || isConsistentDecline) {
      isStructural = true;
      structuralAssessment = isConsistentGrowth 
        ? 'Three-month upward trend suggests structural improvement in market position.'
        : 'Three-month downward trend indicates potential structural challenges requiring strategic review.';
    } else {
      structuralAssessment = 'Month-over-month changes appear temporary, likely driven by seasonal or one-time factors.';
    }
  } else {
    structuralAssessment = 'Insufficient historical data to determine structural vs temporary nature.';
  }

  return {
    revenueChange,
    revenueChangePercent,
    laborChange,
    laborChangePercent,
    laborRatioChange,
    cogsChange,
    cogsChangePercent,
    cogsRatioChange,
    ebitChange,
    ebitChangePercent,
    grossMarginChange,
    categoryChanges,
    isStructural,
    structuralAssessment
  };
}

/**
 * Identify key positive drivers and risks
 */
function identifyKeyDrivers(
  current: PnlMonthly,
  budget: PnlMonthly | null,
  momAnalysis: MoMAnalysis
): { positive: KeyDriver[]; risks: KeyDriver[] } {
  const positive: KeyDriver[] = [];
  const risks: KeyDriver[] = [];

  // Revenue category analysis
  const topGrowthCategories = momAnalysis.categoryChanges
    .filter(c => c.change > 0)
    .slice(0, 2);

  topGrowthCategories.forEach(cat => {
    positive.push({
      title: `${cat.name} Growth`,
      description: `${cat.name} revenue increased by ${formatCurrency(cat.change)} (${formatPercent(cat.changePercent)}) MoM, demonstrating strong demand.`,
      impact: 'positive',
      metric: formatPercent(cat.changePercent)
    });
  });

  // Declining categories as risks
  const decliningCategories = momAnalysis.categoryChanges
    .filter(c => c.change < 0 && Math.abs(c.changePercent) > 10)
    .slice(0, 1);

  decliningCategories.forEach(cat => {
    risks.push({
      title: `${cat.name} Decline`,
      description: `${cat.name} revenue decreased by ${formatPercent(cat.changePercent)}, requiring investigation into demand drivers.`,
      impact: 'negative',
      metric: formatPercent(cat.changePercent)
    });
  });

  // Profitability as driver
  if (current.ebit > 0) {
    const ebitMargin = (current.ebit / current.grossSales) * 100;
    if (ebitMargin > 15) {
      positive.push({
        title: 'Strong Margin Performance',
        description: `EBIT margin of ${ebitMargin.toFixed(1)}% reflects effective cost management and pricing strategy.`,
        impact: 'positive',
        metric: `${ebitMargin.toFixed(1)}%`
      });
    }
  } else {
    risks.push({
      title: 'Profitability Concern',
      description: `Operating at a loss of ${formatCurrency(Math.abs(current.ebit))}. Immediate review of cost structure required.`,
      impact: 'negative',
      metric: formatCurrency(current.ebit)
    });
  }

  // Labor efficiency
  const laborRatio = current.grossSales > 0 ? (current.laborCost / current.grossSales) * 100 : 0;
  if (laborRatio < 15) {
    positive.push({
      title: 'Labor Efficiency',
      description: `Labor costs at ${laborRatio.toFixed(1)}% of revenue indicate efficient workforce utilization.`,
      impact: 'positive',
      metric: `${laborRatio.toFixed(1)}%`
    });
  } else if (laborRatio > 20) {
    risks.push({
      title: 'Labor Cost Pressure',
      description: `Labor at ${laborRatio.toFixed(1)}% of revenue exceeds optimal threshold. Staffing optimization may be needed.`,
      impact: 'negative',
      metric: `${laborRatio.toFixed(1)}%`
    });
  }

  // COGS efficiency
  const cogsRatio = current.grossSales > 0 ? (current.cogs / current.grossSales) * 100 : 0;
  if (cogsRatio < 25) {
    positive.push({
      title: 'Supply Chain Efficiency',
      description: `COGS at ${cogsRatio.toFixed(1)}% demonstrates effective procurement and inventory management.`,
      impact: 'positive',
      metric: `${cogsRatio.toFixed(1)}%`
    });
  } else if (cogsRatio > 30) {
    risks.push({
      title: 'COGS Escalation',
      description: `COGS at ${cogsRatio.toFixed(1)}% is compressing margins. Supplier renegotiation advised.`,
      impact: 'negative',
      metric: `${cogsRatio.toFixed(1)}%`
    });
  }

  // Budget performance
  if (budget && budget.grossSales > 0) {
    const budgetVariance = ((current.grossSales - budget.grossSales) / budget.grossSales) * 100;
    if (budgetVariance > 5) {
      positive.push({
        title: 'Budget Outperformance',
        description: `Revenue exceeds budget by ${formatPercent(budgetVariance)}, indicating stronger than expected market conditions.`,
        impact: 'positive',
        metric: formatPercent(budgetVariance)
      });
    } else if (budgetVariance < -10) {
      risks.push({
        title: 'Budget Shortfall',
        description: `Revenue ${formatPercent(Math.abs(budgetVariance))} below budget. Assess market conditions and adjust forecasts.`,
        impact: 'negative',
        metric: formatPercent(budgetVariance)
      });
    }
  }

  return {
    positive: positive.slice(0, 3),
    risks: risks.slice(0, 2)
  };
}

/**
 * Generate CFO commentary - beneath the surface analysis
 */
function generateCFOCommentary(
  current: PnlMonthly,
  previous: PnlMonthly | null,
  allMonths: PnlMonthly[],
  momAnalysis: MoMAnalysis
): CFOCommentary {
  const warningSignals: string[] = [];
  
  // Beneath the surface analysis
  let beneathSurface = '';
  
  // Revenue concentration analysis
  const totalRevenue = current.grossSales;
  const categoryShares = [
    { name: 'Cocktails', share: (current.revenueCocktails / totalRevenue) * 100 },
    { name: 'Shisha', share: (current.revenueShisha / totalRevenue) * 100 },
    { name: 'Spirits', share: (current.revenueSpirits / totalRevenue) * 100 },
    { name: 'Food', share: (current.revenueFood / totalRevenue) * 100 },
  ].sort((a, b) => b.share - a.share);

  const topCategory = categoryShares[0];
  
  if (topCategory.share > 35) {
    beneathSurface = `Revenue concentration is notable with ${topCategory.name} representing ${topCategory.share.toFixed(0)}% of gross sales. `;
    warningSignals.push(`High dependency on ${topCategory.name} (${topCategory.share.toFixed(0)}% of revenue) creates category-specific risk.`);
  } else {
    beneathSurface = `Revenue mix shows healthy diversification with no single category exceeding 35% of sales. `;
  }

  // Labor productivity analysis
  const laborPerSale = current.grossSales > 0 ? current.laborCost / current.grossSales : 0;
  if (previous) {
    const prevLaborPerSale = previous.grossSales > 0 ? previous.laborCost / previous.grossSales : 0;
    if (laborPerSale > prevLaborPerSale * 1.05) {
      beneathSurface += `Labor productivity has declined - each dollar of revenue now costs more in labor. `;
      warningSignals.push('Labor cost per revenue unit increased MoM - review scheduling efficiency.');
    } else if (laborPerSale < prevLaborPerSale * 0.95) {
      beneathSurface += `Labor productivity improved, suggesting operational efficiency gains. `;
    }
  }

  // Margin trend analysis
  if (allMonths.length >= 3) {
    const recentMargins = allMonths.slice(-3).map(m => 
      m.grossSales > 0 ? (m.ebit / m.grossSales) * 100 : 0
    );
    const marginTrend = recentMargins[2] - recentMargins[0];
    
    if (marginTrend < -3) {
      beneathSurface += `Three-month margin compression of ${Math.abs(marginTrend).toFixed(1)}% signals cost structure issues. `;
      warningSignals.push('Margin erosion trend detected - investigate cost drivers before they become structural.');
    } else if (marginTrend > 3) {
      beneathSurface += `Margin expansion of ${marginTrend.toFixed(1)}% over three months indicates improving unit economics. `;
    }
  }

  // COGS trend
  if (momAnalysis.cogsRatioChange > 2) {
    warningSignals.push('COGS as % of revenue increased - monitor supplier pricing and waste levels.');
  }

  // Sustainability assessment
  let sustainability = '';
  const ebitMargin = current.grossSales > 0 ? (current.ebit / current.grossSales) * 100 : 0;
  
  if (current.ebit > 0 && ebitMargin > 10) {
    if (momAnalysis.isStructural && momAnalysis.revenueChangePercent > 0) {
      sustainability = 'Current performance appears sustainable with structural growth drivers in place. Continue monitoring cost ratios to protect margins as revenue scales.';
    } else {
      sustainability = 'Profitability is healthy but driven by factors that may not persist. Build operational buffers and avoid commitments based on current peak performance.';
    }
  } else if (current.ebit > 0) {
    sustainability = 'Marginal profitability leaves little room for error. Focus on operational consistency and gradual efficiency improvements.';
  } else {
    sustainability = 'Current loss position is unsustainable. Immediate action required on cost reduction or revenue acceleration to return to profitability.';
  }

  // Add default warning if none found
  if (warningSignals.length === 0) {
    warningSignals.push('No immediate warning signals detected. Maintain current monitoring cadence.');
  }

  return {
    beneathSurface: beneathSurface || 'Financial metrics are within expected ranges. Continue standard operational focus.',
    warningSignals,
    sustainability
  };
}

/**
 * Generate strategic action recommendations
 */
function generateStrategicActions(
  current: PnlMonthly,
  momAnalysis: MoMAnalysis,
  drivers: { positive: KeyDriver[]; risks: KeyDriver[] }
): StrategicAction[] {
  const actions: StrategicAction[] = [];
  
  const laborRatio = current.grossSales > 0 ? (current.laborCost / current.grossSales) * 100 : 0;
  const cogsRatio = current.grossSales > 0 ? (current.cogs / current.grossSales) * 100 : 0;
  const ebitMargin = current.grossSales > 0 ? (current.ebit / current.grossSales) * 100 : 0;

  // Priority 1: Address profitability if negative
  if (current.ebit < 0) {
    actions.push({
      priority: 1,
      action: 'Implement immediate cost containment measures targeting 15% reduction in controllable expenses.',
      rationale: 'Operating loss requires urgent action to preserve cash and restore path to profitability.',
      category: 'cost'
    });
  }

  // Margin protection
  if (ebitMargin < 10 && ebitMargin > 0) {
    actions.push({
      priority: actions.length + 1,
      action: 'Review pricing strategy for top 5 SKUs to protect margins without sacrificing volume.',
      rationale: `Current ${ebitMargin.toFixed(1)}% EBIT margin provides limited buffer against cost increases.`,
      category: 'margin'
    });
  }

  // Labor optimization
  if (laborRatio > 18) {
    actions.push({
      priority: actions.length + 1,
      action: 'Optimize staffing schedules using demand forecasting to reduce labor cost to 16% of revenue.',
      rationale: `Labor at ${laborRatio.toFixed(1)}% exceeds industry benchmark. ${(laborRatio - 16).toFixed(1)}% improvement potential.`,
      category: 'cost'
    });
  }

  // COGS optimization
  if (cogsRatio > 27) {
    actions.push({
      priority: actions.length + 1,
      action: 'Renegotiate supplier contracts for top 3 volume items targeting 5-8% cost reduction.',
      rationale: `COGS at ${cogsRatio.toFixed(1)}% is compressing gross margin. Procurement leverage available.`,
      category: 'cost'
    });
  }

  // Revenue leverage from top performers
  if (drivers.positive.length > 0 && momAnalysis.categoryChanges.length > 0) {
    const topGrower = momAnalysis.categoryChanges.find(c => c.change > 0);
    if (topGrower) {
      actions.push({
        priority: actions.length + 1,
        action: `Double down on ${topGrower.name} category with enhanced promotion and inventory depth.`,
        rationale: `${topGrower.name} showing ${formatPercent(topGrower.changePercent)} growth - capitalize on momentum.`,
        category: 'revenue'
      });
    }
  }

  // Revenue diversification if concentrated
  const totalRevenue = current.grossSales;
  const maxCategoryShare = Math.max(
    current.revenueCocktails / totalRevenue,
    current.revenueShisha / totalRevenue,
    current.revenueSpirits / totalRevenue,
    current.revenueFood / totalRevenue
  ) * 100;

  if (maxCategoryShare > 40) {
    actions.push({
      priority: actions.length + 1,
      action: 'Develop promotional campaigns for underperforming categories to reduce revenue concentration risk.',
      rationale: `Single category represents ${maxCategoryShare.toFixed(0)}% of revenue - diversification reduces volatility.`,
      category: 'revenue'
    });
  }

  // Default action if few issues
  if (actions.length < 2) {
    actions.push({
      priority: actions.length + 1,
      action: 'Maintain current operational cadence while building 2-month expense reserve.',
      rationale: 'Strong performance warrants defensive positioning to sustain through potential headwinds.',
      category: 'margin'
    });
  }

  return actions.slice(0, 3);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CFOExecutiveSummary({ 
  currentMonth, 
  previousMonth, 
  budgetMonth, 
  allMonths, 
  year 
}: CFOExecutiveSummaryProps) {
  
  // Early return if no data
  if (!currentMonth) {
    return null;
  }

  // Calculate BHI (Business Health Index)
  const bhi = useMemo(
    () => calculateBHI(currentMonth, previousMonth),
    [currentMonth, previousMonth]
  );
  
  const momAnalysis = useMemo(
    () => analyzeMoMChanges(currentMonth, previousMonth, allMonths),
    [currentMonth, previousMonth, allMonths]
  );

  const drivers = useMemo(
    () => identifyKeyDrivers(currentMonth, budgetMonth, momAnalysis),
    [currentMonth, budgetMonth, momAnalysis]
  );

  const cfoCommentary = useMemo(
    () => generateCFOCommentary(currentMonth, previousMonth, allMonths, momAnalysis),
    [currentMonth, previousMonth, allMonths, momAnalysis]
  );

  const strategicActions = useMemo(
    () => generateStrategicActions(currentMonth, momAnalysis, drivers),
    [currentMonth, momAnalysis, drivers]
  );

  const today = new Date();
  const editionMonth = (
    year > today.getFullYear() ||
    (year === today.getFullYear() && currentMonth.month > today.getMonth() + 1)
  ) ? today.getMonth() + 1 : currentMonth.month;
  const editionYear = year > today.getFullYear() ? today.getFullYear() : year;
  const monthName = getMonthName(editionMonth);

  const healthColors: Record<HealthStatus, { bg: string; text: string; border: string }> = {
    'Excellent': { bg: 'bg-success/20', text: 'text-success', border: 'border-success/30' },
    'Good': { bg: 'bg-success/20', text: 'text-success', border: 'border-success/30' },
    'Average': { bg: 'bg-warning/20', text: 'text-warning', border: 'border-warning/30' },
    'At Risk': { bg: 'bg-error/20', text: 'text-error', border: 'border-error/30' },
  };

  return (
    <div className="rounded-card border border-border bg-card overflow-hidden shadow-card">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-card to-muted/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Confidential Internal Memorandum</p>
            <h2 className="text-xl font-serif text-foreground">CFO Executive Summary</h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{monthName} {editionYear} Edition</p>
            <p className="text-xs text-muted-foreground">Published {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Row 1: BHI + Executive Summary + Strategic Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* BHI Score Card */}
          <div className="lg:col-span-3 rounded-card border border-border bg-background/40 dark:bg-background p-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">Business Health Index</p>
            <div className="flex items-baseline gap-1 mb-2">
              <span className={`text-5xl font-bold ${healthColors[bhi.rating].text}`}>{bhi.score}</span>
              <span className="text-muted-foreground text-xl">/ 100</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${healthColors[bhi.rating].bg} ${healthColors[bhi.rating].text} mb-5`}>
              <CheckCircle className="h-3 w-3" />
              {bhi.rating.toUpperCase()}
            </div>
            
            {/* Pillar Breakdown */}
            <div className="space-y-3 border-t border-border pt-4">
              {[
                { label: 'Profitability (40%)', value: bhi.pillarScores.profitability },
                { label: 'Growth (25%)', value: bhi.pillarScores.growth },
                { label: 'Efficiency (20%)', value: bhi.pillarScores.efficiency },
                { label: 'Resilience (15%)', value: bhi.pillarScores.resilience },
              ].map((pillar, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground uppercase tracking-wide text-[10px]">{pillar.label}</span>
                    <span className="text-foreground font-semibold">{pillar.value}</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${pillar.value >= 70 ? 'bg-success' : pillar.value >= 40 ? 'bg-warning' : 'bg-error'}`}
                      style={{ width: `${pillar.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Summary */}
          <div className="lg:col-span-5 rounded-card border border-border bg-background/40 dark:bg-background p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">1. Executive Summary</p>
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-5">
              {bhi.executiveSummary}
            </p>
            
            {/* Sub-sections */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">The Numbers</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{cfoCommentary.beneathSurface}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Sustainability</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{cfoCommentary.sustainability}</p>
              </div>
            </div>
          </div>

          {/* Strategic Actions */}
          <div className="lg:col-span-4 rounded-card border border-border bg-background/40 dark:bg-background p-5 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-4 w-4 text-warning" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Strategic Actions</p>
            </div>
            
            <div className="space-y-3">
              {/* Cost Action */}
              <div className="rounded-lg bg-card border-l-2 border-warning p-3">
                <p className="text-[10px] text-warning uppercase tracking-widest mb-1">Cost Action</p>
                <p className="text-xs text-foreground leading-relaxed">{bhi.actions.cost}</p>
              </div>
              
              {/* Revenue Action */}
              <div className="rounded-lg bg-card border-l-2 border-success p-3 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
                <p className="text-[10px] text-success uppercase tracking-widest mb-1">Revenue Action</p>
                <p className="text-xs text-foreground leading-relaxed">{bhi.actions.revenue}</p>
              </div>
              
              {/* Constraints */}
              {drivers.risks.length > 0 && (
                <div className="rounded-lg bg-card border-l-2 border-error p-3">
                  <p className="text-[10px] text-error uppercase tracking-widest mb-2">Constraints</p>
                  <div className="space-y-1.5">
                    {drivers.risks.slice(0, 2).map((risk, i) => {
                      const getActionForRisk = (title: string): string => {
                        if (title.includes('Wine')) return 'Run wine promotions or curated tasting events to offset downward trend.';
                        if (title.includes('Spirits')) return 'Launch cocktail specials featuring premium spirits.';
                        if (title.includes('Cocktail')) return 'Introduce seasonal cocktail menu or happy hour deals.';
                        if (title.includes('Food')) return 'Review menu pricing and introduce new dishes.';
                        if (title.includes('Beer')) return 'Partner with breweries for exclusive offerings.';
                        if (title.includes('Shisha')) return 'Expand shisha flavor selection and promotions.';
                        if (title.includes('Labor')) return 'Optimize scheduling and review staffing levels.';
                        if (title.includes('COGS') || title.includes('Cost')) return 'Renegotiate supplier contracts.';
                        if (title.includes('Margin')) return 'Review pricing strategy and cost controls.';
                        return 'Investigate root cause and develop action plan.';
                      };
                      return (
                        <div key={i}>
                          <p className="text-xs text-error font-medium">{risk.title}</p>
                          <p className="text-[10px] text-muted-foreground">{getActionForRisk(risk.title)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Month-to-Month Analysis */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">2. Month-to-Month Financial Analysis</p>
          </div>
          
          {previousMonth ? (
            <div className="space-y-4">
              {/* Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { 
                    label: 'Revenue MoM', 
                    value: formatPercent(momAnalysis.revenueChangePercent),
                    sub: formatCurrency(momAnalysis.revenueChange),
                    isPositive: momAnalysis.revenueChangePercent >= 0 
                  },
                  { 
                    label: 'Labor Ratio Δ', 
                    value: `${momAnalysis.laborRatioChange >= 0 ? '+' : ''}${momAnalysis.laborRatioChange.toFixed(1)}%`,
                    sub: 'vs prior month',
                    isPositive: momAnalysis.laborRatioChange <= 0 
                  },
                  { 
                    label: 'Gross Margin Δ', 
                    value: `${momAnalysis.grossMarginChange >= 0 ? '+' : ''}${momAnalysis.grossMarginChange.toFixed(1)}%`,
                    sub: 'margin impact',
                    isPositive: momAnalysis.grossMarginChange >= 0 
                  },
                  { 
                    label: 'EBIT MoM', 
                    value: formatCurrency(momAnalysis.ebitChange),
                    sub: formatPercent(momAnalysis.ebitChangePercent),
                    isPositive: momAnalysis.ebitChange >= 0 
                  },
                ].map((metric, idx) => (
                  <div key={idx} className="rounded-card border border-border bg-background/40 dark:bg-background p-4">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{metric.label}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-bold ${metric.isPositive ? 'text-success' : 'text-error'}`}>
                        {metric.value}
                      </span>
                      {metric.isPositive ? (
                        <ArrowUpRight className="h-4 w-4 text-success" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-error" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{metric.sub}</p>
                  </div>
                ))}
              </div>

              {/* Category Cards */}
              {momAnalysis.categoryChanges.length > 0 && (
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                  {momAnalysis.categoryChanges.slice(0, 8).map(cat => {
                    const categoryColors: Record<string, string> = {
                      'Wine': '#722F37', 'Spirits': '#D4A574', 'Cocktails': '#E67E22', 'Shisha': '#9B59B6',
                      'Beer': '#F1C40F', 'Food': '#27AE60', 'Balloons': '#3498DB', 'Other': '#95A5A6',
                    };
                    const color = categoryColors[cat.name] || '#95A5A6';
                    return (
                      <div key={cat.name} className="rounded-lg border border-border bg-background/40 dark:bg-background p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{cat.name}</span>
                        </div>
                        <span className={`text-sm font-bold ${cat.change >= 0 ? 'text-success' : 'text-error'}`}>
                          {formatPercent(cat.changePercent)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-card border border-border bg-background/40 dark:bg-background p-4 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
              <p className="text-sm text-muted-foreground italic">No prior month data available for comparison.</p>
            </div>
          )}
        </div>

        {/* Row 3: Key Drivers & Strategic Implications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Key Drivers */}
          <div className="rounded-card border border-border bg-background/40 dark:bg-background p-5 shadow-[0px_2px_3px_0px_rgba(0,0,0,0.15)]">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-success" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">3. Key Drivers</p>
            </div>
            <div className="space-y-3">
              {drivers.positive.length > 0 ? drivers.positive.slice(0, 3).map((driver, i) => (
                <div key={i} className="rounded-lg bg-success/5 border border-success/20 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-success">{driver.title}</p>
                    {driver.metric && (
                      <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded font-medium">
                        {driver.metric}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{driver.description}</p>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground italic">No significant positive drivers identified.</p>
              )}
            </div>
          </div>

          {/* Strategic Implications */}
          <div className="rounded-card border border-border bg-background/40 dark:bg-background p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="h-4 w-4 text-info" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">4. Strategic Implications</p>
            </div>
            <div className="space-y-3">
              {strategicActions.slice(0, 2).map((action, i) => (
                <div key={i} className="rounded-lg bg-card border-l-2 border-info p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-info uppercase tracking-widest font-medium">
                      Action {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wide font-medium ${
                      action.category === 'cost' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
                    }`}>
                      {action.category}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-medium mb-1">{action.action}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{action.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 py-3 bg-background flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Proprietary Information — Distribution Prohibited</p>
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">The Roof Command Center</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Page 01 of 01</span>
        </div>
      </div>
    </div>
  );
}
