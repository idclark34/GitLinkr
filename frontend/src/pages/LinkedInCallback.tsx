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
        const ghUser = JSON.parse(localStorage.getItem('gh_user') || 'null');
        const fallbackName = profile?.name || [profile?.given_name, profile?.family_name].filter(Boolean).join(' ') || '';
        const vanity = profile?.vanityName || profile?.preferred_username || '';

        // Attempt enrichment via Apify for richer fields
        let enriched: any = null;
        try {
          const enrichRes = await api.post('/api/people/enrich', {
            name: fallbackName || undefined,
            vanity: vanity || undefined,
            location: 'United States',
            maxResults: 5,
          });
          const items: any[] = enrichRes.data?.items || [];
          const norm = (s: string) => String(s || '').toLowerCase().trim();
          const target = norm(fallbackName);
          enriched =
            items.find((it:any)=> norm(it?.basic_info?.fullname) === target) ||
            items.find((it:any)=> norm(it?.basic_info?.fullname).startsWith(target.split(' ')[0]||'')) ||
            items[0] || null;
        } catch {}

        // Compose final profile payload for FE cache
        const bi = enriched?.basic_info || {};
        const finalProfile = {
          name: bi.fullname || fallbackName || null,
          headline: bi.headline || profile?.headline || null,
          email: profile?.email || null,
          profile_url: bi.profile_url || null,
          raw: enriched || profile || null,
        } as any;
        localStorage.setItem('li_profile', JSON.stringify(finalProfile));

        // Persist to Supabase if we know the GitHub login
        if (ghUser?.login) {
          try {
            await supabase.from('linkedin_profiles').upsert({
              github_login: ghUser.login,
              name: finalProfile.name,
              headline: finalProfile.headline,
              email: finalProfile.email,
              profile_url: finalProfile.profile_url,
              raw: finalProfile.raw,
            });
            // Hydrate custom_profiles if missing
            const { data: existing } = await supabase
              .from('custom_profiles')
              .select('display_name, about')
              .eq('github_login', ghUser.login)
              .maybeSingle();
            const updates: any = {};
            if ((!existing || !existing.display_name) && finalProfile.name) updates.display_name = finalProfile.name;
            if ((!existing || !existing.about) && finalProfile.headline) updates.about = finalProfile.headline;
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

