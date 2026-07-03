import React, { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn } from 'lucide-react';

export const AuthButton: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleSignIn = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Sign in error:', error);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Sign out error:', error);
        }
    };

    return (
        <div className="flex items-center gap-2">
            {user ? (
                <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-md text-sm hover:bg-zinc-700 text-white">
                    {user.photoURL && <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />}
                    Sign Out
                </button>
            ) : (
                <button onClick={handleSignIn} className="flex items-center gap-2 px-3 py-1 bg-indigo-600 rounded-md text-sm hover:bg-indigo-500 text-white">
                    <LogIn size={16} />
                    Sign In
                </button>
            )}
        </div>
    );
};
