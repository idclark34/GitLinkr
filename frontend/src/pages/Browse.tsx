import { useEffect } from 'react';

import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext.tsx';
import MiniProfileCard from '../components/MiniProfileCard.tsx';
import { useState } from 'react';

export default function Browse() {
  const { user } = useAuth();
  const [company, setCompany] = useState('');
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  
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
      </div>
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
