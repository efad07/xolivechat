import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, signInWithGoogle, logOut } from '../firebase';
import { useAuth } from './AuthContext';
import { LogIn, LogOut, Plus, Users } from 'lucide-react';
import { motion } from 'motion/react';

export default function Lobby() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [recentRooms, setRecentRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms: any[] = [];
      snapshot.forEach((doc) => {
        rooms.push({ id: doc.id, ...doc.data() });
      });
      setRecentRooms(rooms);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rooms');
    });
    return () => unsubscribe();
  }, [user]);

  const createRoom = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        hostId: user.uid,
        status: 'waiting',
        board: Array(9).fill(''),
        currentTurn: 'X',
        winner: '',
        size: 3,
        createdAt: serverTimestamp()
      });
      navigate(`/room/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'rooms');
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinId.trim()) {
      navigate(`/room/${joinId.trim()}`);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <h1 className="text-4xl font-bold text-indigo-600 mb-2">Tic-Tac-Toe</h1>
          <p className="text-slate-500 mb-8">Real-time multiplayer with chat & video</p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            <LogIn size={20} /> Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-bold text-indigo-600">Tic-Tac-Toe Lobby</h1>
            <p className="text-slate-500">Welcome, {user.displayName}</p>
          </div>
          <button
            onClick={logOut}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Plus className="text-indigo-500" /> Create Game</h2>
            <button
              onClick={createRoom}
              disabled={creating}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md shadow-indigo-200"
            >
              {creating ? 'Creating...' : 'Create New Room'}
            </button>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Or Join by ID</h3>
              <form onSubmit={joinRoom} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Room ID"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!joinId.trim()}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            </div>
          </motion.div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users className="text-indigo-500" /> Recent Rooms</h2>
            <div className="space-y-3">
              {recentRooms.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No recent rooms found.</p>
              ) : (
                recentRooms.map((room) => (
                  <div key={room.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/50 transition-colors">
                    <div>
                      <div className="font-medium text-slate-900">Room {room.id.slice(0, 6)}...</div>
                      <div className="text-sm text-slate-500 capitalize">Status: {room.status}</div>
                    </div>
                    <button
                      onClick={() => navigate(`/room/${room.id}`)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                    >
                      Join
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
