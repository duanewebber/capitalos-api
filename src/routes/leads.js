/**
 * Leads route â handles website scorecard submissions
 */

const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { assignReadinessTier } = require('../services/scoring');

// POST /api/v2/leads â submit scorecard result (no auth needed)
router.post('/', async (req, res) => {
  try {
    const { email, full_name, company_name, phone, source,
      annual_revenue_zar, has_audited_financials, yoy_revenue_growth_pct,
      paying_customers, team_size, ceo_years_experience, has_kyc_passed,
      has_cipc_registration, has_sars_tax_clearance, has_bbbee_certificate,
      sector, country, capital_required, capital_type, scores_json, notes
    } = req.body;

    if (!email) return res.status(400).json({ error: 'email is required' });

    let fundabilityScore = 0, scoresData = scores_json;
    if (!scoresData) {
      let score = 0;
      if (annual_revenue_zar > 0) score += Math.min(25, (annual_revenue_zar / 5_000_000) * 25);
      if (has_audited_financials) score += 15;
      if (yoy_revenue_growth_pct > 0) score += Math.min(20, yoy_revenue_growth_pct / 2);
      if (paying_customers > 0) score += Math.min(15, paying_customers / 10);
      if (has_cipc_registration) score += 10;
      if (has_sars_tax_clearance) score += 10;
      if (has_kyc_passed) score += 5;
      fundabilityScore = Math.min(100, Math.round(score));
      scoresData = { revenue: annual_revenue_zar, growth: yoy_revenue_growth_pct, customers: paying_customers, financials: has_audited_financials, compliance: has_cipc_registration && has_sars_tax_clearance };
    } else {
      const vals = Object.values(scores_json).filter(v => typeof v === 'number');
      fundabilityScore = vals.length > 0 ? Math.min(100, Math.round(vals.reduce((a,b) => a+b, 0) / vals.length)) : 0;
    }

    const fundabilityTier = assignReadinessTier(fundabilityScore);

    const { data: lead, error } = await supabase.from('leads').insert({ email, full_name, company_name, phone, fundability_score: fundabilityScore, fundability_tier: fundabilityTier, scores_json: scoresData, source: source || 'website_scorecard', notes }).select().single();
    if (error) {
      if (error.code === '23505') {
        const { data: updated } = await supabase.from('leads').update({ fundability_score: fundabilityScore, fundability_tier: fundabilityTier, scores_json: scoresData }).eq('email', email).select().single();
        return res.json({ success: true, lead_id: updated.id, score: fundabilityScore, tier: fundabilityTier, updated: true });
      }
      throw error;
    }
    res.status(201).json({ success: true, lead_id: lead.id, score: fundabilityScore, tier: fundabilityTier });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/v2/leads â list leads (operator only)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { tier, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('v_leads_dashboard').select('*').range(Number(offset), Number(offset)+Number(limit)-1);
    if (tier) query = query.eq('fundability_tier', tier);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
