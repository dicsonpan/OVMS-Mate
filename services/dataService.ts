
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
           rangeEst: data.range_est,
           speed: data.speed,
           odometer: data.odometer,
           tripDistance: data.trip_distance,
           tripConsumptionAvg: data.trip_consumption,
           consumptionInst: data.consumption_inst,
           motorRpm: data.motor_rpm,
           tripEnergyUsed: data.trip_energy,
           power: data.power || 0,
           voltage: data.voltage || 0,
           current: data.current || 0,
           voltage12v: data.voltage_12v,
           current12v: data.current_12v,
           chargeState: data.charge_pilot_a > 0 ? 'Charging' : 'Stopped',
           chargePilotA: data.charge_pilot_a,
           chargePlugStatus: data.charge_plug_status,
           tempBattery: data.temp_battery || 0,
           tempMotor: data.temp_motor || 0,
           tempAmbient: data.temp_ambient || 0,
           insideTemp: data.inside_temp,
           chargerTemp: data.charger_temp,
           ventMode: data.vent_mode,
           acStatus: data.ac_status,
           latitude: data.latitude,
           longitude: data.longitude,
           elevation: data.elevation || 0,
           locationName: data.location_name,
           gpsSats: data.gps_sats,
           gpsQuality: data.gps_quality,
           locked: data.locked,
           carOn: data.car_on,
           gear: data.gear,
           parkTime: data.park_time,
           driveTime: data.drive_time,
           lastUpdateAge: data.last_update_age,
           doorFL: data.door_fl,
           doorFR: data.door_fr,
           doorRL: data.door_rl,
           doorRR: data.door_rr,
           doorHood: data.door_hood,
           doorTrunk: data.door_trunk,
           doorChargePort: data.door_cp,
           rawMetrics: data.raw_metrics,
           carMetrics: data.car_metrics
        } as TelemetryData;
      }
    } catch (e) { console.warn("Fetch telemetry failed:", e); }
  }
  return getLiveTelemetry();
};

interface FetchDrivesOptions {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

export const fetchDrives = async (options: FetchDrivesOptions = {}): Promise<DriveSession[]> => {
  const { limit = 10, offset = 0, startDate, endDate } = options;

  if (isSupabaseConfigured() && supabase) {
    try {
      let query = supabase
        .from('drives')
        .select('*')
        .order('start_date', { ascending: false });

      if (startDate) {
        // Start of the day for start date
        query = query.gte('start_date', `${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        // End of the day for end date
        query = query.lte('start_date', `${endDate}T23:59:59.999Z`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data } = await query;
        
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
    } catch (e) { console.warn("Fetch drives failed:", e); }
  }

  // Fallback / Mock Data filtering simulation
  let filteredMock = [...MOCK_DRIVES];
  if (startDate) {
    filteredMock = filteredMock.filter(d => new Date(d.startDate) >= new Date(startDate));
  }
  if (endDate) {
    filteredMock = filteredMock.filter(d => new Date(d.startDate) <= new Date(`${endDate}T23:59:59Z`));
  }
  // Sort descending
  filteredMock.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  
  // Pagination
  return filteredMock.slice(offset, offset + limit);
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
    } catch (e) { console.warn("Fetch charges failed:", e); }
  }
  return MOCK_CHARGES;
};
