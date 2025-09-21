import { useEffect } from 'react';

import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext.tsx';
import MiniProfileCard from '../components/MiniProfileCard.tsx';
import { useState } from 'react';
import api from '../api.ts';

export default function Browse() {
  const { user } = useAuth();
  const [company, setCompany] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [liStatus, setLiStatus] = useState<string>('');
  const [liItems, setLiItems] = useState<any[] | null>(null);
  
  // Build query parameters properly
  const buildQueryKey = () => {
    if (!user) return null;
    
    const params = new URLSearchParams();
    const hasCompany = !!company.trim();
    const hasLangs = selectedLangs.length > 0 && selectedLangs.some((l) => l.trim());

    if (hasCompany && !hasLangs) {
      // Use dedicated company search endpoint
      return `/api/search/company?name=${encodeURIComponent(company.trim())}`;
    }

    if (hasCompany) params.append('company', company.trim());
    if (hasLangs) params.append('langs', selectedLangs.filter((l) => l.trim()).join(','));

    const queryString = params.toString();
    return `/api/recommendations/${user.login}${queryString ? `?${queryString}` : ''}`;
  };
  
  const queryKey = buildQueryKey();
  const { data, error } = useSWR(queryKey, (url) =>
    import('../api.ts').then((m) => m.default.get(url).then((r) => r.data)),
  );

  // fetch my connections to guard buttons
  const { data: myConnections } = useSWR(user ? `/api/connections/${user.login}` : null, (url) =>
    import('../api.ts').then((m) => m.default.get(url).then((r) => r.data)),
  );

useEffect(() => {
    document.title = 'Browse | GitLinkr';
  }, []);

  const runPeopleSearch = async () => {
    try {
      setLiItems(null);
      setLiStatus('loading');
      const body: any = {
        keywords: keywords.trim() || undefined,
        location: location.trim() || undefined,
        company: company.trim() || undefined,
        title: title.trim() || undefined,
        lang: selectedLangs[0] || undefined,
        maxResults: 10,
        wait: true,
      };
      const res = await api.post('/api/people/search', body);
      const status: string = res.data?.linkedin?.status || '';
      const items: any[] = res.data?.linkedin?.items || [];
      setLiStatus(status || (items?.length ? 'SUCCEEDED' : ''));
      setLiItems(items);
    } catch (e) {
      console.error(e);
      setLiStatus('error');
      setLiItems([]);
    }
  };

  if (!user) return <p className="p-8">Sign in to see recommendations</p>;
  if (error) return <p className="p-8">Failed to load recommendations</p>;
  
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">People you may like</h1>
      <div className='flex flex-wrap gap-4 items-center'>
        <input
          type='text'
          placeholder='Filter by company (e.g., microsoft)'
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className='px-3 py-1 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-900/50 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600'
        />
        <input
          type='text'
          placeholder='Languages csv (JavaScript,Python)'
          value={selectedLangs.join(',')}
          onChange={(e) => setSelectedLangs(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          className='px-3 py-1 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-900/50 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600'
        />
        <input
          type='text'
          placeholder='Keywords (e.g., AI infra)'
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className='px-3 py-1 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-900/50 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600'
        />
        <input
          type='text'
          placeholder='Location (e.g., United States)'
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className='px-3 py-1 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-900/50 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600'
        />
        <input
          type='text'
          placeholder='Title (e.g., Software Engineer)'
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className='px-3 py-1 rounded-md bg-white text-gray-900 placeholder-gray-500 border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-900/50 dark:text-gray-100 dark:placeholder-gray-400 dark:border-gray-600'
        />
        <button
          onClick={runPeopleSearch}
          className='px-3 py-1 rounded-md bg-brand-600 text-white hover:bg-brand-700 transition'
        >
          Search
        </button>
      </div>
      {liStatus && (
        <div className='text-sm text-gray-600 dark:text-gray-300'>
          {liStatus === 'loading' && 'Searching LinkedIn…'}
          {liStatus === 'SUCCEEDED' && (liItems?.length ? `Found ${liItems.length} LinkedIn profiles` : 'No LinkedIn profiles found')}
          {liStatus === 'POLL_TIMEOUT' && 'Still processing… try again in a moment'}
          {liStatus === 'STARTED' && 'Search started… results will appear shortly'}
          {liStatus === 'error' && 'Search failed'}
        </div>
      )}
      {liItems && liItems.length > 0 && (
        <div className='space-y-2'>
          <h2 className='text-xl font-semibold'>LinkedIn results</h2>
          <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {liItems.slice(0, 18).map((p: any, idx: number) => {
              const bi = p?.basic_info || {};
              const name = bi.fullname || p.fullName || p.name || p.profileName;
              const headline = bi.headline || p.headline;
              const comp = bi.current_company || p.company || p.companyName;
              const loc = bi?.location?.full || p.location;
              const url = bi.profile_url || p.linkedinUrl || p.profileUrl || p.url;
              return (
                <a key={idx} href={url} target='_blank' rel='noreferrer' className='block p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow'>
                  <p className='font-medium'>{name || 'Unknown'}</p>
                  {headline && <p className='text-xs text-gray-500'>{headline}</p>}
                  <div className='text-xs text-gray-400'>{[comp, loc].filter(Boolean).join(' • ')}</div>
                </a>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data ? data.map((dev: any) => {
            let initialStatus: 'none' | 'pending' | 'sent' | 'connected' = 'none';
            if (myConnections) {
              const match = myConnections.find((c: any) =>
                (c.requester_github_login === user.login && c.recipient_github_login === dev.login) ||
                (c.recipient_github_login === user.login && c.requester_github_login === dev.login)
              );
              if (match) {
                if (match.status === 'accepted') initialStatus = 'connected';
                else if (match.status === 'pending' && match.requester_github_login === user.login) initialStatus = 'sent';
                else if (match.status === 'pending') initialStatus = 'pending'; // incoming
              }
            }
            return <MiniProfileCard key={dev.login} {...dev} initialStatus={initialStatus} />;
          }) : 'Loading...'}
      </div>
    </div>
  );
}
