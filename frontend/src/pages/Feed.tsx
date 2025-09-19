import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api.ts';

export default function Feed() {
  const renderItem = (p: any) => {
    const icon = p._type === 'product' ? '🧩' : (p._type === 'event' ? '🌐' : '📝');
    const author = p.author_github_login;
    const avatar = `https://github.com/${author}.png?size=40`;
    return (
      <article key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Link to={`/profile/${author}`} className="shrink-0">
            <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>
                <Link to={`/profile/${author}`} className="hover:underline">@{author}</Link>
                {` • ${new Date(p.created_at).toLocaleString()}`}
              </span>
              {p._type === 'event' && (
                <button
                  className="text-xs text-gray-400 hover:text-gray-500"
                  onClick={() => setHiddenEvents((prev) => Array.from(new Set([...prev, p.id])))}
                >
                  Hide
                </button>
              )}
            </div>
            {p._type === 'event' && (
              <div className="mt-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 text-[10px]">
                  From the community
                </span>
              </div>
            )}
            <h2 className="font-semibold mt-1 flex items-center gap-2"><span>{icon}</span><span className="truncate">{p.title}</span></h2>
            {p.image_url && (
              <img src={p.image_url} alt="preview" className="mt-2 w-full rounded-md border border-gray-200 dark:border-gray-700" />
            )}
            {p._type === 'series' && Array.isArray(p.items) && (
              <SeriesBlock series={p} />
            )}
            {p.summary && (
              <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">{p.summary}</p>
            )}
            {typeof p.body === 'string' && p.body.length > 0 && (
              <>
                <p className="mt-1 whitespace-pre-wrap text-sm">{(expandedBodies[p.id] ? p.body : (p.body.length > 320 ? p.body.slice(0, 320) + '…' : p.body))}</p>
                {p.body.length > 320 && (
                  <button
                    className="mt-1 text-xs text-brand-600 hover:underline"
                    onClick={() => setExpandedBodies((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                  >
                    {expandedBodies[p.id] ? 'Show less' : 'Show more'}
                  </button>
                )}
              </>
            )}
            {Array.isArray(p.artifacts) && p.artifacts.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {p.artifacts.map((a: any, i: number) => (
                  <a
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.type || 'link'}
                  </a>
                ))}
              </div>
            )}
            <Reactions itemId={p.id} />
          </div>
        </div>
      </article>
    );
  };
  const SeriesBlock = ({ series }: { series: any }) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="mt-1">
        <button
          className="text-xs text-brand-600 hover:underline"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Hide PRs' : `Show ${series.items?.length || 0} PRs`}
        </button>
        {open && (
          <ul className="mt-2 space-y-1">
            {series.items.map((c: any) => (
              <li key={c.id} className="text-sm">
                <div className="font-medium">{c.title}</div>
                {c.summary && <div className="text-xs text-gray-600 dark:text-gray-300">{c.summary}</div>}
                {Array.isArray(c.artifacts) && c.artifacts.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {c.artifacts.map((a: any, i: number) => (
                      <a key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600" href={a.url} target="_blank" rel="noreferrer">{a.type || 'link'}</a>
                    ))}
                  </div>
                )}
              </li>) )}
          </ul>
        )}
      </div>
    );
  };
  const { user } = useAuth();
  const { data, error } = useSWR(user ? `/api/feed/${user.login}` : null, (url) => api.get(url).then((r) => r.data));
  const { data: stories } = useSWR(user ? `/api/stories/${user.login}` : null, (url)=>api.get(url).then(r=>r.data));
  const { data: followingList } = useSWR(user ? `/api/following/${user.login}` : null, (url)=>api.get(url).then(r=>r.data));
  const [activeTab, setActiveTab] = useState<'all' | 'following' | 'community'>('all');
  const [hiddenEvents, setHiddenEvents] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('feed_hidden_events') || '[]'); } catch { return []; }
  });
  const [expandedBodies, setExpandedBodies] = useState<Record<string, boolean>>({});

  useEffect(() => {
    document.title = 'Feed | GitLinkr';
  }, []);

  useEffect(() => {
    localStorage.setItem('feed_hidden_events', JSON.stringify(hiddenEvents));
  }, [hiddenEvents]);

  const isLoading = !!user && !data && !error;

  // Sample posts to show when there are no real posts yet
  const samplePosts = [
    {
      id: 's1',
      author_github_login: 'octocat',
      title: 'Shipped v1.0 of the webhook processor',
      body: 'Cut cold-starts by 40% with a simple queue + retry strategy. Next up: dead-letter metrics.',
      artifacts: [
        { type: 'pr', url: 'https://github.com/octo/example/pull/42' },
      ],
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 's2',
      author_github_login: 'gaearon',
      title: 'RFC: progressive hydration API',
      body: 'Looking for feedback from folks running large SSR apps. Draft API is linked below.',
      artifacts: [
        { type: 'rfc', url: 'https://github.com/example/rfcs/issues/128' },
      ],
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 's3',
      author_github_login: 'torvalds',
      title: 'Release: 0.9.0-beta tagged',
      body: 'Changelog highlights: IO scheduler tweaks, better tracing, and fewer footguns.',
      artifacts: [
        { type: 'release', url: 'https://github.com/example/repo/releases/tag/v0.9.0' },
      ],
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const isSample = !!error || (Array.isArray(data) && data.length === 0);
  const posts = ((isSample ? samplePosts : data) ?? []) as any[];
  const meAndFollowing: string[] = useMemo(()=>{
    return [user?.login || '', ...((followingList as string[]) || [])].filter(Boolean);
  }, [user, followingList]);
  const filteredBase = posts.filter((p: any) => !hiddenEvents.includes(p.id));
  const filtered = useMemo(()=>{
    if (activeTab === 'community') return filteredBase.filter((p)=>p._type === 'event');
    if (activeTab === 'following') return filteredBase.filter((p)=>p._type !== 'event' && meAndFollowing.includes(p.author_github_login));
    return filteredBase;
  }, [filteredBase, activeTab, meAndFollowing]);

  const withSort = useMemo(()=>[...filtered].sort((a: any, b: any)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [filtered]);

  const groupLabel = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return 'Today';
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    if (d > weekAgo) return 'This week';
    return 'Earlier';
  };
  const grouped = useMemo(()=>{
    const map: Record<string, any[]> = {};
    withSort.forEach((p)=>{
      const label = groupLabel(p.created_at);
      map[label] = map[label] || [];
      map[label].push(p);
    });
    const order = ['Today','Yesterday','This week','Earlier'];
    return order.filter((o)=>map[o]?.length).map((o)=>({ label: o, items: map[o] }));
  }, [withSort]);

  // Cluster by author within a short time window for compactness
  const windowMs = 20 * 60 * 1000; // 20 minutes
  const [collapsedClusters, setCollapsedClusters] = useState<Record<string, boolean>>({});
  const clusteredByDate = useMemo(() => {
    return grouped.map((g) => {
      const clusters: Array<{ key: string; author: string; start: number; end: number; items: any[] }> = [];
      let current: { author: string; start: number; end: number; items: any[] } | null = null;
      g.items.forEach((p: any) => {
        const author = p.author_github_login;
        const t = new Date(p.created_at).getTime();
        if (!current || current.author !== author || Math.abs(current.start - t) > windowMs) {
          if (current) clusters.push({ key: `${g.label}:${current.author}:${current.start}`, author: current.author, start: current.start, end: current.end, items: current.items });
          current = { author, start: t, end: t, items: [p] };
        } else {
          current.items.push(p);
          current.end = t;
        }
      });
      if (current) clusters.push({ key: `${g.label}:${current.author}:${current.start}`, author: current.author, start: current.start, end: current.end, items: current.items });
      return { label: g.label, clusters };
    });
  }, [grouped]);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      {!user && <p className="p-8">Sign in to view your feed</p>}
      {user && isLoading && <p className="p-8">Loading…</p>}
      {user && !isLoading && (
      <>
      <h1 className="text-2xl font-bold mb-2">Your feed</h1>
      {/* Build Stories */}
      {stories && stories.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-300">Build Stories</div>
          {stories.map((s: any) => (
            <article key={s.repo + s.period_end} className="bg-white/5 dark:bg-gray-800/60 border border-gray-700 rounded-lg p-4">
              <div className="text-xs text-gray-400">{s.repo}</div>
              <h3 className="font-semibold mt-1">{s.headline}</h3>
              {s.narrative && (
                <p className="mt-2 text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{s.narrative}</p>
              )}
              {Array.isArray(s.bullets) && s.bullets.length > 0 && (
                <ul className="mt-2 text-sm list-disc pl-5 space-y-1">
                  {s.bullets.map((b: any, i: number) => (
                    <li key={i}>
                      <span className="text-gray-300">{b.type}</span>
                      {b.link && (
                        <a href={b.link} target="_blank" rel="noreferrer" className="ml-2 text-brand-500 hover:underline">link</a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'following', label: 'Following' },
          { key: 'community', label: 'Community' },
        ].map((t: any) => (
          <button
            key={t.key}
            onClick={()=>setActiveTab(t.key)}
            className={`px-3 py-1 rounded-full text-sm border ${activeTab===t.key ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-end text-sm text-gray-600 dark:text-gray-300">
        {hiddenEvents.length > 0 && (
          <button
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            onClick={()=>setHiddenEvents([])}
          >
            Reset hidden items
          </button>
        )}
      </div>
      {isSample && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 text-sm text-yellow-500">
          {error ? 'Feed temporarily unavailable — showing sample posts.' : 'Showing sample posts until your network starts posting.'}
        </div>
      )}
      {clusteredByDate.map((group) => (
        <div key={group.label} className="space-y-3">
          <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-2">{group.label}</div>
          {group.clusters.map((cl) => {
            const cid = cl.key;
            const isCollapsed = collapsedClusters[cid] ?? (cl.items.length > 1);
            const when = new Date(cl.start).toLocaleTimeString();
            return (
              <div key={cid} className="bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <button
                  onClick={()=>setCollapsedClusters((prev)=>({ ...prev, [cid]: !isCollapsed }))}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Link to={`/profile/${cl.author}`} className="flex items-center gap-2">
                      <img src={`https://github.com/${cl.author}.png?size=24`} className="w-5 h-5 rounded-full" alt="avatar" />
                      <span className="font-medium hover:underline">@{cl.author}</span>
                    </Link>
                    <span className="text-gray-500">around {when}</span>
                  </span>
                  <span className="text-xs text-gray-500">{cl.items.length} updates</span>
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {cl.items.map((p: any) => renderItem(p))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      </>
      )}
    </div>
  );
}

function Reactions({ itemId }: { itemId: string }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get(`/api/reactions`, { params: { ids: itemId } });
        const data = res.data?.[itemId] || {};
        if (!cancelled) setCounts(data);
      } catch {}
    };
    run();
    return () => { cancelled = true; };
  }, [itemId]);

  const toggle = async (type: 'like' | 'fire' | 'sparkle') => {
    if (!user) return;
    const did = !!mine[type];
    setMine((m) => ({ ...m, [type]: !did }));
    setCounts((c) => ({ ...c, [type]: Math.max(0, (c[type] || 0) + (did ? -1 : 1)) }));
    try {
      if (did) {
        await api.delete('/api/reactions', { data: { item_id: itemId, type, user: user.login } });
      } else {
        await api.post('/api/reactions', { item_id: itemId, type, user: user.login });
      }
    } catch {
      // revert on error
      setMine((m) => ({ ...m, [type]: did }));
      setCounts((c) => ({ ...c, [type]: Math.max(0, (c[type] || 0) + (did ? 1 : -1)) }));
    }
  };

  const Btn = ({ t, label }: { t: 'like' | 'fire' | 'sparkle'; label: string }) => (
    <button
      onClick={() => toggle(t)}
      className={`text-xs px-2 py-1 rounded border ${mine[t] ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 dark:border-gray-700'}`}
    >
      {label} {counts[t] ? counts[t] : ''}
    </button>
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      <Btn t="like" label="👍" />
      <Btn t="fire" label="🔥" />
      <Btn t="sparkle" label="✨" />
    </div>
  );
}
