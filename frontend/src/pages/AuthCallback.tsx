import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const BACKEND_URL = ((import.meta as any).env?.VITE_BACKEND_URL as string | undefined) || 'http://localhost:4000';

  useEffect(() => {
    const completeAuth = async () => {
      try {
        // Call backend to exchange code for token
        const res = await api.get(`/auth/github/callback${window.location.search}`);
        const { token, user } = res.data;
        // Update auth context immediately and persist
        setAuth(user, token);
        // Accept invitation if present
        const params = new URLSearchParams(window.location.search);
        const invite = localStorage.getItem('pending_invite') || params.get('invite');
        if (invite) {
          try { await api.post('/api/invitations/accept', { code: invite, acceptor: user.login }); } catch {}
          localStorage.removeItem('pending_invite');
        }
        // Optionally kick off LinkedIn connect during onboarding
        const enableLinkedIn = ((import.meta as any).env?.VITE_ENABLE_LINKEDIN_ONBOARD as string | undefined) === 'true';
        const alreadyLinked = !!localStorage.getItem('li_profile');
        if (enableLinkedIn && !alreadyLinked) {
          // Frontend will handle /auth/linkedin/callback and then route to profile
          window.location.href = `${BACKEND_URL}/auth/linkedin`;
          return;
        }
        // If first-time user, send to onboarding; else to profile
        try {
          const supabase = (await import('../supabase.ts')).default as any;
          const { data: existing } = await supabase
            .from('custom_profiles')
            .select('github_login')
            .eq('github_login', user.login)
            .maybeSingle();
          if (!existing) {
            navigate('/onboarding/profile', { replace: true });
            return;
          }
        } catch {}
        navigate(`/profile/${user.login}`, { replace: true });
      } catch (err) {
        /* eslint-disable no-console */
        console.error('OAuth exchange failed', err);
        navigate('/login', { replace: true });
      }
    };
    completeAuth();
  }, [navigate]);

  return <p className="p-8">Signing you in…</p>;
}
