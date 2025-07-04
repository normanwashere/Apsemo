
import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, NavLink } from 'react-router-dom';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, LocationData } from './types';

import AuthPage from './components/AuthPage';
import DashboardPage from './components/DashboardPage';
import ResidentsPage from './components/ResidentsPage';
import EventsPage from './components/EventsPage';
import StatusUpdatePage from './components/StatusUpdatePage';
import IncidentsPage from './components/IncidentsPage';
import EvacCentersPage from './components/EvacCentersPage';
import UsersPage from './components/UsersPage';
import SettingsPage from './components/SettingsPage';
import { Icon, Toast, ConfirmationModal } from './components/ui';

const supabaseUrl = 'https://relgoefialnkgicedlxq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbGdvZWZpYWxua2dpY2VkbHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyOTMxNzksImV4cCI6MjA2Njg2OTE3OX0.UwEeU3wSPjsOvv8svcc2OgE88s06qlQ7oKsBPV3MMbg';
export const supabase = createClient(supabaseUrl, supabaseKey);

interface ToastState {
    message: string;
    type: 'success' | 'error';
}

interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

interface AppContextType {
    user: User | null;
    supabase: SupabaseClient;
    logout: () => void;
    isLoading: boolean;
    isOnline: boolean;
    locationData: LocationData;
    barangayToMunicipalityMap: { [barangay: string]: string };
    showToast: (message: string, type?: 'success' | 'error') => void;
    showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};

const navLinksConfig = {
    admin: [
        { name: 'Dashboard', path: '/', icon: 'fa-tachometer-alt' },
        { name: 'Events', path: '/events', icon: 'fa-bolt' },
        { name: 'Residents', path: '/residents', icon: 'fa-users' },
        { name: 'Status Update', path: '/update', icon: 'fa-qrcode' },
        { name: 'Incidents', path: '/incidents', icon: 'fa-exclamation-triangle' },
        { name: 'Evac Centers', path: '/evac-centers', icon: 'fa-hospital' },
        { name: 'Users', path: '/users', icon: 'fa-user-cog' },
        { name: 'Settings', path: '/settings', icon: 'fa-cog' },
    ],
    encoder: [
        { name: 'Dashboard', path: '/', icon: 'fa-tachometer-alt' },
        { name: 'Events', path: '/events', icon: 'fa-bolt' },
        { name: 'Residents', path: '/residents', icon: 'fa-users' },
        { name: 'Status Update', path: '/update', icon: 'fa-qrcode' },
        { name: 'Incidents', path: '/incidents', icon: 'fa-exclamation-triangle' },
        { name: 'Evac Centers', path: '/evac-centers', icon: 'fa-hospital' },
        { name: 'Settings', path: '/settings', icon: 'fa-cog' },
    ],
    viewer: [
        { name: 'Dashboard', path: '/', icon: 'fa-tachometer-alt' },
        { name: 'Events', path: '/events', icon: 'fa-bolt' },
        { name: 'Incidents', path: '/incidents', icon: 'fa-exclamation-triangle' },
        { name: 'Evac Centers', path: '/evac-centers', icon: 'fa-hospital' },
        { name: 'Settings', path: '/settings', icon: 'fa-cog' },
    ],
};

const Sidebar: React.FC = () => {
    const { user, logout, isOnline } = useApp();
    const navLinks = user ? navLinksConfig[user.role] : [];

    return (
        <aside className="bg-white/20 backdrop-blur-lg text-slate-800 w-64 p-4 flex-col fixed inset-y-0 left-0 transform -translate-x-full md:flex md:translate-x-0 transition-transform duration-300 ease-in-out z-30 border-r border-white/30">
            <div className="flex items-center mb-8 px-2">
                <Icon name="fa-shield-alt" className="text-3xl text-blue-800" />
                <h1 className="text-xl font-bold ml-3 text-slate-900">DM App</h1>
            </div>
            <nav className="space-y-1 flex-grow">
                {navLinks.map((link) => (
                    <NavLink
                        key={link.name}
                        to={link.path}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 p-3 rounded-lg text-slate-800 hover:bg-white/30 transition-colors duration-200 ${
                            isActive ? 'bg-blue-200/50 text-blue-900 font-semibold border-l-4 border-blue-600 pl-2' : ''
                            }`
                        }
                    >
                        <Icon name={link.icon} className="w-5 text-center fa-fw" />
                        <span className="font-medium">{link.name}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="mt-auto">
                <div className={`text-xs font-medium text-center p-2 rounded-lg mb-2 ${isOnline ? 'bg-green-300/50 text-green-900' : 'bg-red-300/50 text-red-900'}`}>
                    <Icon name={isOnline ? 'fa-check-circle' : 'fa-plane-slash'} className="mr-2" />
                    {isOnline ? 'Online' : 'Offline'}
                </div>
                <button onClick={logout} className="w-full text-left flex items-center space-x-3 p-3 rounded-lg text-slate-800 hover:bg-white/30 transition-colors duration-200">
                    <Icon name="fa-sign-out-alt" className="fa-fw" />
                    <span className="font-medium">Logout</span>
                </button>
            </div>
        </aside>
    );
};

const BottomNav: React.FC = () => {
    const { user } = useApp();
    const navLinks = user ? navLinksConfig[user.role] : [];
    
    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/20 backdrop-blur-lg flex items-stretch z-20 border-t border-white/20 overflow-x-auto">
            {navLinks.map((link) => (
                <NavLink
                    key={link.name}
                    to={link.path}
                    className={({ isActive }) =>
                        `flex-1 flex flex-col items-center justify-center p-2 text-slate-800 hover:bg-white/20 transition-colors text-center min-w-[75px] ${
                        isActive ? 'text-blue-800 bg-blue-500/10' : ''
                        }`
                    }
                >
                    <Icon name={link.icon} className="text-xl" />
                    <span className="text-xs font-medium mt-1 leading-tight break-words">{link.name}</span>
                </NavLink>
            ))}
        </nav>
    );
};


const AppContent: React.FC = () => {
    const { user, isLoading } = useApp();

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center">
            <Icon name="fa-spinner" className="fa-spin text-blue-600 text-4xl" />
        </div>;
    }

    if (!user) {
        return <AuthPage />;
    }

    return (
        <div className="relative min-h-screen">
            <Sidebar />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto md:ml-64 pb-28 md:pb-6">
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/residents" element={<ResidentsPage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/update" element={<StatusUpdatePage />} />
                    <Route path="/incidents" element={<IncidentsPage />} />
                    <Route path="/evac-centers" element={<EvacCentersPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Routes>
            </main>
            <BottomNav />
        </div>
    );
};

const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [locationData, setLocationData] = useState<LocationData>({});
    const [toast, setToast] = useState<ToastState | null>(null);
    const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const navigate = useNavigate();

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    }, []);

    // Handle online/offline status changes
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const fetchLocationData = useCallback(async () => {
        const { data, error } = await supabase.from('barangays').select('municipality, barangay');
        if (error) {
            console.error("Location data fetch error:", error);
            showToast("Failed to load location data.", "error");
            return;
        }
        const reducedData = data.reduce((acc, curr) => {
            const { municipality, barangay } = curr;
            if (!acc[municipality]) {
                acc[municipality] = [];
            }
            if (!acc[municipality].includes(barangay)) {
                acc[municipality].push(barangay);
            }
            return acc;
        }, {} as LocationData);
        setLocationData(reducedData);
    }, [showToast]);

    const barangayToMunicipalityMap = useMemo(() => {
        const map: { [barangay: string]: string } = {};
        for (const municipality in locationData) {
            for (const barangay of locationData[municipality]) {
                map[barangay] = municipality;
            }
        }
        return map;
    }, [locationData]);
    
    // Handles Auth state
    useEffect(() => {
        const fetchUserProfile = async (userId: string) => {
            const { data, error } = await supabase.from('users').select('role, assigned_area').eq('id', userId).single();
            if (error) {
                console.error('Error fetching user profile:', error);
                await supabase.auth.signOut();
                return null;
            }
            return data;
        };
        
        const setUserWithProfile = async (sessionUser: any) => {
            const profile = await fetchUserProfile(sessionUser.id);
            if (profile) {
                setUser({ ...sessionUser, ...profile });
            } else {
                setUser(null);
            }
        };

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUserWithProfile(session.user);
            }
            setIsLoading(false);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUserWithProfile(session.user);
            } else {
                setUser(null);
            }
        });

        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, []);
    
    // Handles fetching location data when user is available
    useEffect(() => {
        if(user && Object.keys(locationData).length === 0) {
            fetchLocationData();
        }
    }, [user, locationData, fetchLocationData]);


    const logout = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        navigate('/');
    }, [navigate]);

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
        setConfirm({ isOpen: true, title, message, onConfirm });
    }, []);

    const hideConfirm = () => {
        setConfirm({ ...confirm, isOpen: false });
    };

    const handleConfirm = () => {
        confirm.onConfirm();
        hideConfirm();
    }

    const value = useMemo(() => ({
        user,
        supabase,
        logout,
        isLoading,
        isOnline,
        locationData,
        barangayToMunicipalityMap,
        showToast,
        showConfirm,
    }), [user, isLoading, isOnline, locationData, barangayToMunicipalityMap, logout, showToast, showConfirm]);

    return (
        <AppContext.Provider value={value}>
            {children}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            <ConfirmationModal 
                isOpen={confirm.isOpen}
                onClose={hideConfirm}
                onConfirm={handleConfirm}
                title={confirm.title}
                message={confirm.message}
            />
        </AppContext.Provider>
    );
};

const App: React.FC = () => (
    <HashRouter>
        <AppProvider>
            <AppContent />
        </AppProvider>
    </HashRouter>
);

export default App;