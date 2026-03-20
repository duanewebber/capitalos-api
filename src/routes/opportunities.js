const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');

router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      title, capital_required, currency_code = 'ZAR', capital_type,
      sector, country, company_name, company_website,
      funding_window_opens_at, funding_window_closes_at,
      commitment_deadline, minimum_ticket_size, maximum_ticket_size,
      use_of_funds, stage = 'growth'
    } = req.body;

    if (!title || !capital_required || !capital_type) {
      return res.status(400).json({ error: 'title, capital_required, and capital_type are required' });
    }

    let company_id = req.body.company_id;

    if (!company_id && company_name) {
      if (!country) return res.status(400).json({ error: 'country is required when creating a new company' });
      if (!sector)  return res.status(400).json({ error: 'sector is required when creating a new company' });

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: company_name, website: company_website, country, sector, type: 'company' })
        .select().single();

      if (orgErr) return res.status(400).json({ error: 'Failed to create organisation: ' + orgErr.message });

      const { data: company, error: cErr } = await supabase
        .from('companies')
        .insert({ org_id: org.id, country, sector, website: company_website, stage })
        .select().single();

      if (cErr) return res.status(400).json({ error: 'Failed to create company: ' + cErr.message });

      company_id = company.id;
    }

    if (!company_id) return res.status(400).json({ error: 'company_id is required (or provide company_name, country, and sector to auto-create)' });

    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        company_id, title,
        capital_required: Math.round(capital_required),
        currency_code, capital_type, use_of_funds,
        status: 'draft',
        funding_window_opens_at, funding_window_closes_at,
        commitment_deadline, minimum_ticket_size, maximum_ticket_size
      })
      .select().single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, sector, limit = 50, offset = 0 } = req.query;
    let query = supabase
      .from('opportunities')
      .select('*, company:companies(sector, country, org:organizations(name))')
      .range(Number(offset), Number(offset) + Number(limit) - 1)
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);
    if (sector) query = query.eq('sector', sector);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ data, total: count, limit: Number(limit), offset: Number(offset) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .select('*, company:companies(*, org:organizations(name)), readiness_assessment:readiness_assessments(*), deal_passports(*), leads(id, email, fundability_score, created_at)')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Opportunity not found' });
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const allowed = ['title', 'status', 'capital_required', 'capital_type', 'use_of_funds',
      'funding_window_opens_at', 'funding_window_closes_at', 'commitment_deadline',
      'minimum_ticket_size', 'maximum_ticket_size'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    updates.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('opportunities')
      .update(updates).eq('id', req.params.id)
      .select().single();
    if (error) throw error;
    res.json({ data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
