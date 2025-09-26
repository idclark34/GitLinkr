import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { searchUsersByCompany, searchUsersByLanguage } from '../utils/github';

dotenv.config();

const router = express.Router();

const APIFY_BASE = 'https://api.apify.com/v2';
const DEFAULT_ACTOR = 'apimaestro~linkedin-profile-search-scraper';

type PeopleSearchBody = {
  keywords?: string;
  location?: string;
  company?: string;
  title?: string;
  lang?: string;
  maxResults?: number;
  wait?: boolean;
};

// Map Apify dataset item to a normalized person shape (best-effort)
function mapApifyItemToPerson(item: any) {
  // Support both flat and nested (basic_info) schemas
  const bi = item?.basic_info || {};
  const loc = bi?.location || {};
  return {
    source: 'linkedin',
    fullName: bi.fullname || item.fullName || item.name || item.profileName || undefined,
    headline: bi.headline || item.headline || item.title || undefined,
    profileUrl: bi.profile_url || item.linkedinUrl || item.profileUrl || item.url || undefined,
    location: loc.full || item.location || item.city || undefined,
    company: bi.current_company || item.company || item.companyName || undefined,
    position: item.position || item.jobTitle || undefined,
    raw: item,
  };
}

// POST /api/people/search
router.post('/people/search', async (req, res) => {
  try {
    const { keywords, location, company, title, lang, maxResults = 10, wait = true } = (req.body || {}) as PeopleSearchBody;
    const ghToken = (req.headers.authorization || '').replace('Bearer ', '') || undefined;

    const tasks: Promise<any>[] = [];
    // GitHub company search
    if (company) {
      tasks.push(searchUsersByCompany(company, ghToken));
    } else {
      tasks.push(Promise.resolve([]));
    }
    // GitHub language search
    if (lang) {
      tasks.push(searchUsersByLanguage(lang, ghToken));
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Apify LinkedIn search
    const doApify = Boolean(keywords || location || company);
    const apifyPromise = (async () => {
      if (!doApify) return { status: 'SKIPPED', items: [] as any[] };
      const token = process.env.APIFY_TOKEN;
      if (!token) return { status: 'DISABLED', items: [], error: 'APIFY_TOKEN not configured' };
      // Compose actor input
      const input: Record<string, any> = {};
      if (keywords) input.keywords = keywords;
      if (location) input.location = location;
      if (company) input.company = company;
      if (title) {
        input.current_job_title = title;
        // Some actors accept jobTitle/title too; pass for compatibility
        input.jobTitle = title;
        input.title = title;
      }
      input.maxResults = maxResults;

      // Start run
      const startUrl = `${APIFY_BASE}/acts/${DEFAULT_ACTOR}/runs?token=${encodeURIComponent(token)}`;
      const startRes = await fetch(startUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const start: any = await startRes.json();
      if (!startRes.ok) return { status: 'ERROR', error: start };
      if (!wait) return { status: 'STARTED', run: start };

      const runId = (start as any)?.data?.id || (start as any)?.id;
      if (!runId) return { status: 'ERROR', error: 'missing run id' };
      // Poll
      const maxMs = 120_000; const intervalMs = 1500; const t0 = Date.now();
      let status = 'RUNNING'; let datasetId: string | undefined;
      while (Date.now() - t0 < maxMs) {
        const runUrl = `${APIFY_BASE}/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`;
        const runRes = await fetch(runUrl);
        const run: any = await runRes.json();
        if (!runRes.ok) return { status: 'ERROR', error: run };
        status = (run as any)?.data?.status || (run as any)?.status;
        datasetId = (run as any)?.data?.defaultDatasetId || (run as any)?.defaultDatasetId;
        if (['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(status)) {
          if (status !== 'SUCCEEDED' || !datasetId) return { status, run };
          const dsUrl = `${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}`;
          const dsRes = await fetch(dsUrl);
          const items: any = await dsRes.json();
          const mapped = Array.isArray(items) ? items.map(mapApifyItemToPerson) : [];
          return { status, items: mapped, rawItems: items };
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return { status: 'POLL_TIMEOUT', runId };
    })();

    const [ghByCompany, ghByLang, li] = await Promise.all([tasks[0], tasks[1], apifyPromise]);

    const githubUsers = (() => {
      // Intersect or union based on availability
      const byLogin = new Map<string, any>();
      const boost = (arr: any[], weight: number) => {
        for (const u of arr || []) {
          const login = u.login || u.username || u.id;
          if (!login) continue;
          const curr = byLogin.get(login) || { user: u, score: 0 };
          curr.score += weight;
          byLogin.set(login, curr);
        }
      };
      boost(ghByCompany, 2);
      boost(ghByLang, 1);
      return Array.from(byLogin.values())
        .sort((a, b) => b.score - a.score)
        .map((x) => ({ source: 'github', login: x.user.login, html_url: x.user.html_url, avatar_url: x.user.avatar_url, score: x.score }));
    })();

    return res.json({
      linkedin: li,
      github: { users: githubUsers },
    });
  } catch (err) {
    /* eslint-disable no-console */
    console.error('people search failed', err);
    return res.status(500).json({ error: 'people search failed' });
  }
});

export default router;

// POST /api/people/enrich - fetch richer LinkedIn profile data via Apify
// Body: { name?: string; vanity?: string; location?: string; company?: string; maxResults?: number }
router.post('/people/enrich', async (req, res) => {
  try {
    const token = process.env.APIFY_TOKEN;
    if (!token) return res.status(500).json({ error: 'APIFY_TOKEN not configured' });
    const { name, vanity, location, company, maxResults = 3 } = (req.body || {}) as { name?: string; vanity?: string; location?: string; company?: string; maxResults?: number };
    if (!name && !vanity && !company) return res.status(400).json({ error: 'Provide at least one of name, vanity, or company' });

    // Build a targeted query
    const keywordsParts = [name, vanity, company].filter(Boolean) as string[];
    const input: Record<string, any> = {
      keywords: keywordsParts.join(' ').trim(),
      location: location || undefined,
      maxResults,
    };

    const startUrl = `${APIFY_BASE}/acts/${DEFAULT_ACTOR}/runs?token=${encodeURIComponent(token)}`;
    const startRes = await fetch(startUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const start: any = await startRes.json();
    if (!startRes.ok) return res.status(startRes.status).json(start);

    const runId = (start as any)?.data?.id || (start as any)?.id;
    if (!runId) return res.status(500).json({ error: 'missing run id' });

    // Wait up to 120s for enrichment
    const maxMs = 120_000; const intervalMs = 1500; const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const runRes = await fetch(`${APIFY_BASE}/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`);
      const run: any = await runRes.json();
      if (!runRes.ok) return res.status(runRes.status).json(run);
      const status = (run as any)?.data?.status || (run as any)?.status;
      const datasetId = (run as any)?.data?.defaultDatasetId || (run as any)?.defaultDatasetId;
      if (['SUCCEEDED','FAILED','ABORTED','TIMED-OUT'].includes(status)) {
        if (status !== 'SUCCEEDED' || !datasetId) return res.json({ status, runId, items: [] });
        const dsRes = await fetch(`${APIFY_BASE}/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}`);
        const items: any = await dsRes.json();
        return res.json({ status, runId, items });
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return res.json({ status: 'POLL_TIMEOUT', runId, items: [] });
  } catch (err: any) {
    /* eslint-disable no-console */
    console.error('people enrich failed', err);
    return res.status(500).json({ error: 'people enrich failed', details: err?.message });
  }
});


