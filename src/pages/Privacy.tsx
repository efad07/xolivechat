import React from 'react';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto p-8 text-slate-300">
      <h1 className="text-4xl font-bold text-cyan-400 mb-6">Privacy Policy</h1>
      <div className="space-y-6 text-lg leading-relaxed">
        <p>
          Welcome to TicTacToe Online. We value your privacy and are committed to protecting your personal data.
        </p>
        <section>
          <h2 className="text-2xl font-semibold text-slate-100 mb-3">1. Information We Collect</h2>
          <p>
            When you use our platform, we may collect basic profile information provided by Google Authentication (such as your name, email address, and profile picture) to create and manage your account. We also store gameplay data, chat messages within game rooms, and WebRTC signaling data to facilitate real-time multiplayer features.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-slate-100 mb-3">2. How We Use Your Information</h2>
          <p>
            Your information is used solely to provide, maintain, and improve the game experience. This includes syncing game states, enabling chat, and connecting video calls. We use Firebase backend services to securely store and process this data.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-slate-100 mb-3">3. Data Sharing</h2>
          <p>
            We do <strong>not</strong> sell, rent, or share your personal data with third parties for marketing purposes. Chat messages and video streams are only shared with the specific users in your active game room.
          </p>
        </section>
      </div>
    </div>
  );
}
