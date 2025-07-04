import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { DisasterEvent, EventStatus, EventType } from '../types';
import { Button, Icon, Modal, Input, Select, Textarea } from './ui';

const EventForm: React.FC<{ event?: DisasterEvent; onSave: () => void, onClose: () => void }> = ({ event, onSave, onClose }) => {
    const { supabase, locationData, showToast } = useApp();
    const [formData, setFormData] = useState<Partial<DisasterEvent>>(event || { name: '', type: 'Storm', status: 'Active', description: '' });
    const [isLoading, setIsLoading] = useState(false);

    const [selectedMunicipalities, setSelectedMunicipalities] = useState<string[]>(event?.affected_locations?.municipalities || []);
    const [selectedBarangays, setSelectedBarangays] = useState<string[]>(event?.affected_locations?.barangays || []);

    const handleMuniChange = (muni: string) => {
        setSelectedMunicipalities(prev => 
            prev.includes(muni) ? prev.filter(m => m !== muni) : [...prev, muni]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        
        const { id, created_at, ...eventData } = formData;
        
        eventData.affected_locations = {
            municipalities: selectedMunicipalities,
            barangays: selectedBarangays,
        };

        const { error } = id
            ? await supabase.from('events').update(eventData).eq('id', event.id)
            : await supabase.from('events').insert([eventData]);
        
        if (error) {
            showToast(`Failed to save event: ${error.message}`, 'error');
        } else {
            showToast(`Event ${id ? 'updated' : 'created'} successfully.`);
            onSave();
        }
        setIsLoading(false);
    };
    
    const singleSelectedMuni = selectedMunicipalities.length === 1 ? selectedMunicipalities[0] : null;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Event Name" value={formData.name || ''} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required />
            <div className="grid grid-cols-2 gap-4">
                <Select label="Event Type" value={formData.type} onChange={e => setFormData(p => ({...p, type: e.target.value as EventType}))}>
                    <option>Storm</option> <option>Fire</option> <option>Landslide</option> <option>Earthquake</option> <option>Flood</option> <option>Other</option>
                </Select>
                <Select label="Status" value={formData.status} onChange={e => setFormData(p => ({...p, status: e.target.value as EventStatus}))}>
                    <option>Active</option> <option>Monitoring</option> <option>Resolved</option>
                </Select>
            </div>
            <Textarea label="Description" value={formData.description || ''} onChange={e => setFormData(p => ({...p, description: e.target.value}))} rows={3} />
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">Affected Municipalities</label>
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/30 p-2 space-y-1 bg-black/5">
                        {Object.keys(locationData).sort().map(muni => (
                            <label key={muni} className="flex items-center p-1 rounded-md hover:bg-white/20">
                                <input type="checkbox" checked={selectedMunicipalities.includes(muni)} onChange={() => handleMuniChange(muni)} className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2 focus:ring-blue-500" />
                                <span className="text-slate-800">{muni}</span>
                            </label>
                        ))}
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">Affected Barangays</label>
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/30 bg-black/10 p-2 text-sm text-slate-700">
                        {singleSelectedMuni ? (
                            Object.keys(locationData[singleSelectedMuni]).sort().map(brgy => (
                                <label key={brgy} className="flex items-center p-1 rounded-md hover:bg-white/20">
                                    <input type="checkbox" className="form-checkbox h-4 w-4 text-blue-600 rounded mr-2 focus:ring-blue-500" />
                                    <span className="text-slate-800">{locationData[singleSelectedMuni][brgy as any]}</span>
                                </label>
                            ))
                        ) : (
                            <p>Select a single municipality to specify barangays.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                <Button type="submit" isLoading={isLoading}>Save Event</Button>
            </div>
        </form>
    );
};

const EventsPage: React.FC = () => {
    const { supabase, user, showToast, isOnline } = useApp();
    const [events, setEvents] = useState<DisasterEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<DisasterEvent | undefined>(undefined);

    const fetchEvents = useCallback(async () => {
        setIsLoading(true);
        if (!isOnline) {
            showToast("You are offline. Event data cannot be loaded.", "error");
            setIsLoading(false);
            setEvents([]);
            return;
        }
        const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
        if (error) {
            const errorMessage = (error && typeof error === 'object' && 'message' in error)
                ? String((error as any).message)
                : "An unknown error occurred";
            showToast(`Error fetching events: ${errorMessage}`, 'error');
            console.error("Error fetching events", error);
        } else {
            setEvents(data || []);
        }
        setIsLoading(false);
    }, [supabase, showToast, isOnline]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleAddEvent = () => {
        setEditingEvent(undefined);
        setIsModalOpen(true);
    };

    const handleEditEvent = (event: DisasterEvent) => {
        setEditingEvent(event);
        setIsModalOpen(true);
    };
    
    const handleSave = () => {
        setIsModalOpen(false);
        fetchEvents();
    };

    const statusColors: { [key in EventStatus]: string } = {
        Active: 'bg-red-300/50 text-red-900 border-red-400/50',
        Monitoring: 'bg-yellow-300/50 text-yellow-900 border-yellow-400/50',
        Resolved: 'bg-green-300/50 text-green-900 border-green-400/50',
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4 sm:mb-0 text-center sm:text-left">Manage Events</h2>
                {user?.role !== 'viewer' && (
                  <Button 
                    onClick={handleAddEvent}
                    className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:static md:h-auto md:w-auto md:rounded-lg md:shadow-md"
                    title="Create Event"
                    disabled={!isOnline}
                  >
                      <Icon name="fa-plus" className="text-xl md:mr-2 md:text-base" />
                      <span className="hidden md:inline">Create Event</span>
                  </Button>
                )}
            </header>

            {isLoading ? (
                <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>
            ) : (
                <div className="space-y-4">
                    {events.map(event => (
                        <div key={event.id} className="bg-white/20 backdrop-blur-lg p-4 rounded-2xl shadow-lg border border-white/30">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-semibold text-lg text-slate-900">{event.name}</h4>
                                    <p className="text-sm text-slate-800">{event.type} &bull; Created {new Date(event.created_at).toLocaleDateString()}</p>
                                    <p className="text-sm mt-2 text-slate-700">{event.description}</p>
                                </div>
                                <div className="flex items-center space-x-2 flex-shrink-0">
                                    <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusColors[event.status]}`}>
                                        {event.status}
                                    </span>
                                    {user?.role !== 'viewer' && <Button variant="ghost" size="sm" onClick={() => handleEditEvent(event)} disabled={!isOnline}>Edit</Button>}
                                </div>
                            </div>
                        </div>
                    ))}
                    {events.length === 0 && <div className="text-center p-10 bg-white/20 backdrop-blur-lg rounded-2xl text-slate-800">No events found.</div>}
                </div>
            )}
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEvent ? 'Edit Event' : 'Create New Event'}>
                <EventForm event={editingEvent} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default EventsPage;