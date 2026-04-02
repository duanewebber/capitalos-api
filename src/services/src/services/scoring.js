/**
 * CapitalOS Scoring Service
 * Implements the 7-Dimension Capital Readiness Engine + DEFLOW Match Scoring.
 *
 * Capital Readiness Dimensions (each 0â100):
 *   1. Financial Strength         â revenue, margins, cash, debt
 *   2. Market Validation          â market size, traction, growth rate
 *   3. Management Quality         â team experience, board, advisors
 *   4. Capital Structure          â existing equity, debt covenants, cap table
 *   5. Regulatory Compliance      â KYC/AML, sector licences, CIPC status
 *   6. Exit Potential             â IRR pathways, comparable exits, strategic buyers
 *   7. ESG Score                  â environmental, social, governance posture
 *
 * DEFLOW Match Weights:
 *   Deal fit (sector + geography + size)  40%
 *   Financial profile alignment           20%
 *   Stage compatibility                   15%
 *   Risk tolerance match                  15%
 *   ESG alignment                         10%
 */

const supabase = require('../lib/supabase');

function scoreDimension(dimension, data) {
  switch (dimension) {
    case 'financial_strength': return scoreFinancialStrength(data);
    case 'market_validation': return scoreMarketValidation(data);
    case 'management_quality': return scoreManagementQuality(data);
    case 'capital_structure': return scoreCapitalStructure(data);
    case 'regulatory_compliance': return scoreRegulatoryCompliance(data);
    case 'exit_potential': return scoreExitPotential(data);
    case 'esg_score': return scoreESG(data);
    default: return { score: 0, flags: ['unknown_dimension'], missing: [] };
  }
}

function scoreFinancialStrength(d) {
  let score = 0; const flags = []; const missing = [];
  if (d.annual_revenue_zar) { score += Math.min(25, (d.annual_revenue_zar / 10_000_000) * 25); } else { missing.push('annual_revenue_zar'); }
  if (d.gross_margin_pct != null) { score += d.gross_margin_pct >= 40 ? 20 : d.gross_margin_pct >= 20 ? 12 : 5; } else { missing.push('gross_margin_pct'); }
  if (d.months_runway != null) { score += d.months_runway >= 18 ? 20 : d.months_runway >= 12 ? 12 : d.months_runway >= 6 ? 6 : 0; if (d.months_runway < 6) flags.push('low_runway'); } else { missing.push('months_runway'); }
  if (d.debt_to_equity != null) { score += d.debt_to_equity <= 0.5 ? 20 : d.debt_to_equity <= 1 ? 12 : d.debt_to_equity <= 2 ? 6 : 0; if (d.debt_to_equity > 2) flags.push('high_leverage'); } else { missing.push('debt_to_equity'); }
  if (d.has_audited_financials) score += 15;
  else if (d.has_management_accounts) score += 8;
  else { missing.push('financial_statements'); flags.push('unaudited'); }
  return { score: Math.min(100, Math.round(score)), flags, missing };
}

function scoreMarketValidation(d) {
  let score = 0; const flags = []; const missing = [];
  if (d.tam_zar) { score += d.tam_zar >= 1_000_000_000 ? 20 : d.tam_zar >= 100_000_000 ? 12 : 6; } else { missing.push('tam_zar'); }
  if (d.yoy_revenue_growth_pct != null) { score += d.yoy_revenue_growth_pct >= 50 ? 30 : d.yoy_revenue_growth_pct >= 20 ? 18 : d.yoy_revenue_growth_pct >= 0 ? 8 : 0; if (d.yoy_revenue_growth_pct < 0) flags.push('revenue_declining'); } else { missing.push('yoy_revenue_growth_pct'); }
  if (d.paying_customers != null) { score += d.paying_customers >= 100 ? 25 : d.paying_customers >= 20 ? 15 : d.paying_customers >= 5 ? 8 : 2; } else { missing.push('paying_customers'); }
  if (d.has_anchor_client) score += 15;
  if (d.has_loi_or_contracts) score += 10;
  return { score: Math.min(100, Math.round(score)), flags, missing };
}

function scoreManagementQuality(d) {
  let score = 0; const flags = []; const missing = [];
  if (d.ceo_years_experience != null) { score += Math.min(25, d.ceo_years_experience * 2.5); } else { missing.push('ceo_years_experience'); }
  if (d.team_size != null) { score += d.team_size >= 10 ? 20 : d.team_size >= 5 ? 12 : d.team_size >= 2 ? 6 : 2; } else { missing.push('team_size'); }
  if (d.has_board_or_advisors) score += 20;
  if (d.has_domain_expertise) score += 20;
  if (d.previous_exit) score += 15;
  return { score: Math.min(100, Math.round(score)), flags, missing };
}

function scoreCapitalStructure(d) {
  let score = 50; const flags = []; const missing = [];
  if (d.has_clean_cap_table === false) { score -= 20; flags.push('messy_cap_table'); }
  if (d.has_debt_covenants) { score -= 10; flags.push('debt_covenants'); }
  if (d.has_preference_stack && d.preference_multiple > 2) { score -= 15; flags.push('punitive_preference'); }
  if (d.previous_round_raised_zar) score += 15;
  if (d.has_sars_tax_clearance) score += 10;
  if (d.has_cipc_registration) { score += 15; } else { missing.push('cipc_registration'); flags.push('no_cipc'); }
  return { score: Math.max(0, Math.min(100, Math.round(score))), flags, missing };
}

function scoreRegulatoryCompliance(d) {
  let score = 40; const flags = []; const missing = [];
  if (d.has_kyc_passed) { score += 30; } else { missing.push('kyc_documents'); flags.push('kyc_pending'); }
  if (d.has_sars_tax_clearance) { score += 20; } else { missing.push('tax_clearance'); flags.push('no_tax_clearance'); }
  if (d.has_sector_licence) score += 10;
  if (d.has_bbbee_certificate) { score += 10; } else { missing.push('bbbee_certificate'); }
  if (d.has_outstanding_litigation) { score -= 20; flags.push('litigation_risk'); }
  return { score: Math.max(0, Math.min(100, Math.round(score))), flags, missing };
}

function scoreExitPotential(d) {
  let score = 30; const flags = []; const missing = [];
  if (d.target_exit_multiple) { score += Math.min(30, d.target_exit_multiple * 5); } else { missing.push('target_exit_multiple'); }
  if (d.has_strategic_buyers_identified) score += 20;
  if (d.sector_has_active_ma) score += 15;
  if (d.has_ipo_pathway) score += 5;
  return { score: Math.min(100, Math.round(score)), flags, missing };
}

function scoreESG(d) {
  let score = 50; const flags = []; const missing = [];
  if (d.esg_rating) { const ratings = { 'A': 40, 'B': 25, 'C': 10, 'D': 0 }; score = ratings[d.esg_rating] ?? 20; }
  if (d.has_esg_policy) score += 15;
  if (d.women_ownership_pct >= 30) score += 10;
  if (d.youth_employment_pct >= 25) score += 10;
  if (d.carbon_neutral_target) score += 10;
  if (d.community_impact_score) score += Math.min(15, d.community_impact_score);
  return { score: Math.min(100, Math.round(score)), flags, missing };
}

function assignReadinessTier(score) {
  if (score >= 80) return 'Investment Ready';
  if (score >= 65) return 'Near Ready';
  if (score >= 50) return 'Developing';
  if (score >= 35) return 'Early Stage';
  return 'Not Ready';
}

async function runReadinessAssessment(opportunityId, assessmentData) {
  const dimensions = ['financial_strength', 'market_validation', 'management_quality', 'capital_structure', 'regulatory_compliance', 'exit_potential', 'esg_score'];
  const weights = { financial_strength: 0.25, market_validation: 0.20, management_quality: 0.20, capital_structure: 0.15, regulatory_compliance: 0.10, exit_potential: 0.05, esg_score: 0.05 };
  const scores = {}; const allFlags = []; const allMissing = [];
  for (const dim of dimensions) {
    const r = scoreDimension(dim, assessmentData);
    scores[dim] = r.score; allFlags.push(...r.flags); allMissing.push(...r.missing);
  }
  const composite = Math.round(dimensions.reduce((s, d) => s + scores[d] * weights[d], 0));
  const tier = assignReadinessTier(composite);
  const nextSteps = buildNextSteps(allMissing, allFlags, composite);
  const { data, error } = await supabase.from('readiness_assessments').upsert({
    opportunity_id: opportunityId,
    financial_strength_score: scores.financial_strength,
    market_validation_score: scores.market_validation,
    management_quality_score: scores.management_quality,
    capital_structure_score: scores.capital_structure,
    regulatory_compliance_score: scores.regulatory_compliance,
    exit_potential_score: scores.exit_potential,
    esg_score: scores.esg_score,
    overall_score: composite, readiness_tier: tier, flags: allFlags,
    missing_items: allMissing, assessment_data: assessmentData,
    assessed_at: new Date().toISOString()
  }, { onConflict: 'opportunity_id' }).select().single();
  if (error) throw error;
  return { opportunity_id: opportunityId, readiness_score: composite, readiness_tier: tier, dimension_scores: scores, flags: allFlags, missing_items: allMissing, next_steps: nextSteps, assessment_id: data.id };
}

function buildNextSteps(missing, flags, score) {
  const steps = [];
  if (missing.includes('financial_statements')) steps.push('Upload audited financial statements or management accounts');
  if (missing.includes('annual_revenue_zar')) steps.push('Provide most recent 12-month revenue figures');
  if (missing.includes('tax_clearance')) steps.push('Obtain SARS Tax Clearance Certificate');
  if (missing.includes('cipc_registration')) steps.push('Confirm CIPC registration and upload certificate');
  if (missing.includes('kyc_documents')) steps.push('Complete KYC verification');
  if (missing.includes('bbbee_certificate')) steps.push('Upload B-BBEE certificate');
  if (flags.includes('high_leverage')) steps.push('Address debt load');
  if (flags.includes('low_runway')) steps.push('Urgency: runway below 6 months');
  if (flags.includes('messy_cap_table')) steps.push('Clean up cap table');
  if (flags.includes('litigation_risk')) steps.push('Resolve outstanding litigation');
  if (score < 50) steps.push('Book a Capital Readiness consultation');
  return steps;
}

function computeDEFLOWScore(passport, mandate) {
  let dealFit = 0, financialFit = 0, stageFit = 0, riskFit = 0, esgFit = 0;
  const sectorMatch = !mandate.sectors?.length || mandate.sectors.includes(passport.sector);
  const geoMatch = !mandate.geographies?.length || mandate.geographies.some(g => passport.country?.toLowerCase().includes(g.toLowerCase()) || g.toLowerCase() === 'africa' || g.toLowerCase() === 'southern africa');
  const ticketMin = mandate.min_ticket_zar ?? 0;
  const ticketMax = mandate.max_ticket_zar ?? Infinity;
  const capitalInRange = passport.capital_required >= ticketMin && passport.capital_required <= ticketMax;
  dealFit = (sectorMatch ? 40 : 0) + (geoMatch ? 30 : 0) + (capitalInRange ? 30 : 0);
  if (passport.readiness_score != null && mandate.min_readiness_score != null) {
    financialFit = passport.readiness_score >= mandate.min_readiness_score ? 80 : 40;
  } else { financialFit = 60; }
  if (mandate.target_irr_pct && passport.target_irr_pct) {
    const irrP = Math.abs(passport.target_irr_pct - mandate.target_irr_pct);
    financialFit = Math.min(100, financialFit + (irrP <= 5 ? 20 : irrP <= 10 ? 10 : 0));
  }
  financialFit = Math.min(100, financialFit);
  const sm = { seed: 1, series_a: 2, series_b: 3, growth: 4, pre_ipo: 5, infrastructure: 6, project_finance: 7 };
  const pStage = sm[passport.stage] ?? 3;
  const mStages = (mandate.preferred_stages ?? []).map(s => sm[s]).filter(Boolean);
  if (!mStages.length) { stageFit = 70; } else { stageFit = mStages.includes(pStage) ? 100 : mStages.some(s => Math.abs(s - pStage) === 1) ? 60 : 20; }
  const rp = { conservative: 1, moderate: 2, balanced: 3, aggressive: 4, opportunistic: 5 };
  const rDelta = Math.abs((rp[passport.risk_profile] ?? 3) - (rp[mandate.risk_appetite] ?? 3));
  riskFit = rDelta === 0 ? 100 : rDelta === 1 ? 70 : rDelta === 2 ? 40 : 10;
  if (mandate.esg_mandatory && !passport.esg_score) { esgFit = 0; } else if (!mandate.esg_mandatory) { esgFit = 80; } else { esgFit = (passport.esg_score ?? 50) >= (mandate.min_esg_score ?? 50) ? 100 : 40; }
  const composite = Math.round(dealFit * 0.40 + financialFit * 0.20 + stageFit * 0.15 + riskFit * 0.15 + esgFit * 0.10);
  return { total: composite, breakdown: { dealFit, financialFit, stageFit, riskFit, esgFit } };
}

function assignMatchTier(score) {
  if (score >= 80) return 'Platinum';
  if (score >= 65) return 'Gold';
  if (score >= 50) return 'Silver';
  if (score >= 35) return 'Bronze';
  return 'No Match';
}

module.exports = { runReadinessAssessment, computeDEFLOWScore, assignMatchTier, assignReadinessTier };
