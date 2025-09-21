import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const router = express.Router();

// GET /api/linkedin/company-by-domain?domain=apple.com
router.get('/linkedin/company-by-domain', async (req, res) => {
  const domain = String(req.query.domain || '');
  if (!domain) {
    return res.status(400).json({ error: 'Missing domain' });
  }

  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || 'linkedin-data-api.p.rapidapi.com';
  if (!rapidApiKey) {
    return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });
  }

  try {
    const url = `https://${rapidApiHost}/get-company-by-domain?domain=${encodeURIComponent(domain)}`;
    const apiRes = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': rapidApiHost,
      },
    });

    const text = await apiRes.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw text if not JSON
    }

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: 'Upstream error', details: data || text });
    }

    return res.json(data ?? { raw: text });
  } catch (err: any) {
    /* eslint-disable no-console */
    console.error('RapidAPI LinkedIn request failed', err);
    return res.status(500).json({ error: 'Request failed', details: err?.message });
  }
});

// GET /api/linkedin/profile?url=https://www.linkedin.com/in/xxxx
// Proxies to RapidAPI provider configured by RAPIDAPI_HOST
router.get('/linkedin/profile', async (req, res) => {
  const profileUrl = String(req.query.url || '');
  if (!profileUrl) {
    return res.status(400).json({ error: 'Missing url' });
  }

  const rapidApiKey = process.env.RAPIDAPI_KEY;
  const rapidApiHost = process.env.RAPIDAPI_HOST || 'linkedin-data-api.p.rapidapi.com';
  if (!rapidApiKey) {
    return res.status(500).json({ error: 'RAPIDAPI_KEY not configured' });
  }

  try {
    // Common pattern among LinkedIn RapidAPI wrappers is `get-profile` with `profile_url` param
    const url = `https://${rapidApiHost}/get-profile?profile_url=${encodeURIComponent(profileUrl)}`;
    const apiRes = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': rapidApiHost,
      },
    });

    const text = await apiRes.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      // keep raw text if not JSON
    }

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: 'Upstream error', details: data || text });
    }

    return res.json(data ?? { raw: text });
  } catch (err: any) {
    /* eslint-disable no-console */
    console.error('RapidAPI LinkedIn profile request failed', err);
    return res.status(500).json({ error: 'Request failed', details: err?.message });
  }
});

export default router;


