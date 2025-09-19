import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.ts';

export default function LinkedInCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await api.get(`/auth/linkedin/callback?code=${code}`);
        localStorage.setItem('li_profile', JSON.stringify(data.profile));
        // Redirect to logged-in user's profile (assumes gh_user stored)
        const ghUser = JSON.parse(localStorage.getItem('gh_user') || 'null');
        if (ghUser?.login) {
          navigate(`/profile/${ghUser.login}`, { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      } catch (err) {
        /* eslint-disable no-console */
        console.error('LinkedIn callback error', err);
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  return <p className="p-8">Linking your LinkedIn account...</p>;
}

