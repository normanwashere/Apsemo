import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApp } from '../App';
import { Resident, DisasterEvent } from '../types';
import { Button, Icon, Input, Modal, Select } from './ui';
import { getCachedData } from '../services/dbService';


declare const QRCode: any;

const QRCodeModal: React.FC<{ isOpen: boolean; onClose: () => void; resident: Resident | null }> = ({ isOpen, onClose, resident }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (isOpen && resident && canvasRef.current) {
            QRCode.toCanvas(canvasRef.current, resident.id, { width: 256, errorCorrectionLevel: 'H' }, (error: any) => {
                if (error) console.error(error);
            });
        }
    }, [isOpen, resident]);

    if (!isOpen || !resident) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${resident.first_name} ${resident.last_name}`} size="sm">
            <div className="text-center">
                <canvas ref={canvasRef} className="mx-auto rounded-lg"></canvas>
                <p className="mt-4 text-sm text-slate-700">Scan this code to quickly update the resident's status.</p>
                <Button onClick={onClose} className="mt-6 w-full">Close</Button>
            </div>
        </Modal>
    );
};

const ResidentForm: React.FC<{ resident?: Resident | null; onSave: () => void; allResidents: Resident[] }> = ({ resident, onSave, allResidents }) => {
    const { supabase, locationData, showToast } = useApp();
    const [formData, setFormData] = useState<Partial<Resident>>(resident || {});
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Resident[]>([]);
    const [potentialDuplicates, setPotentialDuplicates] = useState<Resident[]>([]);
    const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);

    // Duplicate checker
    useEffect(() => {
        const checkDuplicates = async () => {
            if (!formData.first_name || !formData.last_name || formData.first_name.length < 2 || formData.last_name.length < 2) {
                setPotentialDuplicates([]);
                return;
            }
            setDuplicateCheckLoading(true);
            const { data, error } = await supabase
                .from('residents')
                .select('id, first_name, last_name, municipality, barangay')
                .ilike('first_name', `%${formData.first_name}%`)
                .ilike('last_name', `%${formData.last_name}%`)
                .limit(5);

            if (error) {
                console.error("Error checking for duplicates:", error);
            } else {
                setPotentialDuplicates(data.filter(r => r.id !== resident?.id));
            }
            setDuplicateCheckLoading(false);
        };

        const timerId = setTimeout(() => {
            checkDuplicates();
        }, 500); // 500ms debounce

        return () => {
            clearTimeout(timerId);
        };
    }, [formData.first_name, formData.last_name, supabase, resident?.id]);

    const handleHeadOfFamilyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (value.length < 3 || !formData.barangay) {
            setSuggestions([]);
            return;
        }

        const { data, error } = await supabase.rpc('search_family_heads', { p_barangay: formData.barangay, p_keyword: value });
        if(error) console.error(error);
        else setSuggestions(data || []);
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        if (name === 'dob' && value) {
            const birthDate = new Date(value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            setFormData(prev => ({ ...prev, age: age >= 0 ? age : undefined }));
        }
        
        if (name === 'is_head_of_family' && (e.target as HTMLInputElement).checked) {
            setFormData(prev => ({...prev, head_of_family_name: `${prev.first_name || ''} ${prev.last_name || ''}`.trim() }))
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const { id, created_at, ...saveData } = formData;

        const { error } = id
            ? await supabase.from('residents').update(saveData).eq('id', id)
            : await supabase.from('residents').insert([saveData]);
        
        if (error) {
            showToast(`Error: ${error.message}`, 'error');
        } else {
            showToast(`Resident ${id ? 'updated' : 'added'} successfully!`);
            onSave();
        }
        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <Input label="First Name" name="first_name" value={formData.first_name || ''} onChange={handleChange} required />
                <Input label="Last Name" name="last_name" value={formData.last_name || ''} onChange={handleChange} required />
                
                {duplicateCheckLoading && <p className="text-sm text-slate-600 sm:col-span-2">Checking for duplicates...</p>}
                {potentialDuplicates.length > 0 && (
                    <div className="sm:col-span-2 p-3 bg-yellow-300/50 text-yellow-900 border border-yellow-400/50 rounded-lg">
                        <h4 className="font-bold flex items-center"><Icon name="fa-exclamation-triangle" className="mr-2"/> Potential Duplicates Found</h4>
                        <ul className="list-disc pl-5 mt-2 text-sm">
                            {potentialDuplicates.map(dup => (
                                <li key={dup.id}>{dup.first_name} {dup.last_name} ({dup.barangay}, {dup.municipality})</li>
                            ))}
                        </ul>
                        <p className="text-xs mt-2">Please verify this is not the same person before saving.</p>
                    </div>
                )}

                <Input label="Date of Birth" name="dob" type="date" value={formData.dob || ''} onChange={handleChange} required />
                <Input label="Age" name="age" type="number" value={formData.age || ''} readOnly className="bg-slate-200/50" />
                 <Select label="Sex" name="sex" value={formData.sex || ''} onChange={handleChange}>
                    <option value="">Select Sex</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                </Select>
                 <Select label="Municipality" name="municipality" value={formData.municipality || ''} onChange={handleChange} required>
                    <option value="">Select Municipality</option>
                    {Object.keys(locationData).sort().map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
                <Select label="Barangay" name="barangay" value={formData.barangay || ''} onChange={handleChange} required disabled={!formData.municipality}>
                    <option value="">Select Barangay</option>
                    {(locationData[formData.municipality || ''] || []).map(b => <option key={b} value={b}>{b}</option>)}
                </Select>
                <Input label="Purok" name="purok" value={formData.purok || ''} onChange={handleChange} />
                <Input label="House No. / Street" name="street" value={formData.street || ''} onChange={handleChange} />
                 <div className="sm:col-span-2 relative">
                    <Input label="Head of Family" name="head_of_family_name" value={formData.head_of_family_name || ''} onChange={handleHeadOfFamilyChange} autoComplete="off" readOnly={formData.is_head_of_family} />
                    {suggestions.length > 0 && (
                        <div className="absolute w-full bg-white/80 backdrop-blur-sm shadow-lg rounded-b-lg z-10 max-h-40 overflow-y-auto border border-white/30">
                           {suggestions.map(s => (
                               <div key={s.id} className="p-2 cursor-pointer hover:bg-white/50" onClick={() => {
                                   setFormData(prev => ({...prev, head_of_family_name: s.full_name}));
                                   setSuggestions([]);
                               }}>{s.full_name}</div>
                           ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center">
                    <input type="checkbox" name="is_head_of_family" id="is_head_of_family" checked={!!formData.is_head_of_family} onChange={handleChange} className="h-4 w-4 text-blue-600 rounded mr-2 focus:ring-blue-500" />
                    <label htmlFor="is_head_of_family" className="text-sm text-slate-800">I am the head of the family</label>
                </div>
                 <div className="flex items-center">
                    <input type="checkbox" name="is_pwd" id="is_pwd" checked={!!formData.is_pwd} onChange={handleChange} className="h-4 w-4 text-blue-600 rounded mr-2 focus:ring-blue-500" />
                    <label htmlFor="is_pwd" className="text-sm text-slate-800">Person with Disability (PWD)</label>
                </div>
            </div>
            <div className="flex justify-end pt-6">
                <Button type="submit" isLoading={isLoading}>Save Resident</Button>
            </div>
        </form>
    );
};

const ResidentsPage: React.FC = () => {
    const { supabase, user, showToast, showConfirm, isOnline } = useApp();
    const [allResidents, setAllResidents] = useState<Resident[]>([]);
    const [activeEvent, setActiveEvent] = useState<DisasterEvent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingResident, setEditingResident] = useState<Resident | null>(null);
    const [qrCodeResident, setQrCodeResident] = useState<Resident | null>(null);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ key: keyof Resident, direction: 'asc' | 'desc' }>({ key: 'last_name', direction: 'asc' });

    const fetchData = useCallback(async (eventId?: string) => {
        setIsLoading(true);
        if (isOnline && eventId) {
            const { data, error } = await supabase.rpc('get_residents_with_status', { p_event_id: eventId });
            if (error) {
                showToast("Error fetching residents: " + error.message, "error");
            } else {
                setAllResidents(data || []);
            }
        } else if (!isOnline) {
            showToast("You are offline. Showing cached data.", "success");
            const cachedResidents = await getCachedData<Resident>('residents');
            // Note: Offline data won't have live status, so we clear it.
            const residentsWithoutStatus = cachedResidents.map(r => ({ ...r, status: undefined }));
            setAllResidents(residentsWithoutStatus);
        } else {
            setAllResidents([]);
        }
        setIsLoading(false);
    }, [supabase, showToast, isOnline]);
    
    useEffect(() => {
        const getActiveEvent = async () => {
            if (isOnline) {
                const { data } = await supabase.from('events').select('*').eq('status', 'Active').limit(1).single();
                setActiveEvent(data);
                fetchData(data?.id);
            } else {
                setActiveEvent(null); // No active event concept offline
                fetchData();
            }
        };
        getActiveEvent();
    }, [supabase, fetchData, isOnline]);

    const filteredResidents = useMemo(() => {
        return allResidents
            .filter(r => 
                `${r.first_name} ${r.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => {
                const key = sortConfig.key;
                const aValue = a[key] || '';
                const bValue = b[key] || '';
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
    }, [allResidents, searchTerm, sortConfig]);

    const paginatedResidents = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        return filteredResidents.slice(startIndex, startIndex + rowsPerPage);
    }, [filteredResidents, currentPage, rowsPerPage]);

    const handleSort = (key: keyof Resident) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };
    
    const handleAddResident = () => {
        setEditingResident(null);
        setIsModalOpen(true);
    };

    const handleEditResident = (resident: Resident) => {
        setEditingResident(resident);
        setIsModalOpen(true);
    };

    const handleDelete = (resident: Resident) => {
        showConfirm('Delete Resident', `Are you sure you want to delete ${resident.first_name} ${resident.last_name}? This action cannot be undone.`, async () => {
            const { error } = await supabase.from('residents').delete().eq('id', resident.id);
            if (error) {
                showToast(`Error: ${error.message}`, 'error');
            } else {
                showToast('Resident deleted successfully.');
                if(activeEvent) fetchData(activeEvent.id);
            }
        });
    }

    const handleSave = () => {
        setIsModalOpen(false);
        if(activeEvent) fetchData(activeEvent.id);
    };

    const totalPages = Math.ceil(filteredResidents.length / rowsPerPage);

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <h2 className="text-2xl font-semibold text-slate-800 mb-4 sm:mb-0 text-center sm:text-left">Resident Registry</h2>
                <div className="flex items-center space-x-4 w-full sm:w-auto">
                    {user?.role !== 'viewer' && (
                      <Button 
                        onClick={handleAddResident}
                        className="fixed bottom-20 right-4 z-30 h-14 w-14 rounded-full shadow-lg md:static md:h-auto md:w-auto md:rounded-lg md:shadow-md"
                        title="Add Resident"
                        disabled={!isOnline}
                      >
                          <Icon name="fa-plus" className="text-xl md:mr-2 md:text-base"/>
                          <span className="hidden md:inline">Add Resident</span>
                      </Button>
                    )}
                </div>
            </header>

            <div className="mb-4">
                <Input type="search" placeholder="Search residents by name..." onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>

            {isLoading ? (
                 <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>
            ) : isOnline && !activeEvent ? (
                 <div className="text-center p-10 bg-white/20 backdrop-blur-lg rounded-2xl text-slate-800">No active event. Resident list unavailable.</div>
            ) : (
                <>
                <div className="bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg border border-white/30 overflow-x-auto">
                    <table className="min-w-full responsive-table">
                        <thead className="bg-white/30">
                            <tr>
                                {['last_name', 'municipality', 'barangay', 'status'].map(key => (
                                    <th key={key} className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider cursor-pointer" onClick={() => handleSort(key as keyof Resident)}>
                                        {key.replace('_', ' ')}
                                        {sortConfig.key === key && <Icon name={sortConfig.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down'} className="ml-2" />}
                                    </th>
                                ))}
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/20">
                            {paginatedResidents.map(res => (
                                <tr key={res.id} className="hover:bg-white/20">
                                    <td data-label="Name" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{res.first_name} {res.last_name}</td>
                                    <td data-label="Municipality" className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{res.municipality}</td>
                                    <td data-label="Barangay" className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{res.barangay}</td>
                                    <td data-label="Status" className="px-6 py-4 whitespace-nowrap text-sm text-slate-800">{res.status || 'Unknown'}</td>
                                    <td data-label="Actions" className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Button variant="ghost" size="sm" onClick={() => setQrCodeResident(res)} title="View QR Code"><Icon name="fa-qrcode"/></Button>
                                        {user?.role !== 'viewer' && <Button variant="ghost" size="sm" onClick={() => handleEditResident(res)} disabled={!isOnline}>Edit</Button>}
                                        {user?.role === 'admin' && <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(res)} disabled={!isOnline}>Delete</Button>}
                                    </td>
                                </tr>
                            ))}
                             {paginatedResidents.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-slate-700">No residents found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                 <div className="flex justify-between items-center text-sm text-slate-700">
                    <Select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                        <option value={10}>10 rows</option>
                        <option value={20}>20 rows</option>
                        <option value={50}>50 rows</option>
                    </Select>
                    <div>Page {currentPage} of {totalPages}</div>
                    <div className="space-x-2">
                        <Button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} variant="secondary">Previous</Button>
                        <Button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} variant="secondary">Next</Button>
                    </div>
                </div>
                </>
            )}
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingResident ? 'Edit Resident' : 'Add New Resident'} size="xl">
                <ResidentForm resident={editingResident} onSave={handleSave} allResidents={allResidents} />
            </Modal>
            <QRCodeModal isOpen={!!qrCodeResident} onClose={() => setQrCodeResident(null)} resident={qrCodeResident} />

        </div>
    );
};

export default ResidentsPage;