import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api.ts';

export default function Invite() {
  const { user } = useAuth();
  const [emails, setEmails] = useState('');
  const [usernames, setUsernames] = useState('');

  useEffect(() => {
    document.title = 'Invite | GitLinkr';
  }, []);

  const { data, mutate } = useSWR(user ? `/api/invitations/mine?inviter=${user.login}` : null, (url) =>
    api.get(url).then((r) => r.data),
  );

  // GitHub contacts (followers + following)
  const { data: contacts } = useSWR(user ? '/api/github/contacts' : null, (url) =>
    api.get(url).then((r) => r.data),
  );

  const createInvites = async () => {
    if (!user) return;
    const emailsArr = emails.split(',').map((s) => s.trim()).filter(Boolean);
    const ghArr = usernames.split(',').map((s) => s.trim()).filter(Boolean);
    await api.post('/api/invitations/create', {
      inviter: user.login,
      emails: emailsArr,
      githubUsernames: ghArr,
    });
    setEmails('');
    setUsernames('');
    mutate();
  };

  const inviteGithubUser = async (login: string) => {
    if (!user) return;
    try {
      const res = await api.post('/api/invitations/create', {
        inviter: user.login,
        githubUsernames: [login],
      });
      const link = res.data?.[0]?.link;
      if (link && navigator?.clipboard) {
        await navigator.clipboard.writeText(link);
      }
      mutate();
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) return <p className="p-8">Sign in to invite people</p>;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Invite people</h1>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">Emails (comma separated)</label>
          <input value={emails} onChange={(e) => setEmails(e.target.value)} className="px-3 py-2 rounded bg-gray-900/20 dark:bg-gray-900/40 border border-gray-300 dark:border-gray-700" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-500 dark:text-gray-400">GitHub usernames (comma separated)</label>
          <input value={usernames} onChange={(e) => setUsernames(e.target.value)} className="px-3 py-2 rounded bg-gray-900/20 dark:bg-gray-900/40 border border-gray-300 dark:border-gray-700" />
        </div>
        <button onClick={createInvites} className="mt-2 px-4 py-2 rounded bg-brand-600 text-white hover:opacity-90">Create invites</button>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Your invites</h2>
        {!data ? (
          <p>Loading…</p>
        ) : data.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">You haven’t sent any invites yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.map((inv: any) => (
              <li key={inv.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
                <div className="text-sm">
                  <div className="font-medium">
                    {inv.invitee_email || `@${inv.invitee_github_login}`}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">{inv.status}</div>
                </div>
                <input
                  readOnly
                  value={inv.link}
                  className="w-64 px-2 py-1 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700 text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* GitHub Contacts */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Your GitHub contacts</h2>
        {!contacts ? (
          <p>Loading contacts…</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from(
              new Map(
                ([...(contacts.followers || []), ...(contacts.following || [])] as any[]).map((u: any) => [u.login, u]),
              ).values(),
            ).map((u: any) => (
              <div key={u.id || u.login} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={u.avatar_url} alt={u.login} className="w-8 h-8 rounded-full" />
                  <a href={`https://github.com/${u.login}`} target="_blank" rel="noreferrer" className="font-medium hover:underline truncate">
                    {u.login}
                  </a>
                </div>
                <button onClick={() => inviteGithubUser(u.login)} className="px-3 py-1 text-sm rounded border border-brand-600 text-brand-600 hover:bg-brand-600 hover:text-white transition-colors">
                  Invite
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
