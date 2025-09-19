import React, { createContext, useContext, useEffect, useState } from 'react';

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name?: string;
  bio?: string;
  location?: string;
}

interface AuthState {
  user: GitHubUser | null;
  token: string | null;
  setAuth: (user: GitHubUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Load from localStorage once on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('gh_token');
    const storedUser = localStorage.getItem('gh_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const setAuth = (newUser: GitHubUser, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem('gh_token', newToken);
    localStorage.setItem('gh_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
