const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const matchingService = require('../services/matching');

router.post('/', requireAuth, async (req, res) => {
  try {
    const { opportunity_id, title, executive_summary, capital_structure_narrative, sector, country, stage, risk_profile, target_irr_pct, funding_deadline, urgency_tier } = req.body;
    if (!opportunity_id) return res.status(400).json({ error: 'opportunity_id is required' });
    const { data: opp } = await supabase.from('opportunities').select('*, company:companies(name,country,sector), assessment:readiness_assessments(overall_score,readiness_tier)').eq('id', opportunity_id).single();
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
    const { data: passport, error } = await supabase.from('deal_passports').insert({ opportunity_id, title: title||opp.title, executive_summary, capital_structure_narrative, sector: sector||opp.company?.sector, country: country||opp.company?.country, stage: stage||'growth', risk_profile: risk_profile||'moderate', target_irr_pct, readiness_score: opp.assessment?.overall_score, capital_required: opp.capital_required, capital_type: opp.capital_type, status: 'draft', funding_deadline, urgency_tier: urgency_tier||'cold' }).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data: passport, passport_id: passport.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/publish', requireAuth, async (req, res) => {
  try {
    const passportId = req.params.id;
    const { data: passport, error } = await supabase.from('deal_passports').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', passportId).select().single();
    if (error) throw error;
    if (!passport) return res.status(404).json({ error: 'Passport not found' });
    await supabase.from('opportunities').update({ status: 'published' }).eq('id', passport.opportunity_id);
    await supabase.from('capital_intelligence_events').insert({ event_type: 'passport_published', passport_id: passportId, metadata: { capital_required: passport.capital_required, sector: passport.sector, urgency_tier: passport.urgency_tier }, recorded_at: new Date().toISOString() });
    res.json({ success: true, passport_id: passportId, status: 'published' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('deal_passports').select('*, opportunity:opportunities(*, company:companies(*)), matches(id,fit_score,match_tier,status,dispatched_at,mandate:investor_mandates(organization_id))').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Passport not found' });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const allowed = ['title','executive_summary','status','urgency_tier','funding_deadline','target_irr_pct','risk_profile','stage'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('deal_passports').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
