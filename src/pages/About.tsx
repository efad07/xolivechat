import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Gamepad2, Video, Users, Zap, Shield, Globe } from 'lucide-react';

export default function About() {
  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 overflow-y-auto">
      
      {/* SEO Helmet */}
      <Helmet>
        <title>About Us | Tic Tac Toe Video Game Platform | XoliveChat</title>
        <meta
          name="description"
          content="Learn about our modern Tic Tac Toe platform with real-time video calling. Play 3x3, 4x4, or 5x5 games and connect with players worldwide."
        />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-12 pb-16">

        {/* Header */}
        <section className="text-center space-y-4 pt-8">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-cyan-900/30 rounded-2xl border border-cyan-500/30 shadow-lg">
              <Gamepad2 className="w-16 h-16 text-cyan-400" />
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            About Our Tic Tac Toe Video Game Platform
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
            A modern way to enjoy Tic Tac Toe with real-time video interaction and global matchmaking.
          </p>
        </section>

        {/* Introduction */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-10 shadow">
          <h2 className="text-2xl font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Globe className="text-cyan-400 w-5 h-5" />
            Introduction
          </h2>

          <p className="text-slate-300 leading-relaxed mb-3">
            Tic Tac Toe is one of the most popular classic games in the world. Traditionally played on paper, it has entertained people for generations with its simple yet strategic gameplay.
          </p>

          <p className="text-slate-300 leading-relaxed">
            Our platform transforms this classic game into a real-time interactive experience. Players can now see and talk to each other through live video while playing, creating a more engaging and social gaming environment.
          </p>
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-6">How It Works</h2>

          <div className="grid md:grid-cols-2 gap-6">

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <Users className="mb-3 text-blue-400" />
              <h3 className="font-bold mb-2">Create & Join Rooms</h3>
              <p className="text-slate-400">
                Generate a room code and invite friends to play instantly.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <Globe className="mb-3 text-red-400" />
              <h3 className="font-bold mb-2">Random Match</h3>
              <p className="text-slate-400">
                Get connected with random players from around the world.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <Video className="mb-3 text-green-400" />
              <h3 className="font-bold mb-2">Live Video Call</h3>
              <p className="text-slate-400">
                Talk face-to-face while playing using real-time video.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <Gamepad2 className="mb-3 text-purple-400" />
              <h3 className="font-bold mb-2">Play Together</h3>
              <p className="text-slate-400">
                Enjoy smooth and synchronized gameplay with no delays.
              </p>
            </div>

          </div>
        </section>

        {/* Features */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-10 text-center">
          <h2 className="text-2xl font-bold mb-6">Features</h2>

          <div className="flex flex-wrap justify-center gap-3 text-sm md:text-base">
            <span className="px-3 py-1 bg-slate-800 rounded">Video Calling</span>
            <span className="px-3 py-1 bg-slate-800 rounded">Multiplayer</span>
            <span className="px-3 py-1 bg-slate-800 rounded">3x3 Mode</span>
            <span className="px-3 py-1 bg-slate-800 rounded">4x4 Mode</span>
            <span className="px-3 py-1 bg-slate-800 rounded">5x5 Mode</span>
          </div>
        </section>

        {/* Why Choose Us */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-6">
            <Shield className="inline mr-2 text-yellow-400" />
            Why Choose Us
          </h2>

          <div className="grid md:grid-cols-3 gap-6 text-center">

            <div>
              <h4 className="font-bold">Interactive</h4>
              <p className="text-slate-400 text-sm">
                Play with real people using live video.
              </p>
            </div>

            <div>
              <h4 className="font-bold">No Download</h4>
              <p className="text-slate-400 text-sm">
                Play directly in your browser.
              </p>
            </div>

            <div>
              <h4 className="font-bold">Fast & Secure</h4>
              <p className="text-slate-400 text-sm">
                Reliable and smooth experience.
              </p>
            </div>

          </div>
        </section>

        {/* Mission */}
        <section className="text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-slate-300">
            Our mission is to connect people through simple and fun games. We aim to make online interaction more engaging by combining gaming with real-time communication.
          </p>
        </section>

      </div>
    </div>
  );
}