import React from 'react';
import { Mail, MessageSquare } from 'lucide-react';

export default function Contact() {
  return (
    <div className="max-w-4xl mx-auto p-8 text-slate-300">
      <h1 className="text-4xl font-bold text-cyan-400 mb-6">Contact Us</h1>
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
        <p className="text-lg mb-8">
          Have a question, feedback, or need support? We'd love to hear from you! Please reach out to us using the email below.
        </p>
        
        <div className="flex items-center gap-4 mb-8 p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div className="bg-cyan-500/20 p-4 rounded-full text-cyan-400">
            <Mail size={32} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Email Support</h3>
            <a href="mailto:efadsani5540@gmail.com" className="text-2xl font-bold text-slate-100 hover:text-cyan-400 transition-colors">
              efadsani5540@gmail.com
            </a>
          </div>
        </div>

        <div className="flex items-center gap-4 p-6 bg-slate-800/50 rounded-2xl border border-slate-700">
          <div className="bg-fuchsia-500/20 p-4 rounded-full text-fuchsia-400">
            <MessageSquare size={32} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Response Time</h3>
            <p className="text-lg text-slate-100">
              We typically respond within 24-48 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
