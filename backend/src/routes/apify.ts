import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const APIFY_BASE = 'https://api.apify.com/v2';
const DEFAULT_ACTOR = 'apimaestro~linkedin-profile-search-scraper';

// GET /api/apify/runs - list runs for the default actor
router.get('/apify/runs', async (_req, res) => {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
    const url = `${APIFY_BASE}/acts/${DEFAULT_ACTOR}/runs?token=${encodeURIComponent(token)}&limit=25`;
    const r = await fetch(url);
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    if (!r.ok) return res.status(r.status).json({ error: 'Apify error', details: data || text });
    return res.json(data);
  } catch (err: any) {
    /* eslint-disable no-console */
    console.error('Apify runs error', err);
    return res.status(500).json({ error: 'Failed to list runs', details: err?.message });
  }
});

// POST /api/apify/run - start a new run with optional input
router.post('/apify/run', async (req, res) => {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
    const input = req.body || {};
    const url = `${APIFY_BASE}/acts/${DEFAULT_ACTOR}/runs?token=${encodeURIComponent(token)}`;
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    if (!r.ok) return res.status(r.status).json({ error: 'Apify error', details: data || text });
    return res.json(data);
  } catch (err: any) {
    console.error('Apify start run error', err);
    return res.status(500).json({ error: 'Failed to start run', details: err?.message });
  }
});

// GET /api/apify/run/:runId - get run details
router.get('/apify/run/:runId', async (req, res) => {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
    const url = `${APIFY_BASE}/actor-runs/${encodeURIComponent(req.params.runId)}?token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    if (!r.ok) return res.status(r.status).json({ error: 'Apify error', details: data || text });
    return res.json(data);
  } catch (err: any) {
    console.error('Apify run details error', err);
    return res.status(500).json({ error: 'Failed to get run', details: err?.message });
  }
});

// GET /api/apify/dataset/:datasetId - fetch dataset items
router.get('/apify/dataset/:datasetId', async (req, res) => {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
    const url = `${APIFY_BASE}/datasets/${encodeURIComponent(req.params.datasetId)}/items?token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch {}
    if (!r.ok) return res.status(r.status).json({ error: 'Apify error', details: data || text });
    return res.json(data);
  } catch (err: any) {
    console.error('Apify dataset items error', err);
    return res.status(500).json({ error: 'Failed to get dataset items', details: err?.message });
  }
});

export default router;

// POST /api/apify/search - start a search and optionally wait for results
// Body: { input: {...actorInput}, wait: boolean }
router.post('/apify/search', async (req, res) => {
  const token = process.env.APIFY_TOKEN;
  if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
  const wait = Boolean(req.body?.wait);
  const input = req.body?.input || {};

  try {
    // Start the actor run
    const startUrl = `${APIFY_BASE}/acts/${DEFAULT_ACTOR}/runs?token=${encodeURIComponent(token)}`;
    const startRes = await fetch(startUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const start: any = await startRes.json();
    if (!startRes.ok) return res.status(startRes.status).json(start as any);

    if (!wait) return res.json(start);

    const runId = (start as any)?.data?.id || (start as any)?.id;
    if (!runId) return res.status(500).json({ error: 'Missing run id from Apify' });

    // Poll run status until it finishes (with a soft cap)
    const maxMs = 120 * 1000; // 120s cap to allow longer runs
    const intervalMs = 1500;
    const started = Date.now();
    let status = 'RUNNING';
    let datasetId: string | undefined;
    while (Date.now() - started < maxMs) {
      const runUrl = `${APIFY_BASE}/runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`;
      const runRes = await fetch(runUrl);
      const run: any = await runRes.json();
      if (!runRes.ok) return res.status(runRes.status).json(run as any);
      status = (run as any)?.data?.status || (run as any)?.status;
      datasetId = (run as any)?.data?.defaultDatasetId || (run as any)?.defaultDatasetId;
      if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        if (status !== 'SUCCEEDED' || !datasetId) {
          return res.json({ status, run });
        }
        const dsUrl = `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}`;
        const dsRes = await fetch(dsUrl);
        const items: any = await dsRes.json();
        return res.json({ status, run, items });
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return res.json({ status: 'POLL_TIMEOUT', runId });
  } catch (err: any) {
    /* eslint-disable no-console */
    console.error('Apify search error', err);
    return res.status(500).json({ error: 'Apify search failed', details: err?.message });
  }
});


