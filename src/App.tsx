/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { AuthProvider } from './components/AuthContext';
import Navbar from './components/Navbar';
import Analytics from './components/Analytics';

const GameRoom = lazy(() => import('./components/GameRoom'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Contact = lazy(() => import('./pages/Contact'));

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <Router>
          <Analytics />
          <Helmet>
            <title>Play Tic Tac Toe Online | Multiplayer & Video Chat</title>
            <meta name="description" content="Play Tic Tac Toe online with friends in real-time. Features live chat, video calling, and multiplayer game rooms. Free to play!" />
            <meta name="keywords" content="tic tac toe online, multiplayer tic tac toe, play tic tac toe with friends, real-time game, video chat game" />
          </Helmet>
          <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
            <Navbar />
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-cyan-500 animate-pulse">Loading...</div>}>
              <Routes>
                <Route path="/" element={<GameRoom />} />
                <Route path="/room/:roomId" element={<GameRoom />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/contact" element={<Contact />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}


