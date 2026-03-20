const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const matchingService = require('../services/matching');

router.post('/', requireAuth, async (req, res) => {
  try {
    const { opportunity_id, title, executive_summary, capital_structure_narrative, sector, country, stage, risk_profile, target_irr_pct, funding_deadline, urgency_tier } = req.body;
    if (!opportunity_id) return res.status(400).json({ error: 'opportunity_id is required' });
    const { data: opp } = await supabase.from('opportunities').select('*, company:companies(sector, country, org:organizations(name)), assessment:readiness_assessments(total_score, tier)').eq('id', opportunity_id).single();
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
    const { data: passport, error } = await supabase.from('deal_passports').insert({
      opportunity_id,
      sector: sector || opp.company?.sector,
      country: country || opp.company?.country,
      currency_code: opp.currency_code || 'ZAR',
      capital_required: opp.capital_required,
      capital_type: opp.capital_type,
      use_of_funds: opp.use_of_funds,
      funding_readiness_score: opp.assessment?.total_score,
      status: 'draft',
      funding_deadline,
      urgency_tier: urgency_tier || 'cold',
      version_snapshot: {
        title: title || opp.title,
        executive_summary,
        capital_structure_narrative,
        stage: stage || 'growth',
        risk_profile: risk_profile || 'moderate',
        target_irr_pct,
        readiness_tier: opp.assessment?.tier
      }
    }).select().single();
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
    await supabase.from('capital_intelligence_events').insert({
      event_type: 'passport_published',
      entity_type: 'deal_passport',
      entity_id: passportId,
      sector: passport.sector,
      metadata: { capital_required: passport.capital_required, capital_type: passport.capital_type, urgency_tier: passport.urgency_tier },
      occurred_at: new Date().toISOString()
    });
    res.json({ success: true, passport_id: passportId, status: 'published' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('deal_passports').select('*, opportunity:opportunities(*, company:companies(*, org:organizations(name))), matches(id, fit_score, match_tier, status, dispatched_at, mandate:investor_mandates(org_id))').eq('id', req.params.id).single();
    if (error) return res.status(404).json({ error: 'Passport not found' });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const updates = {};
    const directFields = ['urgency_tier', 'funding_deadline', 'status'];
    directFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const snapshotFields = ['title', 'executive_summary', 'capital_structure_narrative', 'risk_profile', 'stage', 'target_irr_pct'];
    const snapshotUpdates = {};
    snapshotFields.forEach(f => { if (req.body[f] !== undefined) snapshotUpdates[f] = req.body[f]; });
    if (Object.keys(snapshotUpdates).length > 0) {
      const { data: current } = await supabase.from('deal_passports').select('version_snapshot').eq('id', req.params.id).single();
      updates.version_snapshot = { ...(current?.version_snapshot || {}), ...snapshotUpdates };
    }
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase.from('deal_passports').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
