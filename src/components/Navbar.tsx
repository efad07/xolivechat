import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { signInWithGoogle, logOut } from '../firebase';
import { LogIn, LogOut, Gamepad2 } from 'lucide-react';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-lg px-4 py-3 flex justify-between items-center">
      <Link to="/" className="flex items-center gap-2 text-xl font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
        <Gamepad2 size={24} />
        <span>TicTacToe</span>
      </Link>

      <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
        <Link to="/" className="hover:text-cyan-400 transition-colors">Home</Link>
        <Link to="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
        <Link to="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link>
        <Link to="/contact" className="hover:text-cyan-400 transition-colors">Contact</Link>
      </div>

      <div>
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-200">{user.displayName}</span>
                {user.isPremium && <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Premium</span>}
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full border-2 border-cyan-500/30" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-cyan-900/50 flex items-center justify-center text-cyan-400 font-bold border-2 border-cyan-500/30">
                  {user.displayName?.charAt(0) || 'U'}
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
          <button
            onClick={signInWithGoogle}
            className="flex items-center gap-2 bg-slate-100 text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white transition-colors shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            <span className="hidden sm:block">Sign in with Google</span>
          </button>
        )}
      </div>
    </nav>
  );
}
