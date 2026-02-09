
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { MOCK_DRIVES, MOCK_CHARGES, getLiveTelemetry } from './mockData';
import { DriveSession, ChargeSession, TelemetryData } from '../types';

export const fetchLatestTelemetry = async (): Promise<TelemetryData> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase
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
           soh: data.soh,
           capacity: data.capacity,
           range: data.range,
           estRange: data.est_range,
           idealRange: data.ideal_range,
           speed: data.speed,
           odometer: data.odometer,
           power: data.power || 0,
           voltage: data.voltage || 0,
           current: data.current || 0,
           voltage12v: data.voltage_12v,
           current12v: data.current_12v,
           chargeState: data.charge_state || 'stopped',
           chargeMode: data.charge_mode,
           chargeKwh: data.charge_kwh,
           chargeTime: data.charge_time,
           chargeTemp: data.charge_temp,
           chargePilot: data.charge_pilot,
           chargeLimitSoc: data.charge_limit_soc,
           chargeLimitRange: data.charge_limit_range,
           chargeType: data.charge_type,
           tempBattery: data.temp_battery || 0,
           tempMotor: data.temp_motor || 0,
           tempAmbient: data.temp_ambient || 0,
           insideTemp: data.inside_temp,
           outsideTemp: data.outside_temp,
           latitude: data.latitude,
           longitude: data.longitude,
           elevation: data.elevation || 0,
           locationName: data.location_name,
           direction: data.direction,
           gpsLock: data.gps_lock,
           gpsSats: data.gps_sats,
           locked: data.locked,
           valet: data.valet,
           carAwake: data.car_awake,
           gear: data.gear,
           handbrake: data.handbrake,
           parkTime: data.park_time,
           // Handle i3 specifics from car_metrics if they are there
           i3PilotCurrent: data.car_metrics?.['xi3.v.c.pilotsignal'],
           i3LedState: data.car_metrics?.['xi3.v.c.chargeledstate'],
           i3PlugStatus: data.car_metrics?.['xi3.v.c.chargeplugstatus'],
           rawMetrics: data.raw_metrics,
           carMetrics: data.car_metrics
        } as TelemetryData;
      }
    } catch (e) { console.warn(e); }
  }
  return getLiveTelemetry();
};

export const fetchDrives = async (): Promise<DriveSession[]> => {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data } = await supabase
        .from('drives')
        .select('*')
        .order('start_date', { ascending: false })
        .limit(30);
        
      if (data) return data.map((d: any) => ({
          id: d.id,
          startDate: d.start_date,
          endDate: d.end_date,
          distance: d.distance !== null ? Number(d.distance.toFixed(2)) : 0,
          duration: d.duration || 0,
          consumption: d.consumption !== null ? Number(d.consumption.toFixed(2)) : 0,
          efficiency: d.efficiency || 0,
          startSoc: d.start_soc,
          endSoc: d.end_soc,
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
        .limit(20);
      if (data) return data.map((c: any) => ({
        id: c.id,
        date: c.date,
        endDate: c.end_date,
        location: c.location,
        addedKwh: c.added_kwh || 0,
        duration: c.duration || 0,
        avgPower: c.avg_power || 0,
        maxPower: c.max_power || 0,
        chartData: c.chart_data || []
      })) as ChargeSession[];
    } catch (e) { console.warn(e); }
  }
  return MOCK_CHARGES;
};
