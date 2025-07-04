
export interface User {
  id: string;
  email?: string;
  role: 'admin' | 'encoder' | 'viewer';
  assigned_area?: string;
}

export type ResidentStatus = 'Safe' | 'Evacuated' | 'Injured' | 'Missing' | 'Deceased' | 'Unknown';

export interface Resident {
  id: string;
  created_at?: string;
  first_name: string;
  last_name: string;
  dob?: string;
  age?: number;
  sex?: 'M' | 'F' | 'O';
  municipality: string;
  barangay: string;
  purok?: string;
  street?: string;
  is_pwd?: boolean;
  head_of_family_name?: string;
  is_head_of_family?: boolean;
  user_id?: string;
  status?: ResidentStatus;
  evac_center_id?: string;
  full_name?: string; // For RPC results
}

export type EventStatus = 'Active' | 'Monitoring' | 'Resolved';
export type EventType = 'Storm' | 'Fire' | 'Landslide' | 'Earthquake' | 'Flood' | 'Other';

export interface DisasterEvent {
  id: string;
  created_at: string;
  name: string;
  type: EventType;
  status: EventStatus;
  description?: string;
  affected_locations: {
    municipalities: string[];
    barangays: string[];
  };
}

export interface Incident {
    id: string;
    timestamp: string;
    event: { name: string };
    resident: { first_name: string, last_name: string, barangay: string, municipality: string };
    type: string;
    description: string;
    photo_url?: string;
}

export interface EvacuationCenter {
    id: string;
    name: string;
    barangay: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    capacity: number;
    occupancy?: number;
}

export interface LocationData {
    [municipality: string]: string[];
}