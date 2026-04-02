const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { requireAuth } = require('../middleware/auth');
const matchingService = require('../services/matching');

// Helper: derive investability tier label from score
function founderTierLabel(score) {
  if (!score && score !== 0) return null;
  if (score >= 80) return 'ELITE';
  if (score >= 65) return 'STRONG';
  if (score >= 50) return 'MODERATE';
  if (score >= 35) return 'DEVELOPING';
  return 'EARLY_STAGE';
}

// POST /api/v2/passports — create a draft passport from an opportunity
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      opportunity_id, assessment_id,
      title, executive_summary, capital_structure_narrative,
      sector, country, stage, risk_profile, target_irr_pct,
      funding_deadline, urgency_tier,
      founder_background, founder_biggest_challenge,
      founder_capital_committed, founder_business_explanation, founder_achievements
    } = req.body;

    if (!opportunity_id) return res.status(400).json({ error: 'opportunity_id is required' });

    const { data: opp } = await supabase
      .from('opportunities')
      .select('*, company:companies(sector, country, org:organizations(name)), assessment:readiness_assessments(id, total_score, tier)')
      .eq('id', opportunity_id)
      .single();

    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });

    // Persist founder intake fields on the opportunity record
    const founderFields = {};
    if (founder_background) founderFields.founder_background = founder_background;
    if (founder_biggest_challenge) founderFields.founder_biggest_challenge = founder_biggest_challenge;
    if (founder_capital_committed) founderFields.founder_capital_committed = founder_capital_committed;
    if (founder_business_explanation) founderFields.founder_business_explanation = founder_business_explanation;
    if (founder_achievements) founderFields.founder_achievements = founder_achievements;
    if (risk_profile) founderFields.risk_profile = risk_profile;
    if (Object.keys(founderFields).length > 0) {
      await supabase.from('opportunities').update(founderFields).eq('id', opportunity_id);
    }

    const { data: passport, error } = await supabase.from('deal_passports').insert({
      opportunity_id,
      assessment_id: assessment_id || opp.assessment?.id,
      title: title || opp.title,
      executive_summary,
      capital_structure_narrative,
      sector: sector || opp.company?.sector,
      country: country || opp.company?.country,
      stage: stage || 'growth',
      risk_profile: risk_profile || 'medium',
      target_irr_pct,
      currency_code: opp.currency_code || 'ZAR',
      capital_required: opp.capital_required,
      capital_type: opp.capital_type,
      use_of_funds: opp.use_of_funds,
      funding_readiness_score: opp.assessment?.total_score,
      founder_capital_committed: founder_capital_committed || null,
      funding_deadline,
      urgency_tier: urgency_tier || 'cold',
      status: 'draft',
      version_snapshot: { readiness_tier: opp.assessment?.tier, created_from: 'api' }
    }).select().single();

    if (error) throw error;
    res.status(201).json({ success: true, data: passport, passport_id: passport.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/passports/:id/publish — publish passport, trigger matching
router.post('/:id/publish', requireAuth, async (req, res) => {
  try {
    const passportId = req.params.id;
    const { data: passport, error } = await supabase
      .from('deal_passports')
      .update({ status: 'active', published_at: new Date().toISOString() })
      .eq('id', passportId)
      .select()
      .single();

    if (error) throw error;
    if (!passport) return res.status(404).json({ error: 'Passport not found' });

    await supabase.from('opportunities').update({ status: 'active' }).eq('id', passport.opportunity_id);
    await supabase.from('capital_intelligence_events').insert({
      event_type: 'passport_published',
      entity_type: 'deal_passport',
      entity_id: passportId,
      sector: passport.sector,
      metadata: {
        capital_required: passport.capital_required,
        capital_type: passport.capital_type,
        urgency_tier: passport.urgency_tier,
        investment_readiness_status: passport.investment_readiness_status
      },
      occurred_at: new Date().toISOString()
    });

    res.json({ success: true, passport_id: passportId, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/passports/:id/founder-assessment
// Called by n8n Workflow 04 after Claude processes founder inputs.
// Accepts AI-output field names and maps to DB column names.
router.post('/:id/founder-assessment', requireAuth, async (req, res) => {
  try {
    const passportId = req.params.id;
    const {
      // Scores — accept both AI output names and DB column names
      founder_investability_score,
      // AI names
      execution_track_record_score,
      skin_in_the_game_score,
      clarity_of_thought_score,
      resilience_grit_score,
      integrity_trust_score,
      // DB column names (backwards compat)
      founder_execution_score,
      founder_skin_in_game_score,
      founder_clarity_score,
      founder_resilience_score,
      founder_integrity_score,
      // Narrative & analysis
      founder_narrative,
      founder_key_concerns,
      founder_upgrade_plan,
      internal_notes,
      client_teaser,
      // Investment readiness decision
      investment_readiness_status,
      investment_readiness_rationale,
      primary_constraint
    } = req.body;

    // Resolve scores — AI names take precedence, fall back to DB names
    const execScore    = execution_track_record_score ?? founder_execution_score;
    const skinScore    = skin_in_the_game_score        ?? founder_skin_in_game_score;
    const clarityScore = clarity_of_thought_score      ?? founder_clarity_score;
    const resiliScore  = resilience_grit_score          ?? founder_resilience_score;
    const integScore   = integrity_trust_score          ?? founder_integrity_score;

    const { data: passport, error: pErr } = await supabase
      .from('deal_passports')
      .select('id, assessment_id, opportunity_id')
      .eq('id', passportId)
      .single();

    if (pErr || !passport) return res.status(404).json({ error: 'Passport not found' });

    // Update readiness_assessment with founder scores
    if (passport.assessment_id) {
      const { error: aErr } = await supabase
        .from('readiness_assessments')
        .update({
          founder_investability_score,
          founder_execution_score:    execScore,
          founder_skin_in_game_score: skinScore,
          founder_clarity_score:      clarityScore,
          founder_resilience_score:   resiliScore,
          founder_integrity_score:    integScore,
          founder_narrative,
          founder_key_concerns: founder_key_concerns || [],
          founder_upgrade_plan: founder_upgrade_plan || [],
          founder_assessed_at: new Date().toISOString()
        })
        .eq('id', passport.assessment_id);
      if (aErr) throw aErr;
    }

    // Update passport with investment readiness + teaser
    const passportUpdates = {};
    if (investment_readiness_status)   passportUpdates.investment_readiness_status   = investment_readiness_status;
    if (investment_readiness_rationale) passportUpdates.investment_readiness_rationale = investment_readiness_rationale;
    if (primary_constraint)            passportUpdates.primary_constraint            = primary_constraint;
    if (client_teaser)                 passportUpdates.client_teaser                 = client_teaser;
    if (internal_notes)                passportUpdates.internal_notes                = internal_notes;
    passportUpdates.updated_at = new Date().toISOString();

    const { data: updatedPassport, error: uErr } = await supabase
      .from('deal_passports')
      .update(passportUpdates)
      .eq('id', passportId)
      .select()
      .single();

    if (uErr) throw uErr;

    await supabase.from('capital_intelligence_events').insert({
      event_type: 'founder_assessed',
      entity_type: 'deal_passport',
      entity_id: passportId,
      metadata: { founder_investability_score, investment_readiness_status, primary_constraint },
      occurred_at: new Date().toISOString()
    });

    res.json({
      success: true,
      passport_id: passportId,
      founder_investability_score,
      investment_readiness_status,
      primary_constraint
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/passports/:id — full internal passport with founder profile, matches
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('deal_passports')
      .select(`
        *,
        opportunity:opportunities(
          capital_required, capital_type,
          founder_background, founder_biggest_challenge,
          founder_capital_committed, founder_achievements,
          company:companies(*, org:organizations(name))
        ),
        assessment:readiness_assessments(
          total_score, tier, overall_score, readiness_tier,
          founder_investability_score,
          founder_execution_score, founder_skin_in_game_score,
          founder_clarity_score, founder_resilience_score, founder_integrity_score,
          founder_narrative, founder_key_concerns, founder_upgrade_plan
        ),
        matches(id, fit_score, match_tier, status, dispatched_at,
          mandate:investor_mandates(organization_id))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Passport not found' });
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/passports/:id/investor-view
// Investor-facing passport: curated data only, no internal notes, no upgrade plans.
// Includes Founder Profile section with investability score, tier label, narrative, skin-in-game.
router.get('/:id/investor-view', requireAuth, async (req, res) => {
  try {
    const { data: passport, error } = await supabase
      .from('deal_passports')
      .select(`
        id, title, sector, country, stage, status,
        capital_required, capital_type, currency_code,
        use_of_funds, executive_summary, capital_structure_narrative,
        risk_profile, target_irr_pct, urgency_tier,
        funding_deadline, published_at,
        investment_readiness_status, investment_readiness_rationale,
        primary_constraint, client_teaser, founder_capital_committed,
        opportunity:opportunities(
          capital_required, capital_type,
          founder_capital_committed,
          company:companies(id, org:organizations(name))
        ),
        assessment:readiness_assessments(
          overall_score, readiness_tier,
          founder_investability_score,
          founder_narrative
        ),
        matches(id, fit_score, match_tier, status)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !passport) return res.status(404).json({ error: 'Passport not found' });

    const assessment = passport.assessment || {};
    const skinInGame = passport.founder_capital_committed
      || passport.opportunity?.founder_capital_committed
      || null;

    // Build investor-safe response
    const investorView = {
      id: passport.id,
      title: passport.title,
      sector: passport.sector,
      country: passport.country,
      stage: passport.stage,
      status: passport.status,
      capital_required: passport.capital_required,
      capital_type: passport.capital_type,
      currency_code: passport.currency_code,
      use_of_funds: passport.use_of_funds,
      executive_summary: passport.executive_summary,
      capital_structure_narrative: passport.capital_structure_narrative,
      risk_profile: passport.risk_profile,
      target_irr_pct: passport.target_irr_pct,
      urgency_tier: passport.urgency_tier,
      funding_deadline: passport.funding_deadline,
      published_at: passport.published_at,
      investment_readiness: {
        status: passport.investment_readiness_status,
        rationale: passport.investment_readiness_rationale,
        primary_constraint: passport.primary_constraint
      },
      founder_profile: {
        investability_score: assessment.founder_investability_score || null,
        tier_label: founderTierLabel(assessment.founder_investability_score),
        narrative: assessment.founder_narrative || null,
        skin_in_the_game: skinInGame,
        client_teaser: passport.client_teaser || null
      },
      readiness: {
        overall_score: assessment.overall_score,
        readiness_tier: assessment.readiness_tier
      },
      match_count: (passport.matches || []).filter(m => m.status !== 'rejected').length
    };

    res.json({ data: investorView });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/passports/:id — update passport fields
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const directFields = [
      'title', 'executive_summary', 'capital_structure_narrative',
      'stage', 'risk_profile', 'target_irr_pct', 'urgency_tier',
      'funding_deadline', 'status', 'investment_readiness_status',
      'investment_readiness_rationale', 'primary_constraint',
      'client_teaser', 'internal_notes', 'founder_capital_committed'
    ];
    const updates = {};
    directFields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('deal_passports')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
