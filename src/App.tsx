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
const WebRTCVideoCall = lazy(() => import('./pages/WebRTCVideoCall'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <Router>
          <Analytics />
          <Helmet>
            <title>Play Tic Tac Toe Online | Chat, Video Call & Multiplayer | XoliveChat</title>
            <meta name="description" content="Play Tic Tac Toe online with real players. Chat, video call, and compete globally on XoliveChat." />
            <meta name="keywords" content="tic tac toe online, multiplayer tic tac toe, play with friends, online game chat" />
            <link rel="canonical" href="https://xolivechat.com" />
          </Helmet>
          <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
            <Navbar />
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-cyan-500 animate-pulse">Loading...</div>}>
              <Routes>
                <Route path="/" element={<GameRoom />} />
                <Route path="/room/:roomId" element={<GameRoom />} />
                <Route path="/webrtc" element={<WebRTCVideoCall />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<About />} />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}


