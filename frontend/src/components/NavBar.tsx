import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import supabase from '../supabase.ts';
import { useToast } from '../contexts/ToastContext.tsx';

export default function NavBar() {
  // ensure correct initial theme on mount (honor localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const [isDark, setIsDark] = useState(() =>
    typeof window !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  );
  const navigate = useNavigate();

  // fetch pending count
  const { data: pending, mutate } = useSWR(`/api/connections/${user.login}/pending`, (url) =>
    import('../api.ts').then((m) => m.default.get(url).then((r) => r.data)),
  );
  const pendingCount = pending?.length || 0;

  // realtime subscriptions: connection requests + followed activity
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('realtime-events')
      // connection requests
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connections',
          filter: `recipient_github_login=eq.${user.login}`,
        },
        (payload) => {
          mutate(`/api/connections/${user.login}/pending`);
          addToast(`${payload.new.requester_github_login} sent you a connection request`);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connections',
          filter: `recipient_github_login=eq.${user.login}`,
        },
        (payload) => {
          mutate(`/api/connections/${user.login}/pending`);
          if (payload.new.status === 'accepted') {
            addToast(`You accepted ${payload.new.requester_github_login}`);
          } else if (payload.new.status === 'declined') {
            addToast(`You declined ${payload.new.requester_github_login}`);
          }
        },
      )
      // followed users' posts
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          try {
            const following = await import('../api.ts').then((m) => m.default.get(`/api/following/${user.login}`).then((r)=>r.data));
            if (Array.isArray(following) && following.includes(payload.new.author_github_login)) {
              addToast(`@${payload.new.author_github_login} posted: ${payload.new.title}`);
            }
          } catch (e) { /* no-op */ }
        },
      )
      // followed users' product updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
        },
        async (payload) => {
          try {
            const following = await import('../api.ts').then((m) => m.default.get(`/api/following/${user.login}`).then((r)=>r.data));
            if (Array.isArray(following) && following.includes(payload.new.owner_github_login)) {
              addToast(`@${payload.new.owner_github_login} updated ${payload.new.name}`);
            }
          } catch (e) { /* no-op */ }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;

  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="w-full border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto flex items-center justify-between p-4">
        <Link to={`/profile/${user.login}`} className="font-bold text-brand-500 text-lg">
          GitLinkr
        </Link>
        <div className="flex items-center gap-6 ml-auto">
          <Link to='/feed' className='text-sm hover:text-brand-500 transition-colors'>Feed</Link>
          <Link to='/browse' className='text-sm hover:text-brand-500 transition-colors'>Browse</Link>
          <Link to='/invite' className='text-sm hover:text-brand-500 transition-colors'>Invite</Link>
          <Link to='/trending' className='text-sm hover:text-brand-500 transition-colors'>Trending</Link>
          <Link to='/requests' className='relative inline-flex items-center pr-4 text-sm hover:text-brand-500 transition-colors'>
            Requests
            {pendingCount > 0 && (
              <span className='absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-600 text-white text-[10px] leading-none flex items-center justify-center border border-white dark:border-gray-900 shadow-sm'>
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-4 ml-4">
          <button onClick={toggleTheme} className="text-gray-500 hover:text-brand-500 transition-colors">
            {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>
          <img src={user.avatar_url} alt="avatar" className="w-8 h-8 rounded-full" />
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-brand-500 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
