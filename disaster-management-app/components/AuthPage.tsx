

import React, { useState } from 'react';
import { supabase } from '../App';
import { Button, Input, Icon } from './ui';

type AuthView = 'login' | 'register';

const AuthFooter: React.FC = () => (
    <footer className="text-center p-4 mt-6 text-slate-700 text-xs w-full max-w-md">
        <div className="flex justify-center items-center space-x-6 mb-4">
            <img
                src="https://www.supranet.net/wp-content/uploads/2019/04/SNWebSOC-Service-Org_B_Marks_2c_Web.png"
                alt="SOC 2 Certified"
                className="h-12 opacity-90 mix-blend-multiply"
                title="SOC 2 Certified Backend"
                onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://placehold.co/120x48/e2e8f0/64748b?text=SOC+2'; }}
            />
            <img
                src="https://aibc.com.ph/storage/corporate_governance_file/NPC-SOR-2026.JPG"
                alt="National Privacy Commission"
                className="h-12 opacity-90 mix-blend-multiply"
                title="National Privacy Commission Compliant"
                onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://placehold.co/120x48/e2e8f0/64748b?text=NPC'; }}
            />
            <img
                src="https://supabase.com/docs/img/supabase-logo-wordmark--dark.svg"
                alt="Powered by Supabase"
                className="h-8 opacity-80"
                title="Powered by Supabase"
                onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = 'https://placehold.co/120x32/e2e8f0/64748b?text=Supabase'; }}
            />
        </div>
        <div className="flex justify-center items-center space-x-2 mb-2">
            <Icon name="fa-shield-alt" />
            <span>Compliant with RA 10173 (DPA) & GDPR Principles</span>
        </div>
        <div className="space-x-4">
            <a href="#" className="hover:underline">Trust & Safety</a>
            <span>&bull;</span>
            <a href="#" className="hover:underline">Privacy Policy</a>
            <span>&bull;</span>
            <a href="#" className="hover:underline">Terms of Service</a>
        </div>
    </footer>
);

const AuthPage: React.FC = () => {
    const [view, setView] = useState<AuthView>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setIsLoading(false);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setIsLoading(true);
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
            setError(error.message);
        } else {
            setMessage('Registration successful! Please check your email to verify your account.');
            setView('login');
        }
        setIsLoading(false);
    };
    
    const getHeader = () => {
        if (view === 'login') return { title: 'Disaster Management Portal', subtitle: 'Please sign in to continue' };
        if (view === 'register') return { title: 'Create Account', subtitle: 'Create a new account to get started' };
        return { title: '', subtitle: '' };
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md">
                <div className="bg-white/20 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/30">
                    <div className="text-center mb-8">
                        <img src="https://picsum.photos/seed/lgu/96/96" alt="LGU Logo" className="mx-auto mb-4 h-24 w-24 rounded-full bg-gray-200/50 border-2 border-white/50" />
                        <h1 className="text-2xl font-semibold text-slate-900">{getHeader().title}</h1>
                        <p className="text-slate-800">{getHeader().subtitle}</p>
                    </div>

                    {error && <div className="mb-4 bg-red-300/50 text-red-900 px-4 py-3 rounded-lg text-sm border border-red-400/50">{error}</div>}
                    {message && <div className="mb-4 bg-blue-300/50 text-blue-900 px-4 py-3 rounded-lg text-sm border border-blue-400/50">{message}</div>}

                    {view === 'login' ? (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <Input label="Email Address" type="email" id="login-email" value={email} onChange={e => setEmail(e.target.value)} required />
                            <Input label="Password" type="password" id="login-password" value={password} onChange={e => setPassword(e.target.value)} required />
                            <Button type="submit" className="w-full" isLoading={isLoading}>Sign In</Button>
                            <div className="text-center">
                                <button type="button" onClick={() => setView('register')} className="text-sm text-blue-800 hover:text-blue-900 font-medium">
                                    Don't have an account? Sign Up
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-6">
                            <Input label="Email Address" type="email" id="register-email" value={email} onChange={e => setEmail(e.target.value)} required />
                            <Input label="Password" type="password" id="register-password" value={password} onChange={e => setPassword(e.target.value)} required />
                            <Button type="submit" className="w-full" isLoading={isLoading}>Sign Up</Button>
                            <div className="text-center">
                                <button type="button" onClick={() => setView('login')} className="text-sm text-blue-800 hover:text-blue-900 font-medium">
                                    Already have an account? Sign In
                                </button>
                            </div>
                        </form>
                    )}
                </div>
                <AuthFooter />
            </div>
        </div>
    );
};

export default AuthPage;