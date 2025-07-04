import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { Button, Icon, Input, GlassCard, Select } from './ui';
import * as dbService from '../services/dbService';
import { Resident, EvacuationCenter } from '../types';

const OfflineDataManagement: React.FC = () => {
    const { supabase, locationData, showToast } = useApp();
    const [selectedMuni, setSelectedMuni] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [cacheInfo, setCacheInfo] = useState<{municipality: string; timestamp: string} | null>(null);

    const checkCache = useCallback(async () => {
        const meta = await dbService.getMetadata('cacheInfo') as any;
        if (meta) {
            setCacheInfo(meta.value);
        } else {
            setCacheInfo(null);
        }
    }, []);

    useEffect(() => {
        checkCache();
    }, [checkCache]);

    const handleDownload = async () => {
        if (!selectedMuni) {
            showToast('Please select a municipality to download.', 'error');
            return;
        }
        setIsDownloading(true);
        try {
            // Fetch residents for the selected municipality
            const { data: residents, error: resError } = await supabase
                .from('residents')
                .select('*')
                .eq('municipality', selectedMuni);
            
            if (resError) throw resError;

            // Fetch all evacuation centers
            const { data: evacCenters, error: evacError } = await supabase
                .from('evacuation_centers')
                .select('*');

            if (evacError) throw evacError;

            // Cache the data
            await dbService.cacheData('residents', residents as Resident[]);
            await dbService.cacheData('evac_centers', evacCenters as EvacuationCenter[]);
            
            // Save metadata
            const newCacheInfo = {
                municipality: selectedMuni,
                timestamp: new Date().toLocaleString()
            };
            await dbService.setMetadata('cacheInfo', newCacheInfo);

            setCacheInfo(newCacheInfo);
            showToast(`Offline data for ${selectedMuni} downloaded successfully!`, 'success');

        } catch (error: any) {
            showToast(`Failed to download data: ${error.message}`, 'error');
        } finally {
            setIsDownloading(false);
        }
    };
    
    const handleClearCache = async () => {
        try {
            await dbService.clearCache();
            setCacheInfo(null);
            showToast('Offline cache cleared.', 'success');
        } catch (error: any) {
            showToast(`Failed to clear cache: ${error.message}`, 'error');
        }
    }

    return (
        <GlassCard>
            <h3 className="font-semibold text-xl mb-4 text-slate-900">Offline Data Management</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">Download Data by Municipality</label>
                    <div className="flex items-center space-x-2">
                        <Select value={selectedMuni} onChange={e => setSelectedMuni(e.target.value)} className="w-full">
                            <option value="">Select Municipality...</option>
                            {Object.keys(locationData).sort().map(m => <option key={m} value={m}>{m}</option>)}
                        </Select>
                        <Button onClick={handleDownload} isLoading={isDownloading} className="flex-shrink-0">
                            <Icon name="fa-download" />
                        </Button>
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-slate-900">Cached Data</h4>
                    {cacheInfo ? (
                        <div className="text-sm text-slate-800 p-3 bg-blue-500/20 rounded-lg mt-2 flex justify-between items-center">
                            <div>
                                <p>Data for <span className="font-bold">{cacheInfo.municipality}</span> is cached.</p>
                                <p className="text-xs">Last updated: {cacheInfo.timestamp}</p>
                            </div>
                            <Button variant="danger" size="sm" onClick={handleClearCache}>Clear</Button>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-700 mt-2">No data downloaded for offline use.</p>
                    )}
                </div>
            </div>
        </GlassCard>
    );
};


const SettingsPage: React.FC = () => {
    const { user, showToast, supabase } = useApp();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showToast("Passwords do not match.", "error");
            return;
        }
        if (newPassword.length < 6) {
            showToast("Password should be at least 6 characters.", "error");
            return;
        }
        setIsUpdating(true);
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            showToast(error.message, "error");
        } else {
            showToast("Password updated successfully.");
            setNewPassword('');
            setConfirmPassword('');
        }
        setIsUpdating(false);
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Settings</h2>
            <GlassCard>
                <h3 className="font-semibold text-xl mb-4 text-slate-900">My Profile</h3>
                <div className="space-y-4 text-slate-800">
                    <div className="flex items-center"><Icon name="fa-envelope" className="fa-fw text-slate-500 mr-4 w-5 text-center" /> <span>{user?.email}</span></div>
                    <div className="flex items-center"><Icon name="fa-user-shield" className="fa-fw text-slate-500 mr-4 w-5 text-center" /> <span className="capitalize">{user?.role}</span></div>
                    <div className="flex items-center"><Icon name="fa-map-marker-alt" className="fa-fw text-slate-500 mr-4 w-5 text-center" /> <span>{user?.assigned_area || 'N/A'}</span></div>
                </div>
            </GlassCard>
            <GlassCard>
                <h3 className="font-semibold text-xl mb-4 text-slate-900">Change Password</h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <Input label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                    <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                    <Button type="submit" isLoading={isUpdating}>Update Password</Button>
                </form>
            </GlassCard>
             <GlassCard>
                <h3 className="font-semibold text-xl mb-4 text-slate-900">Install App</h3>
                 <p className="text-sm text-slate-700 mb-2">To install this app on your device for easy access:</p>
                 <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
                    <li>Open your browser's menu (usually three dots or lines).</li>
                    <li>Look for and tap 'Install app' or 'Add to Home screen'.</li>
                 </ol>
            </GlassCard>
            <OfflineDataManagement />
        </div>
    );
}

export default SettingsPage;