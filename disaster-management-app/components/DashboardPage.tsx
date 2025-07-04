import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApp } from '../App';
import { DisasterEvent, ResidentStatus, Incident, EvacuationCenter, Resident } from '../types';
import { Button, Icon, Select, GlassCard } from './ui';
import { generateDashboardSummary } from '../services/geminiService';

declare const L: any;

const StatCard: React.FC<{ title: string; value: number | string; icon: string; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white/20 backdrop-blur-md p-4 rounded-xl shadow-lg border border-white/30">
        <div className="flex items-center">
            <div className={`rounded-full p-3 bg-opacity-20 ${color.replace('text', 'bg')}`}>
                 <Icon name={icon} className={`text-xl ${color}`} />
            </div>
            <div className="ml-4">
                <p className="text-slate-800 text-sm font-medium">{title}</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    </div>
);

// Simple geocoding for demonstration. A real app would use a geocoding API.
const geocodeAddress = async (address: string): Promise<{ lat: number, lng: number } | null> => {
    const baseLat = 13.13; // Albay center
    const baseLon = 123.74;
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
        hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }
    const latOffset = (hash & 0x7FFF) / 0x7FFF * 0.3 - 0.15;
    const lonOffset = ((hash >> 15) & 0x7FFF) / 0x7FFF * 0.3 - 0.15;
    return { lat: baseLat + latOffset, lng: baseLon + lonOffset };
};


const LeafletMap: React.FC<{ event: DisasterEvent | null }> = ({ event }) => {
    const { supabase, barangayToMunicipalityMap } = useApp();
    const mapRef = useRef<any | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const incidentLayerRef = useRef<any | null>(null);
    const evacLayerRef = useRef<any | null>(null);

    useEffect(() => {
        if (containerRef.current && !mapRef.current && typeof L !== 'undefined') {
            mapRef.current = L.map(containerRef.current, { attributionControl: false }).setView([13.21, 123.65], 9);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
            L.control.attribution({ position: 'topright' }).addTo(mapRef.current);
            incidentLayerRef.current = L.layerGroup().addTo(mapRef.current);
            evacLayerRef.current = L.layerGroup().addTo(mapRef.current);
        }
    }, []);

    const plotData = useCallback(async (eventId: string) => {
        if (!mapRef.current || !incidentLayerRef.current || !evacLayerRef.current) return;

        // Clear previous markers
        incidentLayerRef.current.clearLayers();
        evacLayerRef.current.clearLayers();

        // Fetch and plot incidents
        const { data: incidents } = await supabase.from('incident_reports').select(`*, resident:residents(barangay, municipality)`).eq('event_id', eventId);
        const incidentIcon = L.icon({
            iconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });
        incidents?.forEach(async (inc: Incident) => {
            if (inc.resident) {
                const fullAddress = `${inc.resident.barangay}, ${inc.resident.municipality}, Albay, Philippines`;
                const coords = await geocodeAddress(fullAddress);
                if(coords) L.marker([coords.lat, coords.lng], { icon: incidentIcon }).addTo(incidentLayerRef.current!)
                    .bindPopup(`<b>Incident: ${inc.type}</b><br>${inc.description || ''}`);
            }
        });

        // Fetch and plot evac centers
        const { data: centers } = await supabase.from('evacuation_centers').select('*');
        centers?.forEach(async (center: EvacuationCenter) => {
            let coords: { lat: number; lng: number } | null = null;
            
            // Prioritize stored geotags
            if (center.latitude && center.longitude) {
                coords = { lat: center.latitude, lng: center.longitude };
            } else {
                // Fallback to geocoding the address
                const municipality = barangayToMunicipalityMap[center.barangay] || 'Unknown Municipality';
                const fullAddress = `${center.address || ''}, ${center.barangay}, ${municipality}, Albay, Philippines`;
                coords = await geocodeAddress(fullAddress);
            }

            if (coords) {
                L.marker([coords.lat, coords.lng]).addTo(evacLayerRef.current!)
                    .bindPopup(`<b>${center.name}</b><br>Capacity: ${center.capacity}`);
            }
        });

    }, [supabase, barangayToMunicipalityMap]);

    useEffect(() => {
        if (event) {
            plotData(event.id);
        }
    }, [event, plotData]);

    return <div ref={containerRef} id="map" className="h-full w-full rounded-xl" />;
};


const DashboardPage: React.FC = () => {
    const { supabase, showToast, locationData } = useApp();
    const [activeEvent, setActiveEvent] = useState<DisasterEvent | null>(null);
    const [stats, setStats] = useState({ Safe: 0, Evacuated: 0, Injured: 0, Missing: 0, Deceased: 0, Unknown: 0 });
    const [evacStats, setEvacStats] = useState<{name: string; occupancy: number; capacity: number}[]>([]);
    const [totalAffected, setTotalAffected] = useState<number | string>('...');
    const [isLoading, setIsLoading] = useState(true);
    const [aiSummary, setAiSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    
    const [filterMunicipality, setFilterMunicipality] = useState('all');
    const [filterBarangay, setFilterBarangay] = useState('all');

    useEffect(() => {
        // Reset barangay filter when municipality changes
        setFilterBarangay('all');
    }, [filterMunicipality]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        const { data: eventData, error: eventError } = await supabase.from('events').select('*').eq('status', 'Active').limit(1).single();

        if (eventError || !eventData) {
            console.log("No active events found.");
            setIsLoading(false);
            return;
        }
        setActiveEvent(eventData);

        // 1. Get filtered residents and total count
        let residentQuery = supabase.from('residents').select('id', { count: 'exact' });
        if (filterMunicipality !== 'all') {
            residentQuery = residentQuery.eq('municipality', filterMunicipality);
        }
        if (filterBarangay !== 'all') {
            residentQuery = residentQuery.eq('barangay', filterBarangay);
        }
        const { data: residentData, count, error: residentError } = await residentQuery;
        
        if (residentError) {
            showToast("Error fetching residents data", "error");
            setIsLoading(false);
            return;
        }

        const affectedCount = count || 0;
        setTotalAffected(affectedCount);
        const residentIds = residentData.map(r => r.id);

        if (residentIds.length === 0) {
            setStats({ Safe: 0, Evacuated: 0, Injured: 0, Missing: 0, Deceased: 0, Unknown: affectedCount });
            setEvacStats([]);
            setIsLoading(false);
            return;
        }

        // 2. Fetch logs for ONLY the filtered residents
        const { data: logs, error: logError } = await supabase.from('resident_status_log').select('resident_id, status, timestamp, evac_center_id').eq('event_id', eventData.id).in('resident_id', residentIds);

        if (logError) {
            showToast("Error fetching status logs", "error");
            setIsLoading(false);
            return;
        }

        // 3. Determine the latest status for each resident
        type LogEntry = { resident_id: string; status: ResidentStatus; timestamp: string; evac_center_id: string | null; };
        const latestStatusMap = new Map<string, LogEntry>();
        logs.forEach((log: LogEntry) => {
            const existing = latestStatusMap.get(log.resident_id);
            if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
                latestStatusMap.set(log.resident_id, log);
            }
        });

        // 4. Calculate stats based on latest statuses
        const newStats = { Safe: 0, Evacuated: 0, Injured: 0, Missing: 0, Deceased: 0, Unknown: 0 };
        const latestLogs = Array.from(latestStatusMap.values());
        
        latestLogs.forEach(log => {
            if (newStats[log.status] !== undefined) {
                newStats[log.status]++;
            }
        });

        const totalWithStatus = latestLogs.length;
        newStats.Unknown = affectedCount - totalWithStatus;
        setStats(newStats);

        // 5. Correctly calculate Evacuation Center Stats
        const { data: centers, error: centersError } = await supabase.from('evacuation_centers').select('id, name, capacity');
        if (centers && !centersError) {
            const occupancyMap = new Map<string, number>();
            latestLogs.forEach(log => {
                if(log.status === 'Evacuated' && log.evac_center_id) {
                    occupancyMap.set(log.evac_center_id, (occupancyMap.get(log.evac_center_id) || 0) + 1);
                }
            });

            const evacChartData = centers.map(center => ({
                name: center.name,
                occupancy: occupancyMap.get(center.id) || 0,
                capacity: center.capacity
            })).filter(d => d.capacity > 0 || d.occupancy > 0);
            setEvacStats(evacChartData);
        }

        setIsLoading(false);
    }, [supabase, showToast, filterMunicipality, filterBarangay]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleGenerateSummary = async () => {
        setIsSummaryLoading(true);
        setAiSummary('');
        const summary = await generateDashboardSummary({...stats, total_affected_population: Number(totalAffected)});
        setAiSummary(summary);
        setIsSummaryLoading(false);
    };
    
    const chartData = Object.entries(stats).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
    const PIE_COLORS = { 
      Safe: '#3B82F6', Evacuated: '#FBBF24', Injured: '#F97316', 
      Missing: '#38BDF8', Deceased: '#EF4444', Unknown: '#6B7280'
    };


    if (isLoading && !activeEvent) {
        return <div className="text-center p-10"><Icon name="fa-spinner" className="fa-spin text-blue-600 text-3xl"/></div>;
    }

    if (!activeEvent) {
        return (
            <GlassCard>
                <div className="m-auto text-center p-10">
                    <Icon name="fa-exclamation-circle" className="text-4xl text-yellow-500 mb-4" />
                    <h2 className="text-2xl font-semibold text-slate-900">No Active Events</h2>
                    <p className="text-slate-700">Please go to the Events page to create or activate an event.</p>
                </div>
            </GlassCard>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Dashboard</h2>
                <div className="text-sm font-medium text-slate-800 bg-white/30 backdrop-blur-md px-3 py-1 rounded-full shadow-lg text-center sm:text-left">
                    Active Event: <span className="font-bold text-blue-900">{activeEvent.name}</span>
                </div>
            </div>
            
            <GlassCard>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <h3 className="font-semibold text-slate-900 flex-shrink-0">Filters</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                        <Select label="Municipality" value={filterMunicipality} onChange={e => setFilterMunicipality(e.target.value)}>
                            <option value="all">All Municipalities</option>
                            {Object.keys(locationData).sort().map(muni => <option key={muni} value={muni}>{muni}</option>)}
                        </Select>
                        <Select label="Barangay" value={filterBarangay} onChange={e => setFilterBarangay(e.target.value)} disabled={filterMunicipality === 'all'}>
                            <option value="all">All Barangays</option>
                            {filterMunicipality !== 'all' && locationData[filterMunicipality] &&
                                locationData[filterMunicipality].sort().map(brgy => <option key={brgy} value={brgy}>{brgy}</option>)
                            }
                        </Select>
                    </div>
                </div>
            </GlassCard>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="Affected Pop." value={isLoading ? '...' : totalAffected} icon="fa-users" color="text-slate-600" />
                <StatCard title="Safe" value={isLoading ? '...' : stats.Safe} icon="fa-house-user" color="text-blue-500" />
                <StatCard title="Evacuated" value={isLoading ? '...' : stats.Evacuated} icon="fa-person-shelter" color="text-yellow-500" />
                <StatCard title="Injured" value={isLoading ? '...' : stats.Injured} icon="fa-kit-medical" color="text-orange-500" />
                <StatCard title="Missing" value={isLoading ? '...' : stats.Missing} icon="fa-magnifying-glass" color="text-sky-500" />
                <StatCard title="Deceased" value={isLoading ? '...' : stats.Deceased} icon="fa-cross" color="text-red-500" />
            </div>

            <GlassCard>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-slate-900">AI-Powered Summary</h3>
                    <Button onClick={handleGenerateSummary} isLoading={isSummaryLoading} variant="secondary" size="sm" disabled={isLoading}>
                        <Icon name="fa-wand-magic-sparkles" className="mr-2"/>
                        Generate
                    </Button>
                </div>
                {isSummaryLoading && <p className="text-slate-700 text-sm">Generating summary...</p>}
                {aiSummary && <p className="text-slate-800 bg-black/5 p-4 rounded-lg whitespace-pre-wrap">{aiSummary}</p>}
                {isLoading && !aiSummary && <p className="text-slate-700 text-sm">Data loading, please wait to generate summary.</p>}
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Resident Status Breakdown</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.3)" />
                                <XAxis dataKey="name" fontSize={12} tick={{ fill: '#334155' }} />
                                <YAxis tick={{ fill: '#334155' }} allowDecimals={false}/>
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '0.75rem' }} />
                                <Bar dataKey="value" fill="rgba(59, 130, 246, 0.7)">
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} />
                                  ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 </GlassCard>
                 <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Status Proportions</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {chartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '0.75rem' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                 </GlassCard>
                  <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Evacuation Center Occupancy</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={evacStats} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(150,150,150,0.3)" />
                                <XAxis type="number" tick={{ fill: '#334155' }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#334155' }} fontSize={12} width={100} interval={0} />
                                <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(5px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '0.75rem' }} />
                                <Legend />
                                <Bar dataKey="occupancy" fill="rgba(251, 191, 36, 0.8)" name="Occupancy" stackId="a" />
                                <Bar dataKey="capacity" fill="rgba(59, 130, 246, 0.5)" name="Total Capacity" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                 </GlassCard>
                 <GlassCard>
                    <h3 className="font-semibold text-slate-900 mb-4">Map View</h3>
                    <div className="h-80 z-0 relative">
                        <LeafletMap event={activeEvent} />
                    </div>
                 </GlassCard>
            </div>
        </div>
    );
};

export default DashboardPage;