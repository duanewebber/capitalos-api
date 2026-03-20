const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const { runReadinessAssessment, assignReadinessTier } = require('../services/scoring');

router.post('/readiness/:opportunityId', requireAuth, async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { data: opp, error: oppErr } = await supabase.from('opportunities').select('id, title, status').eq('id', opportunityId).single();
    if (oppErr || !opp) return res.status(404).json({ error: `Opportunity ${opportunityId} not found` });
    const assessmentData = req.body;
    const result = await runReadinessAssessment(opportunityId, assessmentData);
    if (result.readiness_score >= 65 && opp.status === 'draft') {
      await supabase.from('opportunities').update({ status: 'assessment_complete' }).eq('id', opportunityId);
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/readiness/:opportunityId', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('readiness_assessments').select('*').eq('opportunity_id', req.params.opportunityId).order('completed_at', { ascending: false }).limit(1).single();
    if (error) return res.status(404).json({ error: 'Assessment not found' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/intelligence', requireAuth, async (req, res) => {
  try {
    const { data: sectorData, error: sErr } = await supabase.from('opportunities').select('sector, status').not('sector', 'is', null);
    if (sErr) throw sErr;
    const sectorCounts = {}, sectorActive = {};
    (sectorData ?? []).forEach(o => {
      sectorCounts[o.sector] = (sectorCounts[o.sector] ?? 0) + 1;
      if (['published','matched','in_negotiation'].includes(o.status)) sectorActive[o.sector] = (sectorActive[o.sector] ?? 0) + 1;
    });
    const total = Object.values(sectorCounts).reduce((a,b) => a+b, 0);
    const topSectors = Object.entries(sectorCounts).map(([name,count]) => ({ name, opportunity_count: count, active_count: sectorActive[name] ?? 0, demand_index: total > 0 ? Math.round((count/total)*100) : 0 })).sort((a,b) => b.demand_index-a.demand_index).slice(0,10);
    const { data: windows } = await supabase.from('v_active_funding_windows').select('*').limit(20);
    const { data: events } = await supabase.from('capital_intelligence_events').select('event_type,metadata,occurred_at').order('occurred_at',{ascending:false}).limit(20);
    res.json({ top_sectors: topSectors, active_funding_windows: windows ?? [], recent_events: events ?? [], generated_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/leads', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('v_leads_dashboard').select('*').limit(100);
    if (error) throw error;
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
