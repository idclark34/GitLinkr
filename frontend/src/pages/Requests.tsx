import { useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api.ts';

export default function Requests() {
  const { user } = useAuth();
  const { data, mutate } = useSWR(user ? `/api/connections/${user.login}/pending` : null, (url) =>
    api.get(url).then((r) => r.data),
  );

  useEffect(() => {
    document.title = 'Requests | GitLinkr';
  }, []);

  if (!user) return <p className="p-8">Sign in to view requests</p>;
  if (!data) return <p className="p-8">Loading…</p>;

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center mt-24 text-center gap-4">
        <img src="/empty-requests.svg" alt="no requests" className="w-40 opacity-60" />
        <p className="text-gray-500 dark:text-gray-400">No pending requests — keep networking!</p>
      </div>
    );
  }

  const handleAction = async (id: number, status: 'accepted' | 'declined') => {
    try {
      await api.put(`/api/connections/${id}`, { status, username: user.login });
      mutate();
    } catch (err) {
      console.error(err);
      alert('Failed to update');
    }
  };

  return (
    <div className="p-8 space-y-4 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Connection Requests</h1>
      {data.map((req: any) => (
        <div
          key={req.id}
          className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg shadow-sm"
        >
          {/* Avatar */}
          <img
            src={`https://github.com/${req.requester_github_login}.png?size=64`}
            alt={req.requester_github_login}
            className="w-12 h-12 rounded-full border"
          />

          {/* Details */}
          <div className="flex-1 min-w-0">
            <a
              href={`/profile/${req.requester_github_login}`}
              className="font-medium hover:underline truncate"
            >
              {req.requester_github_login}
            </a>
            {req.message && (
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{req.message}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(req.created_at).toLocaleDateString()}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleAction(req.id, 'accepted')}
              className="px-3 py-1 text-sm rounded border border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-colors"
            >
              Accept
            </button>
            <button
              onClick={() => handleAction(req.id, 'declined')}
              className="px-3 py-1 text-sm rounded border border-gray-500 text-gray-500 hover:bg-gray-600 hover:text-white transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
