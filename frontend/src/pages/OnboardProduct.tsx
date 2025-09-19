import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

export default function OnboardProduct() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [mrr, setMrr] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<any[]>([]);
  const [repoSearch, setRepoSearch] = useState('');

  useEffect(() => {
    let canceled = false;
    const run = async () => {
      if (!user?.login) return;
      try {
        const r = await api.get(`/api/github/repos/${user.login}`);
        if (!canceled) setRepos(r.data || []);
      } catch {}
    };
    run();
    return () => { canceled = true; };
  }, [user?.login]);

  const filteredRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return repos.slice(0, 20);
    return repos.filter((r) => (r.full_name || r.name || '').toLowerCase().includes(q)).slice(0, 20);
  }, [repos, repoSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: any = {
        owner: user?.login,
        name,
        tagline,
        repo_url: repoUrl || null,
        website: website || null,
      };
      const res = await api.post('/api/products', payload);
      const product = res.data;
      if (mrr) {
        try {
          await api.post(`/api/products/${product.id}/revenue/manual`, { mrr_usd: Number(mrr) });
        } catch {}
      }
      navigate(`/product/${product.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Add your product</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Showcase what you’re building and track progress over time.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input value={name} onChange={(e)=>setName(e.target.value)} required className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium">Tagline</label>
          <input value={tagline} onChange={(e)=>setTagline(e.target.value)} placeholder="What it does in one line" className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium">Repository</label>
          <input value={repoSearch} onChange={(e)=>setRepoSearch(e.target.value)} placeholder="Search your repos…" className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
          <div className="mt-2 max-h-48 overflow-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-200 dark:divide-gray-700">
            {filteredRepos.map((r)=> (
              <button type="button" key={r.id} onClick={()=>{ setRepoUrl(r.html_url); setRepoSearch(r.full_name); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="font-medium">{r.full_name}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">{r.language || '—'} • ⭐{r.stargazers_count} • 🍴{r.forks_count}</div>
              </button>
            ))}
            {filteredRepos.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No repos found</div>
            )}
          </div>
          <input value={repoUrl} onChange={(e)=>setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo" className="mt-2 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium">Website</label>
          <input value={website} onChange={(e)=>setWebsite(e.target.value)} placeholder="https://yourapp.com" className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium">Current MRR (optional)</label>
          <input value={mrr} onChange={(e)=>setMrr(e.target.value)} placeholder="e.g. 250" type="number" min="0" className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" />
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex gap-3">
          <button disabled={loading} type="submit" className="px-4 py-2 rounded-md bg-brand-600 text-white disabled:opacity-50">{loading ? 'Saving…' : 'Create product'}</button>
          <button type="button" onClick={()=>navigate(-1)} className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700">Cancel</button>
        </div>
      </form>
    </div>
  );
}


