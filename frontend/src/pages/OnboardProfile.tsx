import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase.ts';

export default function OnboardProfile() {
  const navigate = useNavigate();
  const ghUser = JSON.parse(localStorage.getItem('gh_user') || 'null');
  const [displayName, setDisplayName] = useState('');
  const [about, setAbout] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = 'Onboarding | GitLinkr';
    if (!ghUser) navigate('/login');
  }, [ghUser, navigate]);

  const save = async () => {
    if (!ghUser) return;
    setSaving(true);
    try {
      await supabase.from('custom_profiles').upsert({ github_login: ghUser.login, display_name: displayName || null, about: about || null });
      navigate(`/profile/${ghUser.login}`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Set up your GitLinkr profile</h1>
      <div className="space-y-3">
        <label className="block text-sm">Display name</label>
        <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2 rounded border dark:bg-gray-900/40" />
        <label className="block text-sm mt-4">Bio</label>
        <textarea value={about} onChange={(e)=>setAbout(e.target.value)} rows={4} placeholder="Tell people about yourself" className="w-full px-3 py-2 rounded border dark:bg-gray-900/40" />
        <button onClick={save} disabled={saving} className="mt-4 px-4 py-2 rounded bg-brand-600 text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save and continue'}
        </button>
      </div>
    </div>
  );
}
