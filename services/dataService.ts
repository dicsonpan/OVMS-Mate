import { supabase, isSupabaseConfigured } from './supabaseClient';
import { MOCK_DRIVES, MOCK_CHARGES, getLiveTelemetry } from './mockData';
import { DriveSession, ChargeSession, TelemetryData } from '../types';

/**
 * Fetches the latest vehicle telemetry.
 * Reads from Supabase 'telemetry' table where the Logger puts data.
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

      if (data) {
        return {
           vehicleId: data.vehicle_id,
           timestamp: data.timestamp,
           soc: data.soc,
           range: data.range,
           estRange: data.est_range,
           idealRange: data.ideal_range,
           speed: data.speed,
           power: data.power || 0,
           voltage: data.voltage || 0,
           current: data.current || 0,
           chargeState: data.charge_state || 'stopped',
           odometer: data.odometer,
           tempBattery: data.temp_battery || 0,
           tempMotor: data.temp_motor || 0,
           tempAmbient: data.temp_ambient || 0,
           latitude: data.latitude,
           longitude: data.longitude,
           elevation: 0,
           locationName: data.location_name
        } as TelemetryData;
      }
    } catch (e) {
      console.warn("Failed to fetch live data from Supabase", e);
    }
  }
  
  return getLiveTelemetry();
};

export const fetchDrives = async (): Promise<DriveSession[]> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase
        .from('drives')
        .select('*')
        .order('startDate', { ascending: false })
        .limit(10);
        
      if (data) return data.map((d: any) => ({
          ...d,
          path: d.path || [] 
      })) as DriveSession[];
    } catch (e) { console.warn(e); }
  }
  return MOCK_DRIVES;
};

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