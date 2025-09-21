import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.ts';
import supabase from '../supabase.ts';

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
        const profile = data.profile;
        localStorage.setItem('li_profile', JSON.stringify(profile));
        const ghUser = JSON.parse(localStorage.getItem('gh_user') || 'null');
        // Persist to Supabase if we know the GitHub login
        if (ghUser?.login) {
          try {
            await supabase.from('linkedin_profiles').upsert({
              github_login: ghUser.login,
              name: profile?.name || [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') || null,
              headline: profile?.headline || null,
              email: profile?.email || null,
              raw: profile || null,
            });
            // Auto-enrich: if we stored a profile_url before, try to fetch raw details and persist
            try {
              const existing = JSON.parse(localStorage.getItem('li_profile') || 'null');
              const url = existing?.profile_url || null;
              const backendUrl = ((import.meta as any).env?.VITE_BACKEND_URL as string | undefined) || 'http://localhost:4000';
              if (url) {
                const res = await fetch(`${backendUrl}/api/linkedin/profile?url=${encodeURIComponent(url)}`);
                if (res.ok) {
                  const raw = await res.json();
                  await supabase.from('linkedin_profiles').upsert({ github_login: ghUser.login, raw, profile_url: url });
                  localStorage.setItem('li_profile', JSON.stringify({ ...profile, raw, profile_url: url }));
                }
              }
            } catch {}
            // Opportunistically hydrate custom profile from LinkedIn on first link
            const { data: existing } = await supabase
              .from('custom_profiles')
              .select('display_name, about')
              .eq('github_login', ghUser.login)
              .maybeSingle();
            const updates: any = {};
            const nameFromLi = profile?.name || [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') || '';
            if ((!existing || !existing.display_name) && nameFromLi) updates.display_name = nameFromLi;
            if ((!existing || !existing.about) && (profile?.headline || '')) updates.about = profile.headline;
            if (Object.keys(updates).length > 0) {
              await supabase.from('custom_profiles').upsert({ github_login: ghUser.login, ...updates });
            }
          } catch {}
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

