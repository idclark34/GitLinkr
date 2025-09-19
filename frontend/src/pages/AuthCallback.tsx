import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

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
        // Redirect to profile page
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
