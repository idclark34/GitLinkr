import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import api from '../api.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

export default function Product() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSWR(id ? `/api/products/${id}` : null, (url) => api.get(url).then((r) => r.data));
  const { user } = useAuth();
  const [mrr, setMrr] = useState<string>('');

  useEffect(() => {
    document.title = 'Product | GitLinkr';
  }, []);

  if (!data) return <p className="p-8">Loading…</p>;

  const arr = useMemo(() => (data.mrr_usd ? Number(data.mrr_usd) * 12 : null), [data.mrr_usd]);
  const isOwner = user?.login && data?.owner_github_login === user.login;

  useEffect(()=>{
    setMrr(data?.mrr_usd != null ? String(Number(data.mrr_usd)) : '');
  }, [data]);

  const saveMrr = async () => {
    if (!id) return;
    const num = mrr === '' ? null : Number(mrr);
    await api.post(`/api/products/${id}/revenue/manual`, { mrr_usd: num });
    // SWR will revalidate automatically on focus; for immediacy trigger mutate
    // but we don't have mutate here; simplest is to just refetch via location reload-lite
    // Alternatively, rely on the controlled state which is already set
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          {data.tagline && <p className="text-gray-500 dark:text-gray-400">{data.tagline}</p>}
          <div className="mt-2 flex gap-3 text-sm">
            {data.website && <a className="text-brand-500 hover:underline" href={data.website} target="_blank" rel="noreferrer">Website</a>}
            {data.repo_url && <a className="text-brand-500 hover:underline" href={data.repo_url} target="_blank" rel="noreferrer">Repository</a>}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4">
          <div className="text-sm text-gray-500">MRR</div>
          <div className="text-2xl font-semibold">{data.mrr_usd != null ? `$${Number(data.mrr_usd).toLocaleString()}` : '—'}</div>
          {isOwner && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                className="w-32 px-2 py-1 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700 text-sm"
                value={mrr}
                onChange={(e)=>setMrr(e.target.value)}
                placeholder="Update MRR"
              />
              <button onClick={saveMrr} className="px-3 py-1 rounded bg-brand-600 text-white text-xs">Save</button>
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-4">
          <div className="text-sm text-gray-500">ARR</div>
          <div className="text-2xl font-semibold">{arr != null ? `$${arr.toLocaleString()}` : '—'}</div>
        </div>
      </div>
    </div>
  );
}
