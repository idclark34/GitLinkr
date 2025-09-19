import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fetchPublicEventsForUser, fetchPRFiles, fetchCompareDiff } from '../utils/github';
import { summarizePRDiffOneLine } from '../utils/ai';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

async function mapGitHubEventToPost(ev: any, token?: string) {
  const repoName = ev.repo?.name;
  const type = ev.type;
  let title = `${type} in ${repoName || 'a repository'}`;
  let body: string | undefined;
  const artifacts: Array<{ type: string; url: string }> = [];
  let summary: string | undefined;
  let why: string | undefined;
  const og = (suffix?: string) => {
    if (!repoName) return undefined;
    const salt = 'gl' + Math.floor(Date.now() / (10 * 60 * 1000)); // rotate every 10m
    return `https://opengraph.githubassets.com/${salt}/${repoName}${suffix || ''}`;
  };
  let image_url: string | undefined;

  try {
    switch (type) {
      case 'PushEvent': {
        const commits = ev.payload?.commits || [];
        const count = commits.length;
        const firstMsg = commits[0]?.message as string | undefined;
        body = firstMsg;
        title = `Pushed ${count} commit${count === 1 ? '' : 's'} to ${repoName}`;
        if (firstMsg) summary = firstMsg.split('\n')[0].trim();
        why = deriveWhy(repoName, type, title, body || summary);
        const before = ev.payload?.before;
        const head = ev.payload?.head;
        if (repoName && before && head) {
          artifacts.push({ type: 'compare', url: `https://github.com/${repoName}/compare/${before}...${head}` });
          // AI summarize push compare
          try {
            const cmp = await fetchCompareDiff(repoName, before, head, token);
            if (cmp) {
              const ai = await summarizePRDiffOneLine({ repo: repoName, title, body: (cmp.messages || []).join('\n'), diffSnippet: cmp.patchSummary });
              if (ai) summary = ai;
            }
          } catch {}
          image_url = og(`/compare/${before}...${head}`);
        }
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        if (!image_url) image_url = og();
        break;
      }
      case 'PullRequestEvent': {
        const pr = ev.payload?.pull_request;
        const action = ev.payload?.action;
        const num = pr?.number;
        title = `${action || 'updated'} PR #${num}: ${pr?.title || ''}`.trim();
        // Heuristic summary
        const titleWords = (pr?.title || '').trim().split(/\s+/).filter(Boolean).length;
        if (titleWords > 10) {
          summary = pr?.title?.trim();
        } else if (typeof pr?.body === 'string' && pr.body.trim().length > 0) {
          const firstLine = pr.body.trim().split(/\n+/)[0];
          summary = firstLine.length > 200 ? `${firstLine.slice(0,197)}…` : firstLine;
        }
        if (pr?.html_url) artifacts.push({ type: 'pr', url: pr.html_url });
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        why = deriveWhy(repoName, type, title, (summary || pr?.body || '') as string);

        // AI summary using PR files (always try; fall back to heuristic)
        try {
          const repo = repoName as string | undefined;
          if (repo && typeof num === 'number') {
            const details = await fetchPRFiles(repo, num, token);
            const ai = await summarizePRDiffOneLine({ repo, title: details?.title, body: details?.body, diffSnippet: details?.patchSummary });
            if (ai) summary = ai;
          }
        } catch {
          // ignore and keep heuristic summary
        }
        if (typeof num === 'number') image_url = og(`/pull/${num}`);
        if (!image_url) image_url = og();
        break;
      }
      case 'PullRequestReviewEvent': {
        const pr = ev.payload?.pull_request;
        const review = ev.payload?.review;
        const num = pr?.number;
        title = `Reviewed PR #${num}: ${pr?.title || ''}`.trim();
        if (typeof review?.body === 'string' && review.body.trim().length > 0) {
          const firstLine = review.body.trim().split(/\n+/)[0];
          summary = firstLine.length > 200 ? `${firstLine.slice(0,197)}…` : firstLine;
          body = review.body;
        }
        if (review?.html_url) artifacts.push({ type: 'review', url: review.html_url });
        if (pr?.html_url) artifacts.push({ type: 'pr', url: pr.html_url });
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        why = deriveWhy(repoName, 'PullRequestEvent', title, (summary || body || pr?.body || '') as string);

        // AI summary using PR files as additional context
        try {
          const repo = repoName as string | undefined;
          if (repo && typeof num === 'number') {
            const details = await fetchPRFiles(repo, num, token);
            const ai = await summarizePRDiffOneLine({ repo, title: details?.title || title, body: (details?.body || body), diffSnippet: details?.patchSummary });
            if (ai) summary = ai;
          }
        } catch {}
        if (typeof num === 'number') image_url = og(`/pull/${num}`);
        if (!image_url) image_url = og();
        break;
      }
      case 'PullRequestReviewCommentEvent': {
        const pr = ev.payload?.pull_request;
        const comment = ev.payload?.comment;
        const num = pr?.number;
        title = `PR comment on #${num}: ${pr?.title || ''}`.trim();
        if (typeof comment?.body === 'string') {
          body = comment.body;
          summary = comment.body.split('\n')[0].slice(0, 200);
        }
        if (comment?.html_url) artifacts.push({ type: 'comment', url: comment.html_url });
        if (pr?.html_url) artifacts.push({ type: 'pr', url: pr.html_url });
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        why = deriveWhy(repoName, 'PullRequestEvent', title, body || '');
        // AI fallback if needed
        if (!summary) {
          const repo = repoName as string | undefined;
          try {
            if (repo && typeof num === 'number') {
              const details = await fetchPRFiles(repo, num, token);
              const ai = await summarizePRDiffOneLine({ repo, title: details?.title || title, body: (body || details?.body), diffSnippet: details?.patchSummary });
              if (ai) summary = ai;
            }
          } catch {}
        }
        if (typeof num === 'number') image_url = og(`/pull/${num}`);
        if (!image_url) image_url = og();
        break;
      }
      case 'IssuesEvent': {
        const issue = ev.payload?.issue;
        const action = ev.payload?.action;
        title = `${action || 'updated'} issue #${issue?.number}: ${issue?.title || ''}`.trim();
        if (issue?.title) summary = issue.title;
        if (issue?.html_url) artifacts.push({ type: 'issue', url: issue.html_url });
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        why = deriveWhy(repoName, type, title, (summary || issue?.body || '') as string);
        // AI fallback
        if (!summary) {
          const ai = await summarizePRDiffOneLine({ repo: repoName || 'repo', title, body: issue?.body });
          if (ai) summary = ai;
        }
        if (typeof issue?.number === 'number') image_url = og(`/issues/${issue.number}`);
        if (!image_url) image_url = og();
        break;
      }
      case 'IssueCommentEvent': {
        const issue = ev.payload?.issue;
        const comment = ev.payload?.comment;
        title = `Commented on #${issue?.number}: ${issue?.title || ''}`.trim();
        if (typeof comment?.body === 'string') {
          body = comment.body; // show full comment body
          summary = comment.body.split('\n')[0].slice(0, 200);
        }
        if (comment?.html_url) artifacts.push({ type: 'comment', url: comment.html_url });
        if (issue?.html_url) artifacts.push({ type: 'issue', url: issue.html_url });
        why = deriveWhy(repoName, type, title, body || '');
        // AI fallback
        if (!summary) {
          const ai = await summarizePRDiffOneLine({ repo: repoName || 'repo', title, body });
          if (ai) summary = ai;
        }
        if (typeof issue?.number === 'number') image_url = og(`/issues/${issue.number}`);
        if (!image_url) image_url = og();
        break;
      }
      case 'ReleaseEvent': {
        const rel = ev.payload?.release;
        title = `Released ${rel?.tag_name || ''} in ${repoName}`.trim();
        if (rel?.name) summary = rel.name;
        if (rel?.html_url) artifacts.push({ type: 'release', url: rel.html_url });
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        why = deriveWhy(repoName, type, title, (summary || rel?.body || '') as string);
        image_url = og();
        break;
      }
      case 'WatchEvent': {
        title = `Starred ${repoName}`;
        summary = `Gave a star to ${repoName}`;
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        why = 'Signals quality or usefulness of the repository.';
        image_url = og();
        break;
      }
      case 'ForkEvent': {
        const forkee = ev.payload?.forkee;
        title = `Forked ${repoName} → ${forkee?.full_name || ''}`.trim();
        summary = `Forked ${repoName}`;
        if (forkee?.html_url) artifacts.push({ type: 'repo', url: forkee.html_url });
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        why = 'Enables experimentation or new direction built on the original project.';
        image_url = og();
        break;
      }
      default: {
        if (repoName) artifacts.push({ type: 'repo', url: `https://github.com/${repoName}` });
        break;
      }
    }
  } catch {
    // ignore mapping errors, use defaults
  }

  return {
    id: `event-${ev.id}`,
    author_github_login: ev.actor?.login || ev.repo?.name?.split('/')[0] || 'github',
    title,
    body,
    artifacts,
    created_at: ev.created_at,
    _type: 'event',
    subtype: type,
    summary,
    why,
    image_url,
  };
}

// Simple heuristic to explain why the change matters
function deriveWhy(repo: string | undefined, type: string, title: string, text?: string): string | undefined {
  const src = `${title}\n${text || ''}`.toLowerCase();
  const has = (w: string | RegExp) => (typeof w === 'string' ? src.includes(w) : w.test(src));

  if (has(/perf|optimi[sz]e|faster|latency|throughput|idle|poll|cache|memory|cpu|gc/)) {
    return 'Improves performance or efficiency for end users.';
  }
  if (has(/fix|bug|crash|error|regression|fails?|broken|null ref|undefined/)) {
    return 'Fixes a user-visible bug to increase stability.';
  }
  if (has(/security|cve|xss|csrf|injection|vuln|patch/)) {
    return 'Addresses a security risk to protect users and data.';
  }
  if (has(/feature|add|support|enable|implement|introduc/)) {
    return 'Adds or enables a new capability.';
  }
  if (has(/refactor|cleanup|restructure|internal|simplif|maintain/)) {
    return 'Improves code maintainability for faster future changes.';
  }
  if (has(/doc|readme|typo|guide|example/)) {
    return 'Improves documentation to make the project easier to use.';
  }
  if (has(/test|coverage|ci|workflow|pipeline|build/)) {
    return 'Strengthens reliability via build/test improvements.';
  }
  if (has(/type|typing|ts\b|typescript/)) {
    return 'Improves type safety and developer experience.';
  }
  // Fallbacks by event type
  if (type === 'ReleaseEvent') return 'Delivers a new version with fixes or features.';
  if (type === 'PullRequestEvent') return 'Proposes a change with user-facing impact.';
  if (type === 'PushEvent') return 'Moves the project forward with fresh commits.';
  return undefined;
}

// Curated sources and a tiny in-memory cache to avoid rate limits
const CURATED_USERS: string[] = [
  'sindresorhus',
  'gaearon',
  'addyosmani',
  'rauchg',
  'torvalds',
  'yyx990803', // Evan You
  'kentcdodds',
  'tannerlinsley',
  'tj',
  'mitchellh',
  'ry',
  'mxstbr',
  // added
  'evanw',         // esbuild
  'Rich-Harris',   // Svelte
  'mrdoob',        // three.js
  'ljharb',        // JS ecosystem
  'antirez',       // Redis
  'feross',
  'thepracticaldev', // DEV cofounder
  'swyxio',
  // new additions
  'sokra',         // webpack
  'thejameskyle',  // Babel, Rome
  'mjackson',      // React Router
  'zkat',          // npm, tink
  'zloirock',      // core-js
  'bkeepers',      // Probot
  'orta',          // CocoaPods, TypeScript tooling
  'kdy1',          // SWC
  'shuding',       // Next.js / Vercel
  'paulirish',     // Chrome
];
let curatedCache: { expiresAt: number; events: any[] } | null = null;
const CURATED_TTL_MS = 5 * 60 * 1000;
const CURATED_MAX_AGE_DAYS = parseInt(process.env.CURATED_MAX_AGE_DAYS || '14', 10);

// GET /api/posts/:username - posts by user
router.get('/posts/:username', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('author_github_login', req.params.username)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('list posts error', err);
    return res.status(500).json({ error: 'Failed to list posts' });
  }
});

// POST /api/posts
router.post('/posts', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const { author, title, body, artifacts } = req.body as {
    author: string;
    title: string;
    body?: string;
    artifacts?: any[];
  };
  if (!author || !title) return res.status(400).json({ error: 'author and title are required' });
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert({ author_github_login: author, title, body: body || null, artifacts: artifacts || [] })
      .select('*')
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (err) {
    console.error('create post error', err);
    return res.status(500).json({ error: 'Failed to create post' });
  }
});

// GET /api/feed/:username - posts by people the user follows (and self)
router.get('/feed/:username', async (req: Request, res: Response) => {
  const { username } = req.params;
  const token = (req.headers.authorization || '').replace('Bearer ', '') || undefined;
  try {
    const targets: string[] = [username];
    let posts: any[] = [];
    let productEvents: any[] = [];

    if (supabase) {
      try {
        const { data: followsData } = await supabase
          .from('follows')
          .select('target_github_login')
          .eq('follower_github_login', username);
        if (Array.isArray(followsData)) {
          targets.push(...followsData.map((f: any) => f.target_github_login));
        }
      } catch (e) {
        console.error('feed follows error', e);
      }

      try {
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .in('author_github_login', targets)
          .order('created_at', { ascending: false })
          .limit(100);
        posts = postsData || [];
      } catch (e) {
        console.error('feed posts error', e);
      }

      try {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, owner_github_login, name, tagline, mrr_usd, updated_at, created_at')
          .in('owner_github_login', targets)
          .order('updated_at', { ascending: false })
          .limit(100);
        productEvents = (productsData || []).map((p: any) => ({
          id: `prod-${p.id}-${p.updated_at}`,
          author_github_login: p.owner_github_login,
          title: `Updated ${p.name}`,
          body: p.tagline ? `"${p.tagline}"` : null,
          artifacts: [{ type: 'product', url: `/product/${p.id}` }],
          created_at: p.updated_at || p.created_at,
          _type: 'product',
          subtype: 'product_update',
        }));
      } catch (e) {
        console.error('feed products error', e);
      }
    }

    let merged = [...posts, ...productEvents]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100);

    if (merged.length < 10) {
      const now = Date.now();
      if (!curatedCache || curatedCache.expiresAt < now) {
        try {
          const eventsArrays = await Promise.all(CURATED_USERS.map((u) => fetchPublicEventsForUser(u, token)));
          const cutoff = now - CURATED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
          let events = eventsArrays
            .flat()
            .filter((e: any) => new Date(e.created_at).getTime() >= cutoff);
          // Fallback: if too few, include older ones to avoid empty feed
          if (events.length < 20) {
            events = eventsArrays.flat();
          }
          events = events.slice(0, 100);
          curatedCache = { expiresAt: now + CURATED_TTL_MS, events };
        } catch (e) {
          curatedCache = { expiresAt: now + CURATED_TTL_MS, events: [] };
        }
      }
      let curatedPosts = await Promise.all((curatedCache.events || []).map((ev: any) => mapGitHubEventToPost(ev, token)));
      // Group related PR events into a series card
      try {
        curatedPosts = await groupPullRequestSeries(curatedPosts);
      } catch {}
      try {
        merged = [...merged, ...curatedPosts]
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100);
      } catch (e) {
        // non-fatal
      }
    }

    return res.json(merged);
  } catch (err) {
    console.error('feed error', err);
    // Last-ditch curated-only fallback
    try {
      const now = Date.now();
      if (!curatedCache || curatedCache.expiresAt < now) {
        const eventsArrays = await Promise.all(CURATED_USERS.map((u) => fetchPublicEventsForUser(u)));
        const cutoff = now - CURATED_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
        let events = eventsArrays
          .flat()
          .filter((e: any) => new Date(e.created_at).getTime() >= cutoff);
        if (events.length < 20) events = eventsArrays.flat();
        curatedCache = { expiresAt: now + CURATED_TTL_MS, events: events.slice(0, 100) };
      }
      let curatedPosts = await Promise.all((curatedCache.events || []).map((ev: any) => mapGitHubEventToPost(ev, token)));
      try { curatedPosts = await groupPullRequestSeries(curatedPosts); } catch {}
      return res.json(curatedPosts);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch feed' });
    }
  }
});

export default router;

// Group multiple PR-related events into a single series summary card
async function groupPullRequestSeries(items: any[]): Promise<any[]> {
  const isPrLike = (p: any) => p?._type === 'event' && ['PullRequestEvent','PullRequestReviewEvent','PullRequestReviewCommentEvent'].includes(p?.subtype);
  const getRepo = (p: any): string | undefined => {
    const repoChip = Array.isArray(p?.artifacts) ? p.artifacts.find((a: any) => a.type === 'repo') : undefined;
    const url: string | undefined = repoChip?.url;
    if (!url) return undefined;
    const m = url.match(/https:\/\/github\.com\/(.+)$/);
    return m ? m[1] : undefined;
  };
  const byKey: Record<string, any[]> = {};
  const WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
  for (const p of items) {
    if (!isPrLike(p)) continue;
    const repo = getRepo(p);
    const author = p.author_github_login;
    const t = new Date(p.created_at).getTime();
    if (!repo || !author || Number.isNaN(t)) continue;
    const bucket = Math.floor(t / WINDOW_MS) * WINDOW_MS;
    const key = `${author}|${repo}|${bucket}`;
    (byKey[key] = byKey[key] || []).push(p);
  }

  const removeIds = new Set<string>();
  const seriesCards: any[] = [];
  for (const [key, arr] of Object.entries(byKey)) {
    if (arr.length < 2) continue; // require at least 2 PR-related events
    arr.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const author = arr[0].author_github_login;
    const repo = getRepo(arr[0]);
    const end = arr[0].created_at;
    const titles = arr.map((p: any) => p.title).filter(Boolean) as string[];
    // AI summarize titles into one line
    let summary: string | undefined;
    try {
      summary = await summarizePRDiffOneLine({ repo: repo || 'repo', title: `PR series in ${repo}`, body: titles.join('\n') });
    } catch {}
    const children = arr.map((p: any) => ({ id: p.id, title: p.title, summary: p.summary, artifacts: p.artifacts, created_at: p.created_at }));
    const title = `PR series in ${repo} (${arr.length} updates)`;
    seriesCards.push({
      id: `series-${key}`,
      author_github_login: author,
      title,
      summary,
      artifacts: [{ type: 'repo', url: `https://github.com/${repo}` }].filter(Boolean),
      created_at: end,
      _type: 'series',
      subtype: 'pr_series',
      items: children,
      image_url: repo ? `https://opengraph.githubassets.com/gl${Math.floor(Date.now()/(10*60*1000))}/${repo}` : undefined,
    });
    arr.forEach((p: any) => removeIds.add(p.id));
  }

  if (seriesCards.length === 0) return items;
  const kept = items.filter((p) => !removeIds.has(p.id));
  return [...kept, ...seriesCards];
}
// DEV: seed sample posts and follows
router.post('/dev/seed-posts', async (req: Request, res: Response) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
  const allowed = process.env.ALLOW_SEED === 'true' || process.env.NODE_ENV !== 'production';
  if (!allowed) return res.status(403).json({ error: 'Seeding disabled' });

  const { username } = req.body as { username?: string };
  if (!username) return res.status(400).json({ error: 'username required' });

  const authors = [username, 'octocat', 'torvalds', 'gaearon'].slice(0, 3);
  const now = Date.now();
  const samples = [
    {
      title: 'Shipped caching layer v1.2',
      body: 'Optimized cold-starts, added LRU + background revalidation. Benchmarks show ~35% latency drop.',
      artifacts: [{ type: 'pr', url: 'https://github.com/example/repo/pull/42' }],
    },
    {
      title: 'RFC: plugin system for builders',
      body: 'Seeking feedback on the new plugin API. Looking for early adopters this week.',
      artifacts: [{ type: 'issue', url: 'https://github.com/example/repo/issues/128' }],
    },
    {
      title: 'Release v0.9 beta',
      body: 'First public beta is live. Includes dark mode, offline support, and typed SDK.',
      artifacts: [{ type: 'release', url: 'https://github.com/example/repo/releases/tag/v0.9.0' }],
    },
  ];

  try {
    // follow the two sample authors
    const followRows = authors
      .filter((a) => a !== username)
      .map((a) => ({ follower_github_login: username, target_github_login: a }));
    if (followRows.length > 0) {
      await supabase.from('follows').upsert(followRows, { onConflict: 'follower_github_login,target_github_login' });
    }

    // insert posts (spread across authors)
    const postRows = samples.map((s, i) => ({
      author_github_login: authors[i % authors.length],
      title: s.title,
      body: s.body,
      artifacts: s.artifacts,
      created_at: new Date(now - i * 60 * 60 * 1000).toISOString(),
    }));

    const { data, error } = await supabase.from('posts').insert(postRows).select('*');
    if (error) throw error;

    return res.json({ inserted: data?.length || 0 });
  } catch (err) {
    console.error('seed posts error', err);
    return res.status(500).json({ error: 'Failed to seed posts' });
  }
});
