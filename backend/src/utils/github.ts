import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI || `${process.env.FRONTEND_URL}/auth/github/callback`,
    }),
  });
  if (!res.ok) throw new Error('GitHub token exchange failed');
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// Existing functions: fetchGitHubUser, fetchUserRepos, fetchPublicProfile, searchUsersByLanguage

export async function fetchGitHubUser(token: string): Promise<any> {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'GitLinkr' },
  });
  if (!res.ok) throw new Error('Failed GitHub user');
  return res.json();
}

export async function fetchUserRepos(token: string | undefined, username: string): Promise<any[]> {
  const res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'User-Agent': 'GitLinkr',
    },
  });
  if (!res.ok) throw new Error('Failed repos');
  const data: any = await res.json();
  return data as any[];
}

export async function fetchPublicProfile(username: string, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'User-Agent': 'GitLinkr' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/users/${username}`, { headers });
  if (!res.ok) throw new Error('Failed profile');
  return res.json();
}

export async function searchUsersByLanguage(lang: string, token?: string): Promise<any[]> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'GitLinkr' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const res = await fetch(`https://api.github.com/search/users?q=language:${encodeURIComponent(lang)}+repos:%3E5&per_page=30`, {
      headers,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      const rateLimitReset = res.headers.get('x-ratelimit-reset');
      if (res.status === 403 && rateLimitReset) {
        const resetTime = new Date(parseInt(rateLimitReset) * 1000);
        console.error(`GitHub rate limit exceeded. Resets at: ${resetTime.toISOString()}`);
      }
      console.error(`GitHub language search failed (${res.status}):`, errorText);
      throw new Error(`Language search failed: ${res.status}`);
    }
    
    const data = (await res.json()) as { items: any[] };
    return data.items || [];
  } catch (error) {
    console.error('Language search error:', error);
    return []; // Return empty array instead of throwing
  }
}

export async function searchUsersByCompany(company: string, token?: string): Promise<any[]> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'GitLinkr' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    const quoted = `"${company}"`;
    // First try company qualifier (may return 0)
    let res = await fetch(`https://api.github.com/search/users?q=company:${encodeURIComponent(quoted)}&per_page=30`, {
      headers,
    });

    let data: { items: any[] } = { items: [] };

    if (res.ok) {
      data = (await res.json()) as { items: any[] };
    }

    // If no results, fall back to GitHub org membership search (org:orgname)
    if ((!res.ok || (data.items || []).length === 0) && /^[a-zA-Z0-9-]+$/.test(company)) {
      // list public members of the organisation as fallback
      const membersRes = await fetch(`https://api.github.com/orgs/${encodeURIComponent(company)}/members?per_page=30`, {
        headers,
      });
      if (membersRes.ok) {
        const members = (await membersRes.json()) as any[];
        return members;
      }
      // final fallback: org search
      res = await fetch(`https://api.github.com/search/users?q=org:${encodeURIComponent(company)}&per_page=30`, { headers });
      if (res.ok) {
        const searchData = (await res.json()) as { items: any[] };
        return searchData.items || [];
      }
    }

    return data.items || [];
  } catch (error) {
    console.error('Company search error:', error);
    return []; // Return empty array instead of throwing
  }
}

// Fetch recent public events for a GitHub user to surface curated activity
export async function fetchPublicEventsForUser(username: string, token?: string): Promise<any[]> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'GitLinkr' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=20`, {
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`events for ${username} failed (${res.status})`, text);
      return [];
    }
    const data = (await res.json()) as any[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('fetchPublicEventsForUser error', err);
    return [];
  }
}

// Fetch PR files and an abbreviated diff summary
export async function fetchPRFiles(repoFullName: string, prNumber: number, token?: string): Promise<{ title?: string; body?: string; patchSummary?: string } | null> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'GitLinkr', Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const prRes = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}`, { headers });
    if (!prRes.ok) return null;
    const pr = (await prRes.json()) as any;

    const filesRes = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNumber}/files?per_page=100`, { headers });
    if (!filesRes.ok) return { title: pr?.title, body: pr?.body, patchSummary: undefined };
    const files = (await filesRes.json()) as any[];
    const patches = files
      .map((f) => f.patch)
      .filter(Boolean)
      .slice(0, 10)
      .join('\n\n');
    return { title: pr?.title, body: pr?.body, patchSummary: patches };
  } catch {
    return null;
  }
}

// Fetch compare between two SHAs to summarize push events
export async function fetchCompareDiff(repoFullName: string, baseSha: string, headSha: string, token?: string): Promise<{ messages?: string[]; patchSummary?: string } | null> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'GitLinkr', Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = `https://api.github.com/repos/${repoFullName}/compare/${baseSha}...${headSha}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const messages: string[] = Array.isArray(data?.commits) ? data.commits.map((c: any) => c.commit?.message).filter(Boolean) : [];
    const patches = Array.isArray(data?.files)
      ? data.files.map((f: any) => f.patch).filter(Boolean).slice(0, 10).join('\n\n')
      : undefined;
    return { messages, patchSummary: patches };
  } catch {
    return null;
  }
}

// Fetch repository metadata for richer narratives
export async function fetchRepoMetadata(fullName: string, token?: string): Promise<{
  description?: string;
  language?: string;
  topics?: string[];
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
} | null> {
  try {
    const headers: Record<string, string> = { 'User-Agent': 'GitLinkr', Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`https://api.github.com/repos/${fullName}`, { headers });
    if (!res.ok) return null;
    const repo = (await res.json()) as any;
    return {
      description: repo?.description || undefined,
      language: repo?.language || undefined,
      topics: Array.isArray(repo?.topics) ? repo.topics : undefined,
      stargazers_count: repo?.stargazers_count,
      forks_count: repo?.forks_count,
      open_issues_count: repo?.open_issues_count,
    };
  } catch {
    return null;
  }
}

// Search repositories for startup-like signals
export async function searchStartupRepos(params: { query: string; perPage?: number }, token?: string): Promise<any[]> {
  const headers: Record<string, string> = { 'User-Agent': 'GitLinkr', Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const per = params.perPage || 20;
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(params.query)}&per_page=${per}`;
  const res = await fetch(url, { headers } as any);
  if (!res.ok) return [];
  const data = (await res.json()) as any;
  return data?.items || [];
}
