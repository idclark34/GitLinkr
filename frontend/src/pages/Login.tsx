import React from 'react';

// GitHub OAuth start URL - backend will redirect to consent screen
const BACKEND_URL = ((import.meta as any).env?.VITE_BACKEND_URL as string | undefined) || 'http://localhost:4000';
const GITHUB_AUTH_URL = BACKEND_URL + '/auth/github';

/**
 * Landing / Login page
 * ------------------------------------------------------------------
 * Responsive hero section + value-prop list + a static profile preview card.
 * Tailwind classes keep it vertically centered on mobile and split 2-cols on md+.
 * Dark-mode variants included where useful.
 */
export default function Login() {
  // Theme toggle for public nav
  const toggleTheme = () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };
  // Set the tab title when mounted
  React.useEffect(() => {
    document.title = 'Login | GitLinkr';
  }, []);

  // If we hit /login?invite=CODE, stash it for after OAuth
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('invite');
    if (code) localStorage.setItem('pending_invite', code);
  }, []);

  return (
    <>
      {/* Public NavBar */}
      <header className="w-full border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md fixed top-0 z-20 text-gray-900 dark:text-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-4">
          <span className="font-bold text-lg">GitLinkr</span>
          <button
            onClick={toggleTheme}
            className="text-white/80 hover:text-white dark:hover:text-gray-200 transition-colors"
            aria-label="Toggle theme"
          >
            {/* simple moon/sun toggle based on prefers */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v1m0 16v1m8.66-12.66l-.71.71M4.05 19.95l-.7.71M21 12h-1M4 12H3m15.66 5.66l-.71-.71M4.05 4.05l-.7-.71M12 7a5 5 0 100 10 5 5 0 000-10z"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="pt-20 min-h-screen bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center py-12 px-6 md:px-10 text-gray-900 dark:text-gray-100">
      {/* Container */}
      <div className="max-w-6xl w-full grid gap-10 md:grid-cols-2 items-center animate-fade-in">
        {/* ---------- LEFT :: HERO + CTA ---------- */}
        <section className="space-y-6 md:pr-8 text-center md:text-left">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Build Your Developer Presence
          </h1>
          <p className="text-xl font-medium text-white/90 dark:text-gray-200">
            GitLinkr turns your GitHub into a living resume.
          </p>
          <p className="text-base text-white/80 dark:text-gray-300 max-w-lg mx-auto md:mx-0">
            Showcase your top repositories, highlight your tech stack, and connect with fellow
            builders — all automatically generated from your GitHub profile.
          </p>

          {/* GitHub Sign-in */}
          <a
            href={GITHUB_AUTH_URL + (new URLSearchParams(window.location.search).toString() ? ('?' + new URLSearchParams(window.location.search).toString()) : '')}
            className="inline-flex items-center justify-center gap-2 bg-black/90 hover:bg-black text-white px-5 py-3 rounded-md transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white w-fit mx-auto md:mx-0"
          >
            {/* GitHub Icon */}
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577v-2.02c-3.338.726-4.033-1.61-4.033-1.61-.546-1.387-1.333-1.757-1.333-1.757-1.09-.744.082-.729.082-.729 1.205.086 1.84 1.238 1.84 1.238 1.07 1.835 2.807 1.305 3.492.998.108-.775.418-1.306.76-1.606-2.665-.305-5.467-1.335-5.467-5.93 0-1.31.468-2.38 1.236-3.22-.124-.304-.536-1.527.117-3.176 0 0 1.008-.322 3.3 1.23a11.49 11.49 0 0 1 3.003-.404c1.02.004 2.05.138 3.003.404 2.29-1.552 3.297-1.23 3.297-1.23.654 1.649.243 2.872.12 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.479 5.922.43.37.823 1.096.823 2.21v3.285c0 .32.218.694.825.576C20.565 21.796 24 17.298 24 12c0-6.627-5.373-12-12-12Z" />
            </svg>
            <span className="font-semibold">Sign in with GitHub</span>
          </a>

          {/* Local quick start (no GitHub) */}
          <div className="text-sm text-white/90 dark:text-gray-200">
            <div className="mt-4">No GitHub? Start with a local account:</div>
            <form
              className="mt-2 flex gap-2 items-center"
              onSubmit={(e)=>{
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('username') as HTMLInputElement);
                const username = (input?.value || '').trim();
                if (!username) return;
                const user = { login: username, name: username } as any;
                localStorage.setItem('gh_user', JSON.stringify(user));
                // store a placeholder token so app considers user logged in but avoid Authorization header
                localStorage.setItem('gh_token', 'local_'+Math.random().toString(36).slice(2));
                window.location.href = '/feed';
              }}
            >
              <input name="username" placeholder="Choose a username" className="px-3 py-2 rounded-md text-gray-900" />
              <button type="submit" className="px-3 py-2 rounded-md bg-white/90 text-gray-900 font-medium">Continue</button>
            </form>
          </div>

          {/* Value propositions */}
          <ul className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-4 text-left justify-center md:justify-start">
            <li className="flex items-start gap-2 w-full sm:w-1/2">
              <span className="text-xl">✅</span>
              <span>Auto-build your portfolio from GitHub activity</span>
            </li>
            <li className="flex items-start gap-2 w-full sm:w-1/2">
              <span className="text-xl">🎯</span>
              <span>Get discovered by hiring teams and collaborators</span>
            </li>
            <li className="flex items-start gap-2 w-full sm:w-1/2">
              <span className="text-xl">🤝</span>
              <span>Match with developers by tech stack</span>
            </li>
          </ul>
        </section>

        {/* ---------- RIGHT :: PROFILE PREVIEW CARD ---------- */}
        <aside className="bg-white/80 dark:bg-gray-800/70 backdrop-blur-lg border border-white/30 dark:border-gray-700 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto animate-slide-up">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <img
              src="https://avatars.githubusercontent.com/u/583231?v=4"
              alt="placeholder avatar"
              className="w-16 h-16 rounded-full border-2 border-brand-500"
            />
            <div>
              <h3 className="text-lg font-semibold">octocat</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">San Francisco, CA</p>
            </div>
          </div>

          {/* Repo summary */}
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Hello-World</span>
              <span className="flex gap-4">
                <span className="flex items-center gap-1">
                  ⭐<span>1500</span>
                </span>
                <span className="flex items-center gap-1">
                  🍴<span>300</span>
                </span>
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">Spoon-Knife</span>
              <span className="flex gap-4">
                <span className="flex items-center gap-1">
                  ⭐<span>800</span>
                </span>
                <span className="flex items-center gap-1">
                  🍴<span>120</span>
                </span>
              </span>
            </div>
          </div>
        </aside>
      </div>
      </div>

      {/* Social proof / brands */}
      <section className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-10">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">Built for developers using tools you love</div>
          <div className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-6 opacity-80">
            {['React','TypeScript','Vite','Node.js','Supabase','OpenAI'].map((n)=> (
              <div key={n} className="text-center text-gray-500 dark:text-gray-400 text-sm border border-gray-200/60 dark:border-gray-700/60 rounded-md py-3">
                {n}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 text-center">Everything you need to build in public</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              {title:'AI summaries of your work',desc:'Readable one‑liners and narratives from PRs, commits, and issues.'},
              {title:'Developer networking',desc:'Follow, connect, and collaborate with builders by stack and company.'},
              {title:'Products & metrics',desc:'Showcase products, track MRR/ARR, and tie impact to releases.'},
              {title:'Curated inspiration',desc:'See activity from top maintainers to learn what great looks like.'},
              {title:'Invite your circle',desc:'Bring teammates or GitHub contacts in a click.'},
              {title:'Realtime updates',desc:'Requests, follows, and product changes appear instantly.'},
            ].map((f)=> (
              <div key={f.title} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-800/50 p-5">
                <div className="text-xl">✨</div>
                <h3 className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 text-center">How it works</h2>
          <ol className="mt-8 grid md:grid-cols-3 gap-6">
            {[{step:'Connect or create',desc:'Sign in with GitHub or pick a username to get started.'},{step:'Auto‑build profile',desc:'We import repos, follow graph, and recent activity.'},{step:'Share and grow',desc:'Post updates, track product metrics, and connect with peers.'}].map((s,i)=> (
              <li key={s.step} className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 p-5">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Step {i+1}</div>
                <div className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{s.step}</div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">{s.desc}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full mt-12 text-center text-white/80 dark:text-gray-400 text-sm py-6">
        © {new Date().getFullYear()} GitLinkr — Built with ❤️ for developers.{' '}
        <a
          href="https://github.com/your-org/your-repo"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white dark:hover:text-gray-200"
        >
          View on GitHub
        </a>
      </footer>
    </>
  );
}
