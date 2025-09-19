import { Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login.tsx';
import Profile from './pages/Profile.tsx';
import Browse from './pages/Browse.tsx';
import Requests from './pages/Requests.tsx';
import AuthCallback from './pages/AuthCallback.tsx';
import NavBar from './components/NavBar.tsx';
import { useAuth } from './contexts/AuthContext.tsx';
import LinkedInCallback from './pages/LinkedInCallback.tsx';
import Invite from './pages/Invite.tsx';
import Feed from './pages/Feed.tsx';
import Product from './pages/Product.tsx';
import OnboardProduct from './pages/OnboardProduct.tsx';
import Trending from './pages/Trending.tsx';

export default function App() {
  const { user } = useAuth();
  return (
    <>
      {user && <NavBar />}
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/github/callback" element={<AuthCallback />} />
      <Route path="/auth/linkedin/callback" element={<LinkedInCallback />} />
      <Route path="/profile/:username" element={<Profile />} />
      <Route path="/browse" element={<Browse />} />
      <Route path="/invite" element={<Invite />} />
      <Route path="/feed" element={<Feed />} />
      <Route path="/product/:id" element={<Product />} />
      <Route path="/onboarding/product" element={<OnboardProduct />} />
      <Route path="/requests" element={<Requests />} />
      <Route path="/trending" element={<Trending />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}
