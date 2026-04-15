import React from 'react';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto p-8 text-slate-300">
      <h1 className="text-4xl font-bold text-cyan-400 mb-6">Terms & Conditions</h1>
      <div className="space-y-6 text-lg leading-relaxed">
        <p>
          By accessing or using TicTacToe Online, you agree to be bound by these Terms & Conditions.
        </p>
        <section>
          <h2 className="text-2xl font-semibold text-slate-100 mb-3">1. Acceptable Use</h2>
          <p>
            This platform is designed for entertainment purposes. You agree to behave respectfully towards other players. Harassment, hate speech, spamming, or any form of abuse in the chat or video calls is strictly prohibited and may result in an immediate ban.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-slate-100 mb-3">2. Account Responsibility</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account. We are not liable for any loss or damage arising from your failure to protect your account credentials.
          </p>
        </section>
        <section>
          <h2 className="text-2xl font-semibold text-slate-100 mb-3">3. Service Availability</h2>
          <p>
            While we strive to provide a seamless experience, we do not guarantee that the service will be uninterrupted, secure, or error-free. We reserve the right to modify or discontinue the service at any time without notice.
          </p>
        </section>
      </div>
    </div>
  );
}
