import fetch from 'node-fetch';

type CacheEntry = { expiresAt: number; value: string };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function summarizePRDiffOneLine(input: {
  repo: string;
  title?: string;
  body?: string;
  diffSnippet?: string;
}): Promise<string | undefined> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  const prompt = buildPrompt(input);
  const key = hashKey(model + '|' + prompt);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 64,
        messages: [
          {
            role: 'system',
            content:
              'You write concise, one-line developer summaries. Focus on impact (performance, correctness, security, DX). Avoid buzzwords. No preamble. 12-20 words ideally.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as any;
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (text) cache.set(key, { expiresAt: now + TTL_MS, value: text });
    return text;
  } catch {
    return undefined;
  }
}

// Multi-sentence narrative for a project's recent progress
export async function summarizeProjectNarrative(input: {
  repo: string;
  description?: string;
  topics?: string[];
  primaryLanguage?: string;
  recentTitles: string[];
  stats?: { stars?: number; forks?: number; openIssues?: number };
  period?: string; // e.g., "last 3 days"
}): Promise<string | undefined> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return undefined;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  const contextParts = [
    `Repository: ${input.repo}`,
    input.description ? `Description: ${truncate(input.description, 400)}` : '',
    input.primaryLanguage ? `Primary language: ${input.primaryLanguage}` : '',
    Array.isArray(input.topics) && input.topics.length ? `Topics: ${input.topics.slice(0, 8).join(', ')}` : '',
    input.stats ? `Stats: ⭐ ${input.stats.stars ?? '-'}  Forks ${input.stats.forks ?? '-'}  Open issues ${input.stats.openIssues ?? '-'}` : '',
    input.period ? `Period: ${input.period}` : '',
    `Recent highlights (titles):\n- ${input.recentTitles.slice(0, 12).join('\n- ')}`,
  ].filter(Boolean);

  const prompt = `${contextParts.join('\n\n')}\n\nTask: Write a concise, 2-3 sentence narrative that a developer would find engaging.\n- Explain the overall direction and user impact.\n- Avoid fluff; be specific.\n- No preamble labels.\n`;

  const key = hashKey(model + '|' + prompt);
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          { role: 'system', content: 'You are an expert technical writer for developers. Be precise and concrete.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as any;
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (text) cache.set(key, { expiresAt: now + TTL_MS, value: text });
    return text;
  } catch {
    return undefined;
  }
}

function buildPrompt(input: { repo: string; title?: string; body?: string; diffSnippet?: string }) {
  const parts = [
    `Repository: ${input.repo}`,
    input.title ? `PR Title: ${input.title}` : '',
    input.body ? `PR Description: ${truncate(input.body, 1200)}` : '',
    input.diffSnippet ? `Diff Summary (truncated):\n${truncate(input.diffSnippet, 2000)}` : '',
    'Write one line that explains why this change matters for developers.',
  ].filter(Boolean);
  return parts.join('\n\n');
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function hashKey(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}


