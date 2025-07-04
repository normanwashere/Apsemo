

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../App';
import { Resident, ResidentStatus, DisasterEvent, EvacuationCenter } from '../types';
import { Button, Icon, Input, Select, GlassCard } from './ui';
import { getCachedData } from '../services/dbService';

declare const jsQR: any;

const QRScanner: React.FC<{ onScan: (result: string) => void; isScanning: boolean; setIsScanning: (isScanning: boolean) => void }> = ({ onScan, isScanning, setIsScanning }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startScan = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                videoRef.current.play();
                setIsScanning(true);
            }
        } catch (err) {
            console.error("Error accessing camera:", err);
            alert("Could not access camera. Please grant permission and try again.");
        }
    }, [setIsScanning]);
    
    const stopScan = useCallback(() => {
        if(streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setIsScanning(false);
    }, [setIsScanning]);

    useEffect(() => {
        const tick = () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                const canvas = document.createElement('canvas');
                canvas.height = videoRef.current.videoHeight;
                canvas.width = videoRef.current.videoWidth;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
                if (imageData) {
                    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                    if (code) {
                        onScan(code.data);
                        stopScan();
                    }
                }
            }
            if(isScanning) requestAnimationFrame(tick);
        }
        if (isScanning) requestAnimationFrame(tick);
        
        return () => {
            if(streamRef.current) {
                 streamRef.current.getTracks().forEach(track => track.stop());
            }
        };

    }, [isScanning, onScan, stopScan]);

    return (
        <GlassCard>
            <h3 className="font-semibold text-xl mb-4 text-slate-900">Scan QR Code</h3>
            <div className="relative w-full max-w-sm mx-auto aspect-square bg-slate-800/20 rounded-xl overflow-hidden">
                <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover" />
                <div className="absolute inset-0 border-8 border-white/50 rounded-xl pointer-events-none"></div>
            </div>
            <Button onClick={isScanning ? stopScan : startScan} className="w-full mt-4">
                <Icon name={isScanning ? "fa-stop-circle" : "fa-qrcode"} className="mr-2" />
                {isScanning ? 'Stop Scanner' : 'Start Scanner'}
            </Button>
        </GlassCard>
    );
};

const StatusUpdatePage: React.FC = () => {
    const { supabase, showToast, isOnline } = useApp();
    const [activeEvent, setActiveEvent] = useState<DisasterEvent | null>(null);
    const [allResidents, setAllResidents] = useState<Resident[]>([]);
    const [evacCenters, setEvacCenters] = useState<EvacuationCenter[]>([]);
    const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
    const [familyMembers, setFamilyMembers] = useState<Resident[]>([]);
    const [newStatus, setNewStatus] = useState<ResidentStatus>('Safe');
    const [evacCenterId, setEvacCenterId] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const loadInitialData = useCallback(async () => {
        setIsLoading(true);
        if (isOnline) {
            const { data: eventData } = await supabase.from('events').select('*').eq('status', 'Active').limit(1).single();
            if (eventData) {
                setActiveEvent(eventData);
                const { data: residentData } = await supabase.rpc('get_residents_with_status', { p_event_id: eventData.id });
                setAllResidents(residentData || []);
                const { data: centerData } = await supabase.from('evacuation_centers').select('*');
                setEvacCenters(centerData || []);
            }
        } else {
             showToast("You are offline. Showing cached data.", "success");
            const cachedResidents = await getCachedData<Resident>('residents');
            const residentsWithoutStatus = cachedResidents.map(r => ({ ...r, status: undefined }));
            setAllResidents(residentsWithoutStatus);
            const cachedCenters = await getCachedData<EvacuationCenter>('evac_centers');
            setEvacCenters(cachedCenters);
            setActiveEvent(null);
        }
        setIsLoading(false);
    }, [supabase, isOnline, showToast]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    const handleSelectResident = (resident: Resident) => {
        setSelectedResident(resident);
        setSearchTerm('');
        if (resident.head_of_family_name) {
            const family = allResidents.filter(r => r.head_of_family_name === resident.head_of_family_name);
            setFamilyMembers(family);
        } else {
            setFamilyMembers([resident]);
        }
    };
    
    const handleScan = (residentId: string) => {
        const found = allResidents.find(r => r.id === residentId);
        if (found) {
            handleSelectResident(found);
            showToast(`Found ${found.first_name} ${found.last_name}`);
        } else {
            showToast('Resident not found in active event or offline data.', 'error');
        }
        setIsScanning(false);
    };

    const handleUpdateStatus = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedResident || !activeEvent || !isOnline) {
            showToast("Cannot update status while offline.", "error");
            return;
        }

        const form = e.target as HTMLFormElement;
        const selectedIds = Array.from(form.querySelectorAll('input[name=family-member]:checked')).map(el => (el as HTMLInputElement).value);
        if (selectedIds.length === 0) {
            showToast('Please select at least one family member to update.', 'error');
            return;
        }

        const statusLogs = selectedIds.map(id => ({
            resident_id: id,
            status: newStatus,
            event_id: activeEvent.id,
            evac_center_id: newStatus === 'Evacuated' ? evacCenterId : null
        }));

        const { error } = await supabase.from('resident_status_log').insert(statusLogs);
        if (error) {
            showToast(`Error updating status: ${error.message}`, 'error');
        } else {
            showToast(`Successfully updated status for ${selectedIds.length} resident(s).`);
            setSelectedResident(null);
            setFamilyMembers([]);
            loadInitialData(); // Refresh data
        }
    };

    const searchResults = useMemo(() => {
        if (searchTerm.length < 2) return [];
        return allResidents.filter(r => `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, allResidents]);

    if (isLoading) return <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-white text-3xl"/></div>;
    
    if (isOnline && !activeEvent) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Status Update</h2>
                <GlassCard><div className="text-center p-10 text-slate-800">No active event. Status updates are disabled.</div></GlassCard>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Status Update</h2>
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="flex flex-col gap-8">
                    <QRScanner onScan={handleScan} isScanning={isScanning} setIsScanning={setIsScanning} />

                    <GlassCard>
                        <h3 className="font-semibold text-xl mb-4 text-slate-900">Or Search Manually</h3>
                        <div className="relative">
                            <Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            {searchResults.length > 0 && (
                                <div className="absolute w-full bg-white/80 backdrop-blur-md shadow-lg rounded-b-lg z-10 max-h-48 overflow-y-auto border border-white/30">
                                    {searchResults.map(res => (
                                        <div key={res.id} className="p-3 hover:bg-white/50 cursor-pointer border-b border-white/20" onClick={() => handleSelectResident(res)}>
                                            <p className="font-medium text-slate-900">{res.first_name} {res.last_name}</p>
                                            <p className="text-xs text-slate-700">{res.barangay}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </GlassCard>
                </div>
                
                <GlassCard>
                    <h3 className="font-semibold text-xl mb-4 text-slate-900">Update Status</h3>
                    {selectedResident ? (
                        <form onSubmit={handleUpdateStatus} className="space-y-4">
                            <div className="p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                                <h4 className="font-bold text-lg text-blue-900">{selectedResident.first_name} {selectedResident.last_name}</h4>
                                <p className="text-sm text-blue-800">{selectedResident.barangay}, {selectedResident.municipality}</p>
                                {isOnline && <p className="text-sm text-blue-800 mt-1">Current Status: <span className="font-semibold">{selectedResident.status || 'Unknown'}</span></p>}
                            </div>
                            {familyMembers.length > 1 && (
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-2">Family Members</h4>
                                    <div className="space-y-2 border border-white/30 rounded-lg p-3 max-h-48 overflow-y-auto bg-black/5">
                                        {familyMembers.map(member => (
                                            <label key={member.id} className="flex items-center text-slate-800">
                                                <input type="checkbox" name="family-member" value={member.id} defaultChecked={member.id === selectedResident.id} className="h-4 w-4 text-blue-600 rounded mr-3" />
                                                <span>{member.first_name} {member.last_name} {isOnline ? `(${member.status || 'Unknown'})` : ''}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <Select label="New Status" value={newStatus} onChange={e => setNewStatus(e.target.value as ResidentStatus)} disabled={!isOnline}>
                                <option>Safe</option> <option>Evacuated</option> <option>Injured</option> <option>Missing</option> <option>Deceased</option>
                            </Select>
                            {newStatus === 'Evacuated' && (
                                <Select label="Evacuation Center" value={evacCenterId} onChange={e => setEvacCenterId(e.target.value)} required disabled={!isOnline}>
                                    <option value="">Select center...</option>
                                    {evacCenters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </Select>
                            )}
                            <div className="flex space-x-2">
                                <Button type="button" variant="secondary" onClick={() => setSelectedResident(null)}>Clear</Button>
                                <Button type="submit" className="w-full" disabled={!isOnline}>Update Status</Button>
                            </div>
                        </form>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-slate-700">Scan a QR code or search for a resident to update their status.</p>
                            {!isOnline && <p className="text-sm mt-2 p-2 bg-yellow-300/50 text-yellow-900 rounded-lg">Status updates are disabled while offline.</p>}
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    );
};

export default StatusUpdatePage;