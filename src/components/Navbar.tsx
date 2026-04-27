import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { signUp, login } from '../firebase';
import { LogIn, LogOut, Gamepad2, UserPlus } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Navbar() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = () => signUp(email, password);
  const handleLogin = () => login(email, password);
  
  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-lg px-4 py-3 flex justify-between items-center">
      <Link to="/" className="flex items-center gap-2 text-xl font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
        <Gamepad2 size={24} />
        <span>TicTacToe</span>
      </Link>

      <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-300">
        <Link to="/" className="hover:text-cyan-400 transition-colors">Home</Link>
        <Link to="/about" className="hover:text-cyan-400 transition-colors">About Us</Link>
        <Link to="/webrtc" className="text-blue-400 hover:text-blue-300 transition-colors font-bold">QuickConnect</Link>
        <Link to="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
        <Link to="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link>
        <Link to="/contact" className="hover:text-cyan-400 transition-colors">Contact</Link>
      </div>

      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-200">{user.displayName || user.email?.split('@')[0]}</span>
                {user.isPremium && <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Premium</span>}
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full border-2 border-cyan-500/30" referrerPolicy="no-referrer" loading="lazy" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-cyan-900/50 flex items-center justify-center text-cyan-400 font-bold border-2 border-cyan-500/30 uppercase">
                  {(user.displayName || user.email || 'U').charAt(0)}
                </div>
              )}
            </div>
            <button
              onClick={logOut}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors px-3 py-1.5 rounded-lg font-medium"
              title="Sign Out"
            >
              <LogOut size={18} /> <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input 
              id="email" 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-3 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-md text-sm outline-none focus:border-cyan-500 w-28 sm:w-40"
            />
            <input 
              id="password" 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="px-3 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-md text-sm outline-none focus:border-cyan-500 w-28 sm:w-40"
            />
            <button
              onClick={handleLogin}
              className="hidden sm:flex items-center gap-1 bg-slate-700 text-slate-200 px-3 py-1 rounded-md text-sm font-semibold hover:bg-slate-600 transition-colors"
            >
              <LogIn size={16} /> Login
            </button>
            <button
              onClick={handleSignup}
              className="flex items-center gap-1 bg-cyan-600 text-white px-3 py-1 rounded-md text-sm font-semibold hover:bg-cyan-500 transition-colors"
            >
              <UserPlus size={16} /> <span className="hidden sm:block">Sign Up</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
