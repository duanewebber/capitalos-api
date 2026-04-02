const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const matchingService = require('../services/matching');

router.post('/run/:passportId', requireAuth, async (req, res) => {
  try { res.json(await matchingService.runMatching(req.params.passportId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/dispatch/:passportId', requireAuth, async (req, res) => {
  try { res.json(await matchingService.dispatchMatches(req.params.passportId));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/matches/:matchId/respond', requireAuth, async (req, res) => {
  try {
    const { response_type, notes } = req.body;
    if (!response_type) return res.status(400).json({ error: 'response_type is required' });
    res.json(await matchingService.processInvestorResponse(req.params.matchId, response_type, notes));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/dashboard', requireAuth, async (req, res) => {
  try { res.json(await matchingService.getPipelineStats());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
