import express from 'express';
import * as github from '../utils/github';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

function topLanguages(repos: any[], limit = 5): string[] {
  const counts: Record<string, number> = {};
  repos.forEach((r) => {
    if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([lang]) => lang);
}

interface Candidate {
  login: string;
  avatar_url: string;
  html_url: string;
  score: number;
  company?: string;
}

// Simple in-memory cache with 5 minute TTL
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_VERSION = '2'; // bump to invalidate old cached shapes

// Max number of recommendations to return
const MAX_RECOMMENDATIONS = 24;

// Curated list used as fallback and to top-up results to ensure the page is populated
// Include popular OSS developers and educators so Browse is useful under rate limits
const CURATED_LOGINS = [
  // Frameworks / OSS maintainers
  'yyx990803', 'gaearon', 'sindresorhus', 'tj', 'addyosmani', 'simonw', 'mxstbr', 'shadcn',
  'tannerlinsley', 'kentcdodds', 'anuraghazra', 'withastro',
  // Tech creators / educators
  'ruanyf', 'bradtraversy', 'hiteshchoudhary', 'getify', 'ThePrimeagen',
  // AI / research / misc notable accounts
  'lucidrains', 'deepseek-ai',
  // Founders / builders
  'swyx', 't3dotgg', 'rauchg', 'arunoda', 'amasad', 'vercel', 'brycew', 'danielgross',
  'steveruizok', 'hakimel', 'wongmjane', 'jerrylin', 'lunasec-io'
];

const toCandidate = (login: string, baseScore = 4): Candidate => ({
  login,
  avatar_url: `https://github.com/${login}.png?size=80`,
  html_url: `https://github.com/${login}`,
  score: baseScore,
});

// Enrich a list of candidates with company information from public profiles
async function enrichWithCompany(candidates: Candidate[]): Promise<Candidate[]> {
  // Fetch profiles in parallel; tolerate failures
  const enriched = await Promise.all(
    candidates.map(async (c) => {
      try {
        const profile = await github.fetchPublicProfile(c.login);
        return { ...c, company: profile?.company || undefined } as Candidate;
      } catch {
        return c;
      }
    })
  );
  return enriched;
}

// Fallback dummy data for when rate limited
const getDummyRecommendations = async (company?: string, langs?: string[]) => {
  const curated = CURATED_LOGINS.map((l) => toCandidate(l));
  // Keep list deterministic and capped
  const sliced = curated.slice(0, MAX_RECOMMENDATIONS);
  return enrichWithCompany(sliced);
};

router.get('/recommendations/:username', async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: 'username required' });

  // Extract GitHub token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (process.env.GITHUB_FALLBACK_TOKEN || undefined);

  const { company, langs: langQuery } = req.query as { company?: string; langs?: string };
  
  // Create cache key
  const cacheKey = `${CACHE_VERSION}-${username}-${company || ''}-${langQuery || ''}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.json(cached.data);
  }

  // Dummy data toggle
  if (process.env.USE_DUMMY_DATA === 'true') {
    const dummyData = await getDummyRecommendations(company, langQuery?.split(','));
    return res.json(dummyData);
  }

  try {
    // Fetch user's repos to derive languages
    const repos = await github.fetchUserRepos(token, username);
    let langs = topLanguages(repos, 3);
    const { company, langs: langQuery } = req.query as { company?: string; langs?: string };
    if (langQuery) {
      langs = langQuery.split(',').map((l) => l.trim()).filter(Boolean);
    }

    const seen = new Set<string>([username]);
    const candidates: Record<string, Candidate> = {};

    // Company-based search
    if (company) {
      try {
        const companyUsers = await github.searchUsersByCompany(company, token);
        companyUsers.forEach((u: any) => {
          if (seen.has(u.login)) return;
          seen.add(u.login);
          candidates[u.login] = {
            login: u.login,
            avatar_url: u.avatar_url,
            html_url: u.html_url,
            score: 5, // base score for company match
          };
        });
      } catch (error) {
        console.error('Company search failed:', error);
        // Continue without company results
      }
    }

    for (const lang of langs) {
      try {
        const users = await github.searchUsersByLanguage(lang, token);
        users.forEach((u: any) => {
          if (seen.has(u.login)) return;
          seen.add(u.login);
          if (!candidates[u.login]) {
            candidates[u.login] = {
              login: u.login,
              avatar_url: u.avatar_url,
              html_url: u.html_url,
              score: 0,
            };
          }
          candidates[u.login].score += 2; // shared language weight
        });
      } catch (error) {
        console.error(`Language search failed for ${lang}:`, error);
        // Continue with other languages
      }
    }

    let out = Object.values(candidates).sort((a, b) => b.score - a.score);
    // If we have fewer than the max, top up with curated logins not already present
    if (out.length < MAX_RECOMMENDATIONS) {
      const seen = new Set(out.map((c) => c.login));
      for (const login of CURATED_LOGINS) {
        if (out.length >= MAX_RECOMMENDATIONS) break;
        if (seen.has(login)) continue;
        out.push(toCandidate(login));
      }
    }
    out = out.slice(0, MAX_RECOMMENDATIONS);
    // Enrich with company data
    out = await enrichWithCompany(out);
    
    // Cache the results
    cache.set(cacheKey, { data: out, timestamp: Date.now() });
    
    return res.json(out);
  } catch (err) {
    /* eslint-disable no-console */
    console.error('Recommendations error:', err);
    
    // If we hit rate limits or other errors, return dummy data as fallback
    const fallbackData = await getDummyRecommendations(company, langQuery?.split(','));
    console.log('Returning fallback dummy data due to API errors');
    return res.json(fallbackData);
  }
});

export default router;
