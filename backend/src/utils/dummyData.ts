/**
 * Lightweight dummy responses to allow FE development without hitting GitHub API.
 * Toggle via USE_DUMMY_DATA=true in .env
 */

import type { RequestHandler } from 'express';

export type DummyAuthResponse = {
  token: string;
  user: any;
  repos: any[];
};

const user = {
  login: 'octocat',
  name: 'The Octocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
  bio: 'Living out my days in test fixtures 🐙',
  location: 'Internet',
};

const repos = [
  {
    id: 1,
    name: 'Hello-World',
    stargazers_count: 1500,
    forks_count: 300,
    language: 'JavaScript',
    html_url: 'https://github.com/octocat/Hello-World',
    description: 'My first repository on GitHub!',
  },
  {
    id: 2,
    name: 'Spoon-Knife',
    stargazers_count: 800,
    forks_count: 120,
    language: 'HTML',
    html_url: 'https://github.com/octocat/Spoon-Knife',
    description: 'This repo is for demonstration purposes only.',
  },
];

export default {
  authResponse: { token: 'dummy-access-token', user, repos } as DummyAuthResponse,
  profileResponse: { user, repos },
};
