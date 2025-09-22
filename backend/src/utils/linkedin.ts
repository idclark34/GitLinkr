import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI as string,
      client_id: process.env.LINKEDIN_CLIENT_ID as string,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET as string,
    }),
  });
  if (!res.ok) throw new Error('LinkedIn token exchange failed');
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function fetchLinkedInProfile(token: string): Promise<any> {
  // Fetch OpenID userinfo (name, email, picture)
  const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!userinfoRes.ok) throw new Error(`userinfo failed: ${await userinfoRes.text()}`);
  const userinfo = await userinfoRes.json();

  // Fetch headline from v2/me (requires r_liteprofile)
  const meRes = await fetch(
    'https://api.linkedin.com/v2/me?projection=(id,vanityName,localizedHeadline)',
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  let headline = undefined;
  let vanityName = undefined;
  let id = undefined;
  if (meRes.ok) {
    const me = (await meRes.json()) as any;
    headline = me?.localizedHeadline;
    vanityName = me?.vanityName;
    id = me?.id;
  }

  const ui: any = userinfo as any;
  return { ...(typeof ui === 'object' && ui ? ui : {}), headline, vanityName, id };
}
