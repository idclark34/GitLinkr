import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.tsx';
import api from '../api.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import supabase from '../supabase.ts';

interface Props {
  login: string;
  avatar_url: string;
  html_url: string;
  company?: string;
}

interface ExtraProps extends Props {
  initialStatus?: 'none' | 'pending' | 'sent' | 'connected';
}

export default function MiniProfileCard({ login, avatar_url, html_url, company, initialStatus = 'none' }: ExtraProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const isMe = user?.login === login;
  const [status, setStatus] = useState<'none' | 'pending' | 'sent' | 'connected'>(initialStatus);
  const [hasAccount, setHasAccount] = useState<boolean>(true);
  // update if parent passes updated status
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  // Determine if this GitHub user has a GitLinkr account (exists in custom_profiles)
  useEffect(() => {
    let active = true;
    supabase
      .from('custom_profiles')
      .select('github_login')
      .eq('github_login', login)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setHasAccount(!!data);
      })
      .catch(() => setHasAccount(false));
    return () => {
      active = false;
    };
  }, [login]);

  const sendRequest = async () => {
    if (!user) return;
    try {
      setStatus('pending');
      await api.post('/api/connections', {
        requester: user.login,
        recipient: login,
        message: '',
      });
      setStatus('sent');
      addToast('Connection request sent');
    } catch (err) {
      console.error(err);
      setStatus('none');
      alert('Failed to send connection request');
    }
  };

  const sendInvite = async () => {
    if (!user) return;
    try {
      const res = await api.post('/api/invitations/create', {
        inviter: user.login,
        githubUsernames: [login],
      });
      const link = res.data?.[0]?.link;
      if (link && navigator?.clipboard) await navigator.clipboard.writeText(link);
      addToast('Invite link copied');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow transition">
      <a href={`/profile/${login}`} className="flex items-center gap-3 flex-1">
        <img src={avatar_url} alt={login} className="w-10 h-10 rounded-full" />
        <div>
          <p className="font-medium">{login}</p>
          {company && (
            <p className="text-xs text-gray-400">{company}</p>
          )}
          <p
            className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {html_url}
          </p>
        </div>
      </a>
      {!isMe && status === 'none' && hasAccount && (
        <div className="flex gap-2">
          <button
            onClick={sendRequest}
            className="px-3 py-1 text-sm rounded border border-brand-600 text-brand-600"
          >
            Connect
          </button>
          <button
            onClick={sendInvite}
            className="px-3 py-1 text-sm rounded border border-gray-400 text-gray-600 dark:text-gray-300"
          >
            Invite
          </button>
        </div>
      )}
      {!isMe && status === 'none' && !hasAccount && (
        <button
          onClick={sendInvite}
          className="px-3 py-1 text-sm rounded border border-gray-400 text-gray-600 dark:text-gray-300"
        >
          Invite
        </button>
      )}
      {!isMe && status === 'sent' && (
        <span className="px-3 py-1 text-sm rounded border border-gray-500 text-gray-500">Pending</span>
      )}
      {!isMe && status === 'connected' && (
        <span className="px-3 py-1 text-sm rounded border border-green-600 text-green-600">Connected</span>
      )}
    </div>
  );
}