import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { summarizePRDiffOneLine, summarizeProjectNarrative } from '../utils/ai';
import { fetchPublicEventsForUser, fetchRepoMetadata } from '../utils/github';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// GET /api/stories/:username - return cached stories or generate simple narratives from recent events
router.get('/stories/:username', async (req: Request, res: Response) => {
  const { username } = req.params;
  try {
    const periodEnd = new Date();
    const periodStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days

    // Try cached first
    if (supabase) {
      const { data } = await supabase
        .from('project_stories')
        .select('*')
        .eq('username', username)
        .gt('expires_at', new Date().toISOString())
        .order('period_end', { ascending: false })
        .limit(5);
      if (data && data.length) return res.json(data);
    }

    // Fallback: derive a lightweight story from curated events for the user (public signal)
    const token = (req.headers.authorization || '').replace('Bearer ', '') || undefined;
    const events = await fetchPublicEventsForUser(username, token);
    const repoToEvents: Record<string, any[]> = {};
    for (const ev of events) {
      const repo = ev.repo?.name;
      if (!repo) continue;
      (repoToEvents[repo] = repoToEvents[repo] || []).push(ev);
    }

    const stories: any[] = [];
    for (const [repo, evs] of Object.entries(repoToEvents)) {
      const titles = evs
        .slice(0, 20)
        .map((e) => `${e.type}: ${e.payload?.pull_request?.title || e.payload?.issue?.title || e.payload?.commits?.[0]?.message || ''}`)
        .join('\n');
      const ai = await summarizePRDiffOneLine({ repo, title: `Recent work in ${repo}`, body: titles });
      const repoMeta = await fetchRepoMetadata(repo, token);
      const narrative = await summarizeProjectNarrative({
        repo,
        description: repoMeta?.description,
        topics: repoMeta?.topics,
        primaryLanguage: repoMeta?.language,
        stats: { stars: repoMeta?.stargazers_count, forks: repoMeta?.forks_count, openIssues: repoMeta?.open_issues_count },
        period: 'last 3 days',
        recentTitles: evs
          .slice(0, 10)
          .map((e) => `${e.type}: ${e.payload?.pull_request?.title || e.payload?.issue?.title || e.payload?.commits?.[0]?.message || ''}`),
      });
      const headline = ai || `Recent progress in ${repo}`;
      const bullets = evs.slice(0, 3).map((e) => ({
        type: e.type,
        at: e.created_at,
        link: e.payload?.pull_request?.html_url || e.payload?.issue?.html_url || (e.repo?.name ? `https://github.com/${e.repo.name}` : undefined),
      }));
      stories.push({ username, repo, period_start: periodStart.toISOString(), period_end: periodEnd.toISOString(), headline, bullets, next_steps: null, context_hash: String(evs.length), expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), narrative });
    }

    // Cache
    if (supabase && stories.length) {
      const persistable = stories.map(({ narrative, ...row }) => row);
      await supabase.from('project_stories').upsert(persistable, { onConflict: 'username,repo,period_end' as any });
    }
    return res.json(stories.slice(0, 5));
  } catch (e) {
    return res.json([]);
  }
});

export default router;


