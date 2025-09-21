import React from 'react';
import { useParams } from 'react-router-dom';
import useSWR from 'swr';
import api from '../api.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import RepoCard from '../components/RepoCard.tsx';
import { useMemo, useState, useEffect, useRef } from 'react';
import supabase from '../supabase.ts';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const BACKEND_URL = ((import.meta as any).env?.VITE_BACKEND_URL as string | undefined) || 'http://localhost:4000';

  const { data, error } = useSWR(() => `/api/profile/${username}`, (url) => api.get(url).then((r) => r.data));
  const { data: followers, mutate: refetchFollowers } = useSWR(username ? `/api/followers/${username}` : null, (url)=>api.get(url).then(r=>r.data));
  const { data: following, mutate: refetchFollowing } = useSWR(username ? `/api/following/${username}` : null, (url)=>api.get(url).then(r=>r.data));

  const liProfile = JSON.parse(localStorage.getItem('li_profile') || 'null');
  const ghMe = JSON.parse(localStorage.getItem('gh_user') || 'null');
  const [about, setAbout] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const defaultBio = "👋 Hi, I'm new on GitLinkr. Stay tuned!";
  const isMe = ghMe?.login === username;
  const [displayName, setDisplayName] = useState('');
  const [editNameMode, setEditNameMode] = useState(false);
  const [connectStatus, setConnectStatus] = useState<'none' | 'pending' | 'sent' | 'connected'>('none');
  const [liName, setLiName] = useState('');
  const [liHeadline, setLiHeadline] = useState('');
  const [liEmail, setLiEmail] = useState('');
  const deriveFromRaw = (raw: any): { company?: string; school?: string; title?: string; location?: string; skills?: string[]; companyLogo?: string; companyUrl?: string } => {
    try {
      if (!raw) return {};
      const exp = (raw.experiences || raw.experience || raw.positions || raw.jobs || []) as any[];
      const edu = (raw.education || raw.educations || []) as any[];
      const firstExp = Array.isArray(exp) ? exp.find((e)=> e && (e.company || e.companyName || e.title)) : undefined;
      const firstEdu = Array.isArray(edu) ? edu.find((e)=> e && (e.school || e.schoolName || e.organization)) : undefined;
      const company = (firstExp?.companyName || firstExp?.company || firstExp?.organization || undefined) as string | undefined;
      const school = (firstEdu?.schoolName || firstEdu?.school || firstEdu?.organization || undefined) as string | undefined;
      const title = (firstExp?.title || firstExp?.position || undefined) as string | undefined;
      const location = (raw?.locationName || raw?.location || firstExp?.location || undefined) as string | undefined;
      const skills = Array.isArray(raw?.skills) ? raw.skills.map((s:any)=> s?.name || s).filter(Boolean).slice(0,10) : undefined;
      const companyLogo = (firstExp?.companyLogo || firstExp?.company_logo || undefined) as string | undefined;
      const companyUrl = (firstExp?.companyUrl || firstExp?.company_url || undefined) as string | undefined;
      return { company, school, title, location, skills, companyLogo, companyUrl };
    } catch { return {}; }
  };

  // fetch my connections to guard button on load
  const { data: myConnections } = useSWR(ghMe ? `/api/connections/${ghMe.login}` : null, (url) => api.get(url).then(r=>r.data));

  useEffect(() => {
    if (!ghMe || !myConnections) return;
    const match = myConnections.find((c: any) =>
      (c.requester_github_login === ghMe.login && c.recipient_github_login === username) ||
      (c.recipient_github_login === ghMe.login && c.requester_github_login === username)
    );
    if (match) {
      if (match.status === 'accepted') setConnectStatus('connected');
      else if (match.status === 'pending' && match.requester_github_login === ghMe.login) setConnectStatus('sent');
      else if (match.status === 'pending') setConnectStatus('pending');
    }
  }, [ghMe, myConnections, username]);
  const { addToast } = useToast();


  useEffect(() => {
    if (!username) return;
    supabase
      .from('custom_profiles')
      .select('display_name, about')
      .eq('github_login', username)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name || '');
          setAbout(data.about || '');
        }
      });
    // Load LinkedIn profile (if stored server-side) into local cache
    supabase
      .from('linkedin_profiles')
      .select('name, headline, email, raw')
      .eq('github_login', username)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          localStorage.setItem('li_profile', JSON.stringify({
            name: data.name,
            headline: data.headline,
            email: data.email,
            raw: data.raw,
          }));
        }
      })
      .catch(()=>{});
  }, [username]);

  const saveAbout = (val: string) => {
    setAbout(val);
    if (!isMe) return;
    supabase.from('custom_profiles').upsert({ github_login: username, about: val }).then();
  };

  const sendConnect = async () => {
    if (!ghMe) return;
    try {
      setConnectStatus('pending');
      await api.post('/api/connections', {
        requester: ghMe.login,
        recipient: username,
        message: '',
      });
      setConnectStatus('sent');
      addToast('Connection request sent');
    } catch (err) {
      console.error(err);
      setConnectStatus('none');
      alert('Failed to send connection request');
    }
  };

  const saveProfile = () => {
    supabase.from('custom_profiles').upsert({
      github_login: username,
      display_name: displayName,
      about,
    }).then();
  };

  // Follow/unfollow
  const [isFollowing, setIsFollowing] = useState(false);
  useEffect(()=>{
    if (!ghMe || !followers) return;
    if (username === ghMe.login) return;
    // if I am in their followers list, I follow them
    setIsFollowing(followers.includes(ghMe.login));
  }, [ghMe, followers, username]);

  const toggleFollow = async () => {
    if (!ghMe || username === ghMe.login) return;
    try {
      if (isFollowing) {
        setIsFollowing(false);
        await api.delete('/api/follow', { data: { follower: ghMe.login, target: username } });
        addToast(`Unfollowed @${username}`);
      } else {
        setIsFollowing(true);
        await api.post('/api/follow', { follower: ghMe.login, target: username });
        addToast(`Following @${username}`);
      }
      refetchFollowers();
      refetchFollowing();
    } catch (e) {
      setIsFollowing((v)=>!v);
      console.error(e);
    }
  };

  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const createPost = async () => {
    if (!ghMe || !isMe || !postTitle.trim()) return;
    await api.post('/api/posts', {
      author: ghMe.login,
      title: postTitle.trim(),
      body: postBody.trim() || undefined,
      artifacts: [],
    });
    setPostTitle('');
    setPostBody('');
  };

  // Products UI state
  const [prodName, setProdName] = useState('');
  const [prodTagline, setProdTagline] = useState('');
  const [prodRepo, setProdRepo] = useState('');
  const [prodSite, setProdSite] = useState('');
  const [prodMrr, setProdMrr] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [prodError, setProdError] = useState<string | null>(null);
  const repoPickerRef = useRef<HTMLDivElement | null>(null);

  // Close repo picker when clicking anywhere outside the picker container
  useEffect(() => {
    if (!showRepoPicker) return;
    const handler = (e: MouseEvent) => {
      const el = repoPickerRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setShowRepoPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRepoPicker]);
  const { data: myProducts, mutate: refetchProducts } = useSWR(username ? `/api/products?owner=${username}` : null, (url)=>api.get(url).then(r=>r.data));
  const createProduct = async () => {
    if (!isMe) return;
    if (!prodName.trim()) { addToast('Please enter a product name'); return; }
    setCreatingProduct(true);
    setProdError(null);
    try {
      await api.post('/api/products', {
        owner: username,
        name: prodName.trim(),
        tagline: prodTagline.trim() || undefined,
        repo_url: prodRepo.trim() || undefined,
        website: prodSite.trim() || undefined,
        mrr_usd: prodMrr ? Number(prodMrr) : null,
      });
      setProdName(''); setProdTagline(''); setProdRepo(''); setProdSite(''); setProdMrr('');
      await refetchProducts();
      addToast('Product created');
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'Failed to create product';
      setProdError(msg);
      addToast(msg);
    } finally {
      setCreatingProduct(false);
    }
  };

  const [mrrInputs, setMrrInputs] = useState<Record<string, string>>({});
  const [editingMrrId, setEditingMrrId] = useState<string | null>(null);
  const handleMrrChange = (id: string, value: string) => {
    setMrrInputs((prev) => ({ ...prev, [id]: value }));
  };
  const saveMrr = async (id: string) => {
    const val = mrrInputs[id];
    const num = val === '' || val == null ? null : Number(val);
    await api.post(`/api/products/${id}/revenue/manual`, { mrr_usd: num });
    await refetchProducts();
    setEditingMrrId(null);
  };
  const removeProduct = async (id: string) => {
    await api.delete(`/api/products/${id}`);
    await refetchProducts();
  };

  // Compute top languages
  const topLanguages = useMemo(() => {
    if (!data?.repos) return [] as string[];
    const counts: Record<string, number> = {};
    data.repos.forEach((r: any) => {
      if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);
  }, [data]);

  if (error) return <p className="p-8">Failed to load profile</p>;
  if (!data) return <p className="p-8">Loading...</p>;

  const { user, repos } = data;


  return (
    <div className="max-w-6xl mx-auto p-8 grid gap-8 md:grid-cols-12">
      {/* Sidebar */}
      {/* Hero header full-width */}
      <section className="col-span-12 bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6 mb-8 shadow">
        <img
          src={user.avatar_url}
          alt="avatar"
          className="w-28 h-28 rounded-full border-4 border-brand-500"
        />
        <div className="flex-1 text-center sm:text-left space-y-2">
          <h2 className="text-3xl font-semibold flex items-center gap-2">
            {isMe && editNameMode ? (
              <input
                className="bg-transparent border-b border-gray-400 focus:border-brand-500 outline-none text-3xl font-semibold"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveProfile();
                    setEditNameMode(false);
                    e.preventDefault();
                  }
                }}
                onBlur={() => {
                  saveProfile();
                  setEditNameMode(false);
                }}
                autoFocus
              />
            ) : (
              <>
                {displayName || user.name || user.login}
                {isMe && (
                  <button onClick={() => setEditNameMode(true)} className="text-gray-400 hover:text-brand-500 text-sm">
                    ✏️
                  </button>
                )}
              </>
            )}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">@{user.login}</p>
          {user.bio && <p className="max-w-prose mx-auto sm:mx-0">{user.bio}</p>}
          {user.location && (
            <p className="text-sm text-gray-500 dark:text-gray-400">📍 {user.location}</p>
          )}

                    {!isMe && connectStatus === 'none' && (
            <button
              onClick={sendConnect}
              className="mt-2 px-4 py-1 rounded border border-brand-600 text-brand-600"
            >
              Connect
            </button>
          )}
          {!isMe && connectStatus === 'sent' && (
            <span className="mt-2 px-4 py-1 rounded border border-gray-500 text-gray-500">Pending</span>
          )}
          {!isMe && connectStatus === 'connected' && (
            <span className="mt-2 px-4 py-1 rounded border border-green-600 text-green-600">Connected</span>
          )}

          {/* Follow counts and action */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{followers?.length || 0} followers</span>
            <span>•</span>
            <span>{following?.length || 0} following</span>
            {!isMe && (
              <button onClick={toggleFollow} className={`ml-2 px-3 py-1 rounded border text-xs ${isFollowing ? 'border-gray-500 text-gray-500' : 'border-brand-600 text-brand-600'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Editable About section */}
          {isMe ? (
            editMode ? (
              <div className="space-y-2 mt-3">
                <textarea
                  className="w-full bg-gray-800/40 dark:bg-gray-700/40 border border-gray-600 rounded p-2 text-sm"
                  rows={3}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      saveAbout(about);
                      setEditMode(false);
                    }}
                    className="bg-brand-500 hover:bg-brand-600 px-3 py-1 rounded text-white text-sm"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditMode(false)} className="text-sm text-gray-400">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 mt-3">
                <p className="text-sm italic text-gray-300">{about || defaultBio}</p>
                <button onClick={() => setEditMode(true)} className="text-xs text-brand-500 hover:underline">
                  Edit bio
                </button>
              </div>
            )
          ) : (
            (about || defaultBio) && <p className="mt-3 text-sm italic text-gray-300">{about || defaultBio}</p>
          )}
          {(liProfile?.headline || data?.linkedin?.headline) && (
            <p className="text-sm italic text-blue-500 dark:text-blue-400">{liProfile?.headline || data?.linkedin?.headline}</p>
          )}
          {/* Company / School / Title / Location (from enriched LinkedIn raw) */}
          {(()=>{ const raw = liProfile?.raw; const d = deriveFromRaw(raw); return (d.company || d.school || d.title || d.location) ? (
            <div className="text-sm text-gray-600 dark:text-gray-300 flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {d.companyLogo && <img src={d.companyLogo} alt="logo" className="w-4 h-4 rounded" />}
                {d.companyUrl ? <a href={d.companyUrl} target="_blank" rel="noreferrer" className="hover:underline">{d.company}</a> : <span>{d.company}</span>}
                {d.school && <span>• {d.school}</span>}
              </div>
              {(d.title || d.location) && <div>{[d.title, d.location].filter(Boolean).join(' • ')}</div>}
            </div>
          ) : null; })()}

          {/* Language badges */}
          {topLanguages.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-2">
              {topLanguages.map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-0.5 rounded-full text-xs bg-brand-500/10 text-brand-500 dark:bg-brand-500/20"
                >
                  {lang}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* LinkedIn connect banner or badge */}
      {!liProfile && isMe && (
        <div className='col-span-12 space-y-3'>
          <a href={`${BACKEND_URL}/auth/linkedin`} className='block bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg text-center shadow transition'>
            Connect LinkedIn (official)
          </a>
          <div className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
            <h3 className='font-semibold mb-2'>Or add LinkedIn details manually</h3>
            <div className='grid sm:grid-cols-3 gap-2'>
              <input value={liName} onChange={(e)=>setLiName(e.target.value)} placeholder='Full name' className='px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700' />
              <input value={liHeadline} onChange={(e)=>setLiHeadline(e.target.value)} placeholder='Headline (e.g., Staff Engineer @ Company)' className='px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700' />
              <input value={liEmail} onChange={(e)=>setLiEmail(e.target.value)} placeholder='Email (optional)' className='px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700' />
            </div>
            <button
              onClick={async ()=>{ 
                const payload = { name: liName || undefined, headline: liHeadline || undefined, email: liEmail || undefined } as any;
                localStorage.setItem('li_profile', JSON.stringify(payload)); 
                if (username) {
                  try { await supabase.from('linkedin_profiles').upsert({ github_login: username, ...payload }); } catch {}
                }
                window.location.reload();
              }}
              className='mt-3 px-4 py-2 rounded bg-brand-600 text-white'>
              Save to profile
            </button>
          </div>
        </div>
      )}
      {liProfile && (
        <div className='col-span-12 flex flex-wrap items-center gap-3 text-blue-600'>
          <a href='https://www.linkedin.com' target='_blank' rel='noopener noreferrer' className='flex items-center gap-1 hover:underline'>
            <svg className='w-4 h-4 fill-current' viewBox='0 0 448 512'><path d='M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.42 0 53.77 0 24.07 24.09 0 53.79 0c29.49 0 53.78 24.07 53.78 53.77 0 29.65-24.29 54.33-53.78 54.33zM447.9 448h-92.68V302.4c0-34.7-.7-79.29-48.38-79.29-48.4 0-55.9 37.8-55.9 76.8V448h-92.7V148.9h88.9v40.8h1.3c12.4-23.5 42.6-48.3 87.7-48.3 93.8 0 111.1 61.7 111.1 141.9V448z'/></svg>
            <span>LinkedIn connected as {liProfile.name}</span>
          </a>
          {liProfile.email && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(liProfile.email);
              }}
              className='text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded'>
              Copy email
            </button>
          )}
          {isMe && (
            <button
              onClick={async ()=>{
                const url = prompt('Paste your public LinkedIn profile URL');
                if (!url) return;
                try {
                  const res = await fetch(`${BACKEND_URL}/api/linkedin/profile?url=${encodeURIComponent(url)}`);
                  if (!res.ok) throw new Error(await res.text());
                  const data = await res.json();
                  const current = JSON.parse(localStorage.getItem('li_profile') || 'null') || {};
                  const merged = { ...current, raw: data, profile_url: url };
                  localStorage.setItem('li_profile', JSON.stringify(merged));
                  if (username) {
                    try { await supabase.from('linkedin_profiles').upsert({ github_login: username, raw: data, profile_url: url }); } catch {}
                  }
                  window.location.reload();
                } catch (e) {
                  console.error(e);
                  alert('Failed to enrich from LinkedIn');
                }
              }}
              className='text-xs border border-blue-600 text-blue-600 px-2 py-1 rounded'>
              Enrich from LinkedIn
            </button>
          )}
          {isMe && (
            <button
              onClick={async ()=>{ localStorage.removeItem('li_profile'); if (username) { try { await supabase.from('linkedin_profiles').delete().eq('github_login', username); } catch {} } window.location.reload(); }}
              className='text-xs border border-gray-400 text-gray-600 dark:text-gray-300 px-2 py-1 rounded'>
              Remove
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <section className="md:col-span-12 space-y-6">
        {isMe && (
          <div className="flex gap-2">
            <button onClick={()=>setShowComposer((v)=>!v)} className="px-3 py-1 rounded border border-gray-400 text-sm">
              {showComposer ? 'Close update' : 'Write update'}
            </button>
            <button onClick={()=>setShowAddProduct((v)=>!v)} className="px-3 py-1 rounded border border-gray-400 text-sm">
              {showAddProduct ? 'Close add product' : 'Add product'}
            </button>
          </div>
        )}

        {isMe && showAddProduct && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold">Add a product</h3>
            <div className="grid sm:grid-cols-2 gap-2">
              <input value={prodName} onChange={(e)=>setProdName(e.target.value)} placeholder="Name" className="px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700" />
              <input value={prodTagline} onChange={(e)=>setProdTagline(e.target.value)} placeholder="Tagline" className="px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700" />
              <div className="relative" ref={repoPickerRef}>
                <input
                  value={prodRepo}
                  onChange={(e)=>setProdRepo(e.target.value)}
                  onFocus={()=>setShowRepoPicker(true)}
                  onBlur={()=>{
                    // Close only if focus moved outside the picker container
                    setTimeout(()=>{
                      const el = document.activeElement as HTMLElement | null;
                      if (repoPickerRef.current && el && repoPickerRef.current.contains(el)) return;
                      setShowRepoPicker(false);
                    }, 0);
                  }}
                  placeholder="Repo URL (optional)"
                  className="w-full px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700"
                />
                {showRepoPicker && (
                  <RepoPicker
                    username={username!}
                    query={prodRepo}
                    onSelect={(fullName: string, htmlUrl: string)=> { setProdRepo(htmlUrl); setShowRepoPicker(false); }}
                  />
                )}
              </div>
              <input value={prodSite} onChange={(e)=>setProdSite(e.target.value)} placeholder="Website (optional)" className="px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700" />
              <input value={prodMrr} onChange={(e)=>setProdMrr(e.target.value)} placeholder="MRR USD (optional)" className="px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700" />
            </div>
            {prodError && <div className="text-sm text-red-500">{prodError}</div>}
            <button disabled={creatingProduct} onClick={createProduct} className="px-4 py-1 rounded bg-brand-600 text-white disabled:opacity-50">{creatingProduct ? 'Creating…' : 'Create product'}</button>
          </div>
        )}
        {myProducts && myProducts.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-2">Products</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {myProducts.map((p:any)=>(
                <div key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 hover:shadow flex flex-col gap-2">
                  <a href={`/product/${p.id}`} className="block">
                    <div className="font-medium">{p.name}</div>
                    {p.tagline && <div className="text-sm text-gray-500 dark:text-gray-400">{p.tagline}</div>}
                    <div className="text-sm mt-1">MRR {p.mrr_usd != null ? `$${Number(p.mrr_usd).toLocaleString()}` : '—'}</div>
                  </a>
                  {isMe && (
                    <div className="flex items-center gap-2 pt-1">
                      {editingMrrId === p.id ? (
                        <>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="Update MRR"
                            className="w-28 px-2 py-1 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700 text-sm"
                            value={mrrInputs[p.id] ?? (p.mrr_usd ?? '')}
                            onChange={(e)=>handleMrrChange(p.id, e.target.value)}
                            autoFocus
                          />
                          <button onClick={()=>saveMrr(p.id)} className="px-3 py-1 rounded bg-brand-600 text-white text-xs">Save</button>
                          <button onClick={()=>{ setEditingMrrId(null); setMrrInputs((prev)=>({ ...prev, [p.id]: String(p.mrr_usd ?? '') })); }} className="px-3 py-1 rounded border text-xs">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={()=>{ setEditingMrrId(p.id); setMrrInputs((prev)=>({ ...prev, [p.id]: String(p.mrr_usd ?? '') })); }} className="px-3 py-1 rounded border text-xs">Edit</button>
                          <button onClick={()=>removeProduct(p.id)} className="px-3 py-1 rounded border border-red-600 text-red-600 text-xs">Delete</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {isMe && showComposer && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold">Share what you worked on</h3>
            <input value={postTitle} onChange={(e)=>setPostTitle(e.target.value)} placeholder="Title (e.g., Shipped v1.2 cache layer)" className="w-full px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700" />
            <textarea value={postBody} onChange={(e)=>setPostBody(e.target.value)} rows={3} placeholder="Details, links…" className="w-full px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700" />
            <button onClick={createPost} className="px-4 py-1 rounded bg-brand-600 text-white">Post</button>
          </div>
        )}
        <h3 className="text-xl font-semibold">Top Repositories</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {[...repos].sort((a:any,b:any)=>b.stargazers_count - a.stargazers_count).slice(0,6).map((repo: any) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      </section>
    </div>
  );
}

function RepoPicker({ username, onSelect, query }: { username: string; onSelect: (fullName: string, htmlUrl: string) => void; query?: string }) {
  const [q, setQ] = useState(query || '');
  const { data } = useSWR(username ? `/api/github/repos/${username}` : null, (url)=>api.get(url).then(r=>r.data));
  const repos = Array.isArray(data) ? data : [];
  const filtered = useMemo(()=>{
    const term = q.trim().toLowerCase();
    if (!term) return repos.slice(0, 10);
    return repos.filter((r:any)=> (r.full_name||'').toLowerCase().includes(term)).slice(0, 10);
  }, [q, repos]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  return (
    <div className="mt-2" ref={containerRef}>
      <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search your repos…" className="w-full px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700" autoFocus />
      {filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 shadow-lg divide-y divide-gray-200 dark:divide-gray-700">
          {filtered.map((r:any)=> (
            <button type="button" key={r.id} onMouseDown={(e)=>e.preventDefault()} onClick={()=>onSelect(r.full_name, r.html_url)} className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="font-medium">{r.full_name}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">{r.language || '—'} • ⭐{r.stargazers_count} • 🍴{r.forks_count}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedInImport({ backendUrl, onImported }: { backendUrl: string; onImported: (profile: any)=>void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importProfile = async () => {
    setError(null);
    const clean = url.trim();
    if (!clean) { setError('Paste your LinkedIn profile URL'); return; }
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/linkedin/profile?url=${encodeURIComponent(clean)}`);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Failed');
      }
      const data = await res.json();
      // Normalize a minimal shape for FE usage
      const normalized = {
        name: data?.full_name || data?.name || data?.personal_info?.full_name || undefined,
        headline: data?.headline || data?.personal_info?.headline || undefined,
        email: data?.email || (Array.isArray(data?.contact_info?.emails) ? data.contact_info.emails[0] : undefined),
        raw: data,
      };
      onImported(normalized);
    } catch (e: any) {
      setError(e?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
      <h3 className='font-semibold mb-2'>Import LinkedIn profile</h3>
      <div className='flex gap-2'>
        <input
          value={url}
          onChange={(e)=>setUrl(e.target.value)}
          placeholder='https://www.linkedin.com/in/your-handle'
          className='flex-1 px-3 py-2 rounded bg-gray-900/10 dark:bg-gray-900/30 border border-gray-300 dark:border-gray-700'
        />
        <button onClick={importProfile} disabled={loading} className='px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50'>
          {loading ? 'Importing…' : 'Import'}
        </button>
      </div>
      {error && <div className='text-sm text-red-500 mt-2'>{error}</div>}
      <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>We use a RapidAPI provider to import public profile info.</p>
    </div>
  );
}
