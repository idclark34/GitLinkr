import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Gracefully degrade if env vars are not provided (avoid crashing the SPA)
function createNoopSupabase() {
  const noop = () => {};
  const channelObj = {
    on: (_e?: any, _f?: any, _h?: any) => channelObj,
    subscribe: () => ({ unsubscribe: noop }),
  } as any;
  return {
    channel: (_name: string) => channelObj,
    removeChannel: (_ch: any) => {},
  } as any;
}

const supabase = supabaseUrl && supabaseAnon
  ? createClient(supabaseUrl, supabaseAnon)
  : createNoopSupabase();

if (!supabaseUrl || !supabaseAnon) {
  // eslint-disable-next-line no-console
  console.warn('Supabase disabled: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable realtime.');
}

export default supabase;

