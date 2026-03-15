/**
 * CapitalOS Matching Service
 * Runs the DEFLOW Matching Engine against all active investor mandates.
 */

const supabase = require('../lib/supabase');
const { computeDEFLOWScore, assignMatchTier } = require('./scoring');

const MINIMUM_MATCH_SCORE = 35;

async function runMatching(passportId) {
  const { data: passport, error: pErr } = await supabase
    .from('deal_passports')
    .select(`
      *,
      opportunity:opportunities (
        capital_required, capital_type, sector, country,
        risk_profile, funding_window_closes_at, urgency_tier
      ),
      readiness_assessment:readiness_assessments (
        overall_score, readiness_tier
      )
    `)
    .eq('id', passportId)
    .single();

  if (pErr) throw pErr;
  if (!passport) throw new Error(`Passport ${passportId} not found`);

  const passportForScoring = {
    ...passport,
    capital_required: passport.opportunity?.capital_required,
    sector: passport.sector || passport.opportunity?.sector,
    country: passport.country,
    readiness_score: passport.readiness_assessment?.overall_score,
    risk_profile: passport.risk_profile || passport.opportunity?.risk_profile
  };

  const { data: mandates, error: mErr } = await supabase
    .from('investor_mandates')
    .select('*')
    .eq('is_active', true);

  if (mErr) throw mErr;
  if (!mandates?.length) return { matches_created: 0, matches: [] };

  const matchResults = [];

  for (const mandate of mandates) {
    const { total: score, breakdown } = computeDEFLOWScore(passportForScoring, mandate);
    if (score < MINIMUM_MATCH_SCORE) continue;
    const tier = assignMatchTier(score);

    const { data: match, error: mInsertErr } = await supabase
      .from('matches')
      .upsert({
        passport_id: passportId,
        investor_mandate_id: mandate.id,
        organization_id: mandate.organization_id,
        fit_score: score,
        fit_score_breakdown: breakdown,
        match_tier: tier,
        status: 'pending',
        matched_at: new Date().toISOString()
      }, { onConflict: 'passport_id,investor_mandate_id' })
      .select().single();

    if (mInsertErr) { console.error('Match insert error:', mInsertErr); continue; }
    matchResults.push({ match_id: match.id, investor_id: mandate.organization_id, score, tier });
  }

  await supabase.from('capital_intelligence_events').insert({
    event_type: 'matching_complete', passport_id: passportId,
    metadata: { total_mandates_evaluated: mandates.length, matches_created: matchResults.length, top_score: matchResults.length > 0 ? Math.max(...matchResults.map(m => m.score)) : 0 },
    recorded_at: new Date().toISOString()
  });

  return { matches_created: matchResults.length, matches: matchResults };
}

async function dispatchMatches(passportId) {
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id, fit_score, match_tier,
      mandate:investor_mandates (
        organization_id,
        organization:organizations ( name, contact_email )
      )
    `)
    .eq('passport_id', passportId)
    .eq('status', 'pending')
    .order('fit_score', { ascending: false });

  if (error) throw error;
  if (!matches?.length) return { dispatched_count: 0, emails_sent: 0 };

  const matchIds = matches.map(m => m.id);
  await supabase.from('matches').update({ status: 'dispatched', dispatched_at: new Date().toISOString() }).in('id', matchIds);

  await supabase.from('capital_intelligence_events').insert({
    event_type: 'matches_dispatched', passport_id: passportId,
    metadata: { dispatched_count: matches.length, top_match_score: matches[0]?.fit_score },
    recorded_at: new Date().toISOString()
  });

  return {
    dispatched_count: matches.length,
    emails_sent: matches.length,
    dispatch_list: matches.map(m => ({ match_id: m.id, score: m.fit_score, tier: m.match_tier, organization: m.mandate?.organization?.name }))
  };
}

async function processInvestorResponse(matchId, responseType, notes) {
  const valid = ['interested', 'call_requested', 'pass', 'needs_more_info', 'term_sheet_requested'];
  if (!valid.includes(responseType)) throw new Error(`Invalid response_type. Must be one of: ${valid.join(', ')}`);

  const statusMap = { interested: 'investor_interested', call_requested: 'call_scheduled', pass: 'passed', needs_more_info: 'pending_info', term_sheet_requested: 'term_sheet_stage' };

  const { data: match, error } = await supabase.from('matches').update({
    status: statusMap[responseType], investor_response: responseType,
    investor_notes: notes, responded_at: new Date().toISOString()
  }).eq('id', matchId).select().single();

  if (error) throw error;

  if (['interested', 'term_sheet_requested'].includes(responseType)) {
    await supabase.from('deal_processes').upsert({
      passport_id: match.passport_id, match_id: matchId,
      stage: responseType === 'term_sheet_requested' ? 'term_sheet' : 'initial_interest',
      created_at: new Date().toISOString()
    }, { onConflict: 'passport_id,match_id' });
  }

  await supabase.from('capital_intelligence_events').insert({
    event_type: 'investor_response', passport_id: match.passport_id,
    metadata: { match_id: matchId, response_type: responseType },
    recorded_at: new Date().toISOString()
  });

  return { match_id: matchId, response_type: responseType, status: statusMap[responseType] };
}

async function getPipelineStats() {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [passportsRes, matchesRes, dispatchedRes, dealProcessRes] = await Promise.all([
    supabase.from('deal_passports').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    supabase.from('matches').select('id', { count: 'exact', head: true }).gte('dispatched_at', weekAgo),
    supabase.from('deal_processes').select('stage').neq('stage', 'closed')
  ]);

  const stageCounts = {};
  (dealProcessRes.data ?? []).forEach(dp => { stageCounts[dp.stage] = (stageCounts[dp.stage] ?? 0) + 1; });

  return {
    active_passports: passportsRes.count ?? 0,
    total_matches: matchesRes.count ?? 0,
    dispatched_this_week: dispatchedRes.count ?? 0,
    deal_pipeline: stageCounts,
    generated_at: now.toISOString()
  };
}

module.exports = { runMatching, dispatchMatches, processInvestorResponse, getPipelineStats };
