import React, { useState, useEffect } from 'react';
import { Mail, Eye, EyeOff, Loader2, Chrome, Apple, Mail as MailIcon, LogOut, User as UserIcon } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthModalProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        onAuthSuccess(currentUser);
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, [onAuthSuccess]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Apple sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new OAuthProvider('microsoft.com');
      provider.setCustomParameters({
        prompt: 'consent'
      });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || 'Microsoft sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Sign out failed');
    }
  };

  // If user is logged in, show user profile with logout option
  if (user) {
    return (
      <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="w-full max-w-md mx-auto px-4">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 space-y-6">

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <UserIcon size={32} className="text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white">Welcome Back!</h2>
              <p className="text-sm text-zinc-400">You're signed in to PC_X_ULTRA</p>
            </div>

            {/* User Info */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MailIcon size={14} className="text-blue-400" />
                <span className="text-xs text-zinc-400">Email</span>
              </div>
              <p className="text-sm font-mono text-white break-all">{user.email}</p>

              {user.displayName && (
                <>
                  <div className="flex items-center gap-2 pt-3">
                    <UserIcon size={14} className="text-purple-400" />
                    <span className="text-xs text-zinc-400">Display Name</span>
                  </div>
                  <p className="text-sm text-white">{user.displayName}</p>
                </>
              )}

              <div className="flex items-center gap-2 pt-3">
                <span className="text-xs text-zinc-400">Signed In Via</span>
              </div>
              <p className="text-sm text-blue-400">
                {user.providerData[0]?.providerId === 'google.com' && 'Google'}
                {user.providerData[0]?.providerId === 'apple.com' && 'Apple'}
                {user.providerData[0]?.providerId === 'microsoft.com' && 'Microsoft'}
                {user.providerData[0]?.providerId === 'password' && 'Email & Password'}
              </p>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>

            {/* Launch Desktop Button */}
            <button
              onClick={() => {}} // This will be handled by parent component
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-lg transition-all"
            >
              Enter PC_X_ULTRA
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-auto px-4">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-8 space-y-6">

          {/* Logo/Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                PC_X
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              PC_X_ULTRA
            </h1>
            <p className="text-sm text-zinc-400">Real additive ultimate build of the PC OS vision</p>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2 bg-zinc-950 p-1 rounded-lg">
            <button
              onClick={() => { setMode('signin'); setError(''); }}
              className={`flex-1 py-2 rounded font-semibold text-sm transition-all ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 rounded font-semibold text-sm transition-all ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full mt-2 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:border-blue-500 outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full mt-2 px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:border-blue-500 outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-zinc-700 disabled:to-zinc-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <MailIcon size={16} />}
              {loading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-800"></div>
            <span className="text-xs text-zinc-500">or continue with</span>
            <div className="flex-1 h-px bg-zinc-800"></div>
          </div>

          {/* Social Sign-In Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg flex items-center justify-center text-white transition-colors disabled:opacity-50"
              title="Sign in with Google"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Chrome size={16} />}
            </button>
            <button
              onClick={handleAppleSignIn}
              disabled={loading}
              className="py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg flex items-center justify-center text-white transition-colors disabled:opacity-50"
              title="Sign in with Apple"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Apple size={16} />}
            </button>
            <button
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg flex items-center justify-center text-white transition-colors disabled:opacity-50"
              title="Sign in with Microsoft"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : (
                <svg width="16" height="16" viewBox="0 0 23 23" fill="currentColor">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
                </svg>
              )}
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-zinc-500">
            By signing in, you agree to the PC_X_ULTRA Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
};
