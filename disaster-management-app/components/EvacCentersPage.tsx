import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../App';
import { EvacuationCenter } from '../types';
import { GlassCard, Icon, Button, Modal, Input, Select } from './ui';
import { getCachedData } from '../services/dbService';

declare const L: any;

const EvacCenterForm: React.FC<{ center?: EvacuationCenter; onSave: () => void, onClose: () => void }> = ({ center, onSave, onClose }) => {
    const { supabase, locationData, barangayToMunicipalityMap, showToast } = useApp();
    const [formData, setFormData] = useState<Partial<EvacuationCenter>>(
        center || { name: '', barangay: '', address: '', capacity: 0, latitude: undefined, longitude: undefined }
    );
    const [isLoading, setIsLoading] = useState(false);
    
    // Local state for municipality dropdown, for filtering purposes only
    const [selectedMuni, setSelectedMuni] = useState(() => {
        if (center?.barangay) {
            return barangayToMunicipalityMap[center.barangay] || '';
        }
        return '';
    });


    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current && typeof L !== 'undefined') {
            const initialCoords: [number, number] = [
                formData.latitude || 13.21,
                formData.longitude || 123.65
            ];
            const initialZoom = formData.latitude ? 15 : 9;

            mapRef.current = L.map(mapContainerRef.current).setView(initialCoords, initialZoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);

            if (formData.latitude && formData.longitude) {
                markerRef.current = L.marker(initialCoords).addTo(mapRef.current);
            }

            mapRef.current.on('click', (e: any) => {
                const { lat, lng } = e.latlng;
                setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
                if (markerRef.current) {
                    markerRef.current.setLatLng(e.latlng);
                } else {
                    markerRef.current = L.marker(e.latlng).addTo(mapRef.current);
                }
            });
        }
        
        const timer = setTimeout(() => {
            if (mapRef.current) mapRef.current.invalidateSize();
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'municipality_filter') {
            setSelectedMuni(value);
            // Reset barangay when municipality changes
            setFormData(prev => ({...prev, barangay: ''}));
        } else {
            setFormData(prev => ({ ...prev, [name]: name === 'capacity' ? parseInt(value, 10) || 0 : value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const { id, ...saveData } = formData;

        if (!saveData.name || !saveData.barangay) {
            showToast("Please fill all required fields.", "error");
            setIsLoading(false);
            return;
        }

        const { error } = id
            ? await supabase.from('evacuation_centers').update(saveData).eq('id', id)
            : await supabase.from('evacuation_centers').insert([saveData]);

        if (error) {
            showToast(`Failed to save center: ${error.message}`, 'error');
        } else {
            showToast(`Center ${id ? 'updated' : 'added'} successfully.`);
            onSave();
        }
        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="md:col-span-2">
                    <Input label="Center Name" name="name" value={formData.name || ''} onChange={handleChange} required />
                </div>
                <Select label="Municipality" name="municipality_filter" value={selectedMuni} onChange={handleChange} required>
                    <option value="">Select Municipality</option>
                    {Object.keys(locationData).sort().map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Select label="Barangay" name="barangay" value={formData.barangay || ''} onChange={handleChange} required disabled={!selectedMuni}>
                    <option value="">Select Barangay</option>
                    {(locationData[selectedMuni] || []).sort().map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
                <div className="md:col-span-2">
                  <Input label="Address (Street, etc.)" name="address" value={formData.address || ''} onChange={handleChange} />
                </div>
                <div className="md:col-span-2">
                  <Input label="Capacity" name="capacity" type="number" value={formData.capacity || ''} onChange={handleChange} required />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-800 mb-1">Geotag Location</label>
                    <p className="text-xs text-slate-600 mb-2">Click on the map to pin the exact location.</p>
                    <div ref={mapContainerRef} style={{height: '250px'}} className="w-full rounded-lg z-10 border border-white/30"></div>
                </div>

                <div>
                    <Input label="Latitude" name="latitude" type="number" step="any" value={formData.latitude || ''} readOnly className="bg-slate-200/50" />
                </div>
                <div>
                    <Input label="Longitude" name="longitude" type="number" step="any" value={formData.longitude || ''} readOnly className="bg-slate-200/50" />
                </div>
            </div>
            <div className="flex justify-end space-x-2 pt-4 border-t border-white/30">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit" isLoading={isLoading}>Save Center</Button>
            </div>
        </form>
    );
};

const EvacCentersPage: React.FC = () => {
    const { supabase, showToast, user, isOnline, barangayToMunicipalityMap } = useApp();
    const [centers, setCenters] = useState<EvacuationCenter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCenter, setEditingCenter] = useState<EvacuationCenter | null>(null);


    const fetchCenters = useCallback(async () => {
        setIsLoading(true);
        if (isOnline) {
            const { data, error } = await supabase.from('evacuation_centers').select('*').order('name');
            if (error) {
                const errorMessage = (error && typeof error === 'object' && 'message' in error)
                    ? String((error as any).message)
                    : "An unknown error occurred";
                showToast(`Error fetching evac centers: ${errorMessage}`, 'error');
                console.error("Error fetching evac centers:", error);
            } else {
                setCenters(data || []);
            }
        } else {
            showToast("You are offline. Showing cached data.", "success");
            const cachedCenters = await getCachedData<EvacuationCenter>('evac_centers');
            setCenters(cachedCenters);
        }
        setIsLoading(false);
    }, [supabase, showToast, isOnline]);

    useEffect(() => {
        fetchCenters();
    }, [fetchCenters]);

    const handleAddCenter = () => {
        setEditingCenter(null);
        setIsModalOpen(true);
    };

    const handleEditCenter = (center: EvacuationCenter) => {
        setEditingCenter(center);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        setIsModalOpen(false);
        setEditingCenter(null);
        fetchCenters();
    };
    
    const handleClose = () => {
        setIsModalOpen(false);
        setEditingCenter(null);
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4 sm:mb-0 text-center sm:text-left">Evacuation Centers</h2>
                {user?.role !== 'viewer' && (
                    <Button 
                        onClick={handleAddCenter}
                        className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:static md:h-auto md:w-auto md:rounded-lg md:shadow-md"
                        title="Add Evacuation Center"
                        disabled={!isOnline}
                    >
                        <Icon name="fa-plus" className="text-xl md:mr-2 md:text-base"/>
                        <span className="hidden md:inline">Add Evac Center</span>
                    </Button>
                )}
            </header>
             <GlassCard>
                 {isLoading ? (
                    <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>
                ) : (
                    <div className="space-y-4">
                        {centers.length > 0 ? centers.map(c => (
                            <div key={c.id} className="p-4 bg-black/5 rounded-lg text-slate-800 border border-white/20 flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-slate-900">{c.name}</p>
                                    <p className="text-sm">{c.address || 'No address specified'}, {c.barangay}, {barangayToMunicipalityMap[c.barangay] || 'N/A'}</p>
                                    <p className="text-sm mt-1 font-medium">Capacity: <span className="font-normal">{c.capacity}</span></p>
                                    {c.latitude && c.longitude && (
                                        <p className="text-xs mt-1 text-slate-600">
                                            <Icon name="fa-map-marker-alt" className="mr-1"/> 
                                            {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)}
                                        </p>
                                    )}
                                </div>
                                {user?.role !== 'viewer' && (
                                    <Button variant="ghost" size="sm" onClick={() => handleEditCenter(c)} disabled={!isOnline}>Edit</Button>
                                )}
                            </div>
                        )) : (
                             <p className="text-slate-700 text-center py-8">No evacuation centers found.</p>
                        )}
                    </div>
                )}
            </GlassCard>

            {isModalOpen && isOnline && (
                <Modal 
                    isOpen={isModalOpen} 
                    onClose={handleClose} 
                    title={editingCenter ? "Edit Evacuation Center" : "Add New Evacuation Center"}
                    size="2xl"
                >
                    <EvacCenterForm center={editingCenter || undefined} onSave={handleSave} onClose={handleClose} />
                </Modal>
            )}
        </div>
    );
};

export default EvacCentersPage;