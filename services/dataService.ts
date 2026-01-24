import { supabase, isSupabaseConfigured } from './supabaseClient';
import { MOCK_DRIVES, MOCK_CHARGES, getLiveTelemetry } from './mockData';
import { DriveSession, ChargeSession, TelemetryData } from '../types';

/**
 * Fetches the latest vehicle telemetry.
 * If Supabase is connected, fetches from the 'telemetry' table.
 * Otherwise, returns mock data.
 */
export const fetchLatestTelemetry = async (): Promise<TelemetryData> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('telemetry')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (data) return data as TelemetryData;
    } catch (e) {
      console.warn("Failed to fetch live data from Supabase", e);
    }
  }
  return getLiveTelemetry();
};

/**
 * Fetches recent drives.
 * If Supabase is connected, fetches from 'drives' table.
 */
export const fetchDrives = async (): Promise<DriveSession[]> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('drives')
        .select('*')
        .order('startDate', { ascending: false })
        .limit(10);
        
      if (data) return data.map((d: any) => ({
          ...d,
          // If path is stored as JSON in Supabase, pass it through.
          // If stored in a separate table, we'd need a join here.
          path: d.path || [] 
      })) as DriveSession[];
    } catch (e) {
      console.warn("Failed to fetch drives", e);
    }
  }
  return MOCK_DRIVES;
};

/**
 * Fetches recent charges.
 */
export const fetchCharges = async (): Promise<ChargeSession[]> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase
        .from('charges')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);
      if (data) return data as ChargeSession[];
    } catch (e) { console.warn(e); }
  }
  return MOCK_CHARGES;
};
