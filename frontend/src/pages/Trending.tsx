import useSWR from 'swr';
import api from '../api.ts';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';

export default function Trending() {
  const { user } = useAuth();
  const { data, error } = useSWR('/api/search/trending', (url)=>api.get(url).then(r=>r.data));
  const { data: startups } = useSWR('/api/search/startups?window=14d&saas=true', (url)=>api.get(url).then(r=>r.data));
  const { data: categories } = useSWR('/api/search/categories?window=14d', (url)=>api.get(url).then(r=>r.data));
  const { data: myRepos, mutate: refetchMyRepos } = useSWR(user ? `/api/repo-follows/${user.login}` : null, (url)=>api.get(url).then(r=>r.data));
  const isLoading = !data && !error;
  const developers = (data?.developers || []) as Array<{ login: string; score: number }>;
  const products = (data?.products || []) as Array<any>;
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="rounded-xl p-6 bg-gradient-to-r from-brand-600/20 to-purple-600/20 border border-brand-600/30">
        <h1 className="text-2xl font-bold">Trending</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Discover founders and SaaS projects shipping fast. Follow to see updates in your feed.</p>
      </div>
      {isLoading && <p>Loading…</p>}
      {!isLoading && (
        <>
          <section>
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">🚀 Open‑source startups</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {(startups?.items || []).map((r: any) => (
                <div key={r.full_name} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow">
                  <img src={ogFor(r.full_name)} alt="preview" className="w-full h-32 object-cover border-b border-gray-200 dark:border-gray-700" />
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <img src={avatarFor(r.full_name)} className="w-6 h-6 rounded-full" alt="avatar" />
                      <div className="font-medium truncate">{r.full_name}</div>
                    </div>
                    {r.description && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.description}</div>}
                    <div className="text-xs mt-2 flex items-center gap-3 text-gray-500">
                      <span>⭐ {r.stars}</span>
                      {r.language && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>{r.language}</span>}
                      {r.homepage && <a href={r.homepage} target="_blank" rel="noreferrer" className="underline">website</a>}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <a href={r.html_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border">View repo</a>
                      {user && (
                        <FollowRepoButton repoFullName={r.full_name} myRepos={myRepos || []} onChanged={refetchMyRepos} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {(!startups?.items || startups.items.length === 0) && <div className="text-sm text-gray-500">No results yet</div>}
            </div>
          </section>
          {categories && (
            <>
              <Category title="🧠 AI & ML" items={categories.ai_ml || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="🛠️ Developer Tools" items={categories.dev_tools || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="🧱 Frameworks" items={categories.frameworks || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="🗄️ Databases" items={categories.databases || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="✨ New & noteworthy" items={categories.new_and_noteworthy || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="JS / TS" items={categories.js_ts || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="Python" items={categories.python || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="Rust" items={categories.rust || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="Go" items={categories.go || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
              <Category title="Payments & SaaS" items={categories.payments_saas || []} myRepos={myRepos || []} onChanged={refetchMyRepos} />
            </>
          )}
          <section>
            <h2 className="text-xl font-semibold mb-2">👩‍💻 Developers</h2>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {developers.map((d)=> (
                <li key={d.login} className="py-2 flex items-center justify-between">
                  <Link to={`/profile/${d.login}`} className="hover:underline flex items-center gap-2">
                    <img src={`https://github.com/${d.login}.png?size=32`} className="w-5 h-5 rounded-full" alt="avatar" />
                    @{d.login}
                  </Link>
                  <span className="text-xs text-gray-500">{d.score} posts this week</span>
                </li>
              ))}
              {developers.length === 0 && <li className="py-2 text-sm text-gray-500">No data yet</li>}
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold mb-2">Products</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {products.map((p)=> (
                <Link to={`/product/${p.id}`} key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 hover:shadow">
                  <div className="font-medium">{p.name}</div>
                  {p.tagline && <div className="text-sm text-gray-500 dark:text-gray-400">{p.tagline}</div>}
                  <div className="text-sm mt-1">MRR {p.mrr_usd != null ? `$${Number(p.mrr_usd).toLocaleString()}` : '—'}</div>
                </Link>
              ))}
              {products.length === 0 && <div className="text-sm text-gray-500">No products yet</div>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FollowRepoButton({ repoFullName, myRepos, onChanged }: { repoFullName: string; myRepos: string[]; onChanged: ()=>void }) {
  const { user } = useAuth();
  const isFollowing = myRepos?.includes(repoFullName);
  const toggle = async () => {
    if (!user) return;
    try {
      if (isFollowing) {
        await api.delete('/api/repo-follows', { data: { user: user.login, repo: repoFullName } });
      } else {
        await api.post('/api/repo-follows', { user: user.login, repo: repoFullName });
      }
      onChanged();
    } catch {}
  };
  return (
    <button onClick={toggle} className={`text-xs px-2 py-1 rounded ${isFollowing ? 'bg-brand-600 text-white' : 'border'}`}>{isFollowing ? 'Following' : 'Follow project'}</button>
  );
}

function ogFor(fullName: string) {
  // Simple Open Graph preview from GitHub
  const salt = 'gl' + Math.floor(Date.now() / (10 * 60 * 1000));
  return `https://opengraph.githubassets.com/${salt}/${fullName}`;
}

function avatarFor(fullName: string) {
  const owner = fullName.split('/')[0];
  return `https://github.com/${owner}.png?size=40`;
}

function Category({ title, items, myRepos, onChanged }: { title: string; items: any[]; myRepos: string[]; onChanged: ()=>void }) {
  const { user } = useAuth();
  if (!items || items.length === 0) return null;
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((r: any) => (
          <div key={r.full_name} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow">
            <img src={ogFor(r.full_name)} alt="preview" className="w-full h-32 object-cover border-b border-gray-200 dark:border-gray-700" />
            <div className="p-3">
              <div className="flex items-center gap-2">
                <img src={avatarFor(r.full_name)} className="w-6 h-6 rounded-full" alt="avatar" />
                <div className="font-medium truncate">{r.full_name}</div>
              </div>
              {r.description && <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.description}</div>}
              <div className="text-xs mt-2 flex items-center gap-3 text-gray-500">
                <span>⭐ {r.stars}</span>
                {r.language && <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>{r.language}</span>}
                {r.homepage && <a href={r.homepage} target="_blank" rel="noreferrer" className="underline">website</a>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <a href={r.html_url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded border">View repo</a>
                {user && (
                  <FollowRepoButton repoFullName={r.full_name} myRepos={myRepos || []} onChanged={onChanged} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


