import express from 'express';
import { searchUsersByCompany, searchStartupRepos } from '../utils/github';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// GET /api/search/company?name=google
router.get('/company', async (req, res) => {
  const company = req.query.name as string;
  if (!company) return res.status(400).json({ error: 'name query required' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || undefined;
    const users = await searchUsersByCompany(company, token);
    res.json(users);
  } catch (err) {
    console.error('Company search error:', err);
    res.status(500).json({ error: 'Company search failed' });
  }
});

export default router;

// GET /api/search/trending - naive trending developers/products
router.get('/trending', async (_req, res) => {
  try {
    const out: any = { developers: [], products: [] };
    if (supabase) {
      try {
        const { data: products } = await supabase
          .from('products')
          .select('id, owner_github_login, name, tagline, mrr_usd, updated_at')
          .order('mrr_usd', { ascending: false })
          .limit(10);
        out.products = products || [];
      } catch {}
      try {
        const { data: posts } = await supabase
          .from('posts')
          .select('author_github_login, created_at')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        const counts: Record<string, number> = {};
        (posts || []).forEach((p: any) => { counts[p.author_github_login] = (counts[p.author_github_login] || 0) + 1; });
        out.developers = Object.entries(counts)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .slice(0, 10)
          .map(([login, score]) => ({ login, score }));
      } catch {}
    }
    return res.json(out);
  } catch {
    return res.json({ developers: [], products: [] });
  }
});

// GET /api/search/startups?window=14d - OSS startups by momentum heuristics
router.get('/startups', async (req, res) => {
  try {
    const window = String(req.query.window || '14d');
    const days = Number((window.match(/(\d+)/)?.[1] || 14));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateStr = since.toISOString().slice(0, 10);
    const token = (req.headers.authorization || '').replace('Bearer ', '') || process.env.GITHUB_FALLBACK_TOKEN || undefined;
    const saasOnly = String(req.query.saas || 'false') === 'true';

    // Compose queries that bias towards startup/saas style projects with activity
    const queries = saasOnly
      ? [
          `topic:saas pushed:>${dateStr} sort:stars`,
          `saas in:description pushed:>${dateStr} sort:stars`,
          `subscription billing in:description pushed:>${dateStr} sort:stars`,
          `topic:stripe topic:subscription pushed:>${dateStr} sort:stars`,
        ]
      : [
          `topic:startup pushed:>${dateStr} sort:stars`,
          `topic:saas pushed:>${dateStr} sort:stars`,
          `created:>${dateStr} stars:>50 sort:stars`,
        ];
    const resultsArrays = await Promise.all(queries.map((q) => searchStartupRepos({ query: q, perPage: 20 }, token)));
    const repos = resultsArrays.flat();
    // Dedup by full_name
    const byName = new Map<string, any>();
    repos.forEach((r: any) => {
      if (!byName.has(r.full_name)) byName.set(r.full_name, r);
    });

    // Heuristic filter: aim for OSS startups / SaaS products, not general frameworks
    const EXCLUDE_ORGS = new Set([
      'vercel','facebook','reactjs','angular','vuejs','sveltejs','nuxt','denoland','nodejs','rust-lang','golang','tensorflow','pytorch','huggingface','microsoft','apple','google','openai'
    ]);
    const EXCLUDE_REPO_NAMES = new Set(['next.js','react','angular','vue','svelte','nuxt','remix','transformers']);
    const NEGATIVE_KEYWORDS = [/template/i,/starter/i,/boilerplate/i,/sdk/i,/framework/i,/library/i,/plugin/i,/theme/i,/cookbook/i,/awesome/i,/example/i,/samples?/i,/eslint/i,/prettier/i,/config/i,/types?/i,/docs?/i,/tutorial/i,/playground/i];
    const POSITIVE_KEYWORDS = [/self[- ]?hosted/i,/saas/i,/analytics/i,/crm/i,/cms/i,/monitoring|observability/i,/status[- ]?page/i,/helpdesk|support|ticket/i,/chat|inbox/i,/forms?/i,/feedback/i,/billing|subscription/i,/email/i,/dashboard/i,/platform/i,/alternative/i,/open[- ]?core/i,/product/i];
    const looksLikeStartup = (r: any) => {
      const owner = (r.owner?.login || '').toLowerCase();
      const ownerType = (r.owner?.type || '').toLowerCase();
      const name = (r.name || '').toLowerCase();
      const full = (r.full_name || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const topics: string[] = Array.isArray(r.topics) ? r.topics.map((t:any)=>String(t).toLowerCase()) : [];
      const homepage = String(r.homepage || '').toLowerCase();
      const isExcluded = EXCLUDE_ORGS.has(owner) || EXCLUDE_REPO_NAMES.has(name) || NEGATIVE_KEYWORDS.some((re)=>re.test(name) || re.test(desc));
      const topicSignals = topics.some((t)=>['startup','saas','open-core','product','self-hosted','opensource','open-source','openstartup','status-page','analytics','cms','crm','billing','subscription','email','forms','helpdesk','support','ticketing','chat','monitoring','observability'].includes(t));
      const keywordSignals = POSITIVE_KEYWORDS.some((re)=>re.test(desc) || re.test(name));
      const hasHomepageProduct = homepage && !homepage.includes('github.com') && !homepage.includes('readthedocs') && !homepage.includes('npmjs.com');
      const orgOrTeam = ownerType === 'organization';
      const starGate = (r.stargazers_count || 0) >= 200;
      const positiveCount = [topicSignals, keywordSignals, hasHomepageProduct].filter(Boolean).length;
      return !isExcluded && starGate && positiveCount >= 2 && (orgOrTeam || hasHomepageProduct);
    };

    const startupRepos = Array.from(byName.values()).filter(looksLikeStartup);

    let items = startupRepos.slice(0, 30).map((r: any) => ({
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      homepage: r.homepage,
      pushed_at: r.pushed_at,
      topics: r.topics,
    }));
    if (!items || items.length === 0) {
      const fallback = [
        'supabase/supabase',
        'calcom/cal.com',
        'PostHog/posthog',
        'appwrite/appwrite',
        'nocodb/nocodb',
        'umami-software/umami',
        'outline/outline',
        'plane-dev/plane',
        'medusajs/medusa',
        'openstatusHQ/openstatus',
        'windmill-labs/windmill'
      ];
      items = fallback.map((full) => ({
        full_name: full,
        html_url: `https://github.com/${full}`,
        description: undefined,
        language: undefined,
        stars: undefined,
        homepage: undefined,
        pushed_at: undefined,
        topics: [],
      }));
    }
    return res.json({ items });
  } catch (e) {
    return res.json({ items: [] });
  }
});

// GET /api/search/categories - multiple curated repo buckets
router.get('/categories', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '') || process.env.GITHUB_FALLBACK_TOKEN || undefined;
    const days = Number((String(req.query.window || '14d').match(/(\d+)/)?.[1] || 14));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateStr = since.toISOString().slice(0, 10);

    const build = async (queries: string[], limit = 10) => {
      const arrays = await Promise.all(queries.map((q) => searchStartupRepos({ query: q, perPage: limit }, token)));
      const repos = arrays.flat();
      const by = new Map<string, any>();
      repos.forEach((r: any) => { if (!by.has(r.full_name)) by.set(r.full_name, r); });
      return Array.from(by.values()).slice(0, limit).map((r: any) => ({
        full_name: r.full_name,
        html_url: r.html_url,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count,
        homepage: r.homepage,
        pushed_at: r.pushed_at,
        topics: r.topics,
      }));
    };

    const categories = await Promise.all([
      build([
        `topic:ai pushed:>${dateStr} sort:stars`,
        `topic:machine-learning pushed:>${dateStr} sort:stars`,
        `topic:llm pushed:>${dateStr} sort:stars`,
      ], 12),
      build([
        `topic:devtools pushed:>${dateStr} sort:stars`,
        `devtools in:description pushed:>${dateStr} sort:stars`,
        `topic:cli pushed:>${dateStr} sort:stars`,
      ], 12),
      build([
        `topic:framework pushed:>${dateStr} sort:stars`,
        `topic:nextjs pushed:>${dateStr} sort:stars`,
        `topic:remix pushed:>${dateStr} sort:stars`,
      ], 12),
      build([
        `topic:database pushed:>${dateStr} sort:stars`,
        `topic:postgres pushed:>${dateStr} sort:stars`,
        `topic:sqlite pushed:>${dateStr} sort:stars`,
      ], 12),
      build([
        `created:>${dateStr} stars:>50 sort:stars`,
      ], 12),
      build([
        `language:TypeScript pushed:>${dateStr} topic:saas sort:stars`,
        `language:JavaScript pushed:>${dateStr} topic:startup sort:stars`,
      ], 12),
      build([
        `language:Python pushed:>${dateStr} sort:stars`,
      ], 12),
      build([
        `language:Rust pushed:>${dateStr} sort:stars`,
      ], 12),
      build([
        `language:Go pushed:>${dateStr} sort:stars`,
      ], 12),
      build([
        `stripe in:description pushed:>${dateStr} sort:stars`,
        `subscription in:description pushed:>${dateStr} sort:stars`,
        `topic:stripe pushed:>${dateStr} sort:stars`,
      ], 12),
    ]);

    const mk = (full: string) => ({ full_name: full, html_url: `https://github.com/${full}` });
    const fallbackPayload = {
      ai_ml: ['langchain-ai/langchain', 'huggingface/transformers', 'ollama/ollama'].map(mk),
      dev_tools: ['withastro/astro', 'biomejs/biome', 'eslint/eslint'].map(mk),
      frameworks: ['vercel/next.js', 'remix-run/remix', 'nuxt/nuxt'].map(mk),
      databases: ['supabase/supabase', 'prisma/prisma', 'postgres/postgres'].map(mk),
      new_and_noteworthy: ['openstatusHQ/openstatus', 'windmill-labs/windmill', 'langfuse/langfuse'].map(mk),
      js_ts: ['denoland/deno', 'sveltejs/svelte', 'angular/angular'].map(mk),
      python: ['fastapi/fastapi', 'pydantic/pydantic'].map(mk),
      rust: ['rust-lang/rust', 'astral-sh/uv'].map(mk),
      go: ['gin-gonic/gin', 'gofiber/fiber'].map(mk),
      payments_saas: ['stripe/stripe-cli', 'medusajs/medusa'].map(mk),
    } as any;

    const payload = {
      ai_ml: categories[0]?.length ? categories[0] : fallbackPayload.ai_ml,
      dev_tools: categories[1]?.length ? categories[1] : fallbackPayload.dev_tools,
      frameworks: categories[2]?.length ? categories[2] : fallbackPayload.frameworks,
      databases: categories[3]?.length ? categories[3] : fallbackPayload.databases,
      new_and_noteworthy: categories[4]?.length ? categories[4] : fallbackPayload.new_and_noteworthy,
      js_ts: categories[5]?.length ? categories[5] : fallbackPayload.js_ts,
      python: categories[6]?.length ? categories[6] : fallbackPayload.python,
      rust: categories[7]?.length ? categories[7] : fallbackPayload.rust,
      go: categories[8]?.length ? categories[8] : fallbackPayload.go,
      payments_saas: categories[9]?.length ? categories[9] : fallbackPayload.payments_saas,
    };
    return res.json(payload);
  } catch (e) {
    return res.json({ ai_ml: [], dev_tools: [], frameworks: [], databases: [], new_and_noteworthy: [], js_ts: [], python: [], rust: [], go: [], payments_saas: [] });
  }
});
