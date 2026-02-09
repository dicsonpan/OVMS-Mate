
import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';

console.log('================================================');
console.log('   OVMS MATE LOGGER - BMW i3 PRECISION v8      ');
console.log('================================================');

// --- CONFIGURATION ---
const CONFIG = {
  mqttUser: process.env.OVMS_USER || process.env.OVMS_ID,
  vehicleId: process.env.OVMS_ID,
  password: process.env.OVMS_PASS,
  server: process.env.OVMS_SERVER, 
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
  batchInterval: 5000,
  parkTimeoutSeconds: 900, // 15 mins of parking to end a drive
  chargeTimeoutSeconds: 120,
  minDriveDistance: 0.2, // Min 200m to keep a drive record
};

const supabase = (CONFIG.supabaseUrl && CONFIG.supabaseKey) 
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) 
  : null;

const client = mqtt.connect(CONFIG.server.includes('://') ? CONFIG.server : `mqtt://${CONFIG.server}:1883`, {
  username: CONFIG.mqttUser,
  password: CONFIG.password,
  clean: true,
});

// --- STATE ---
let currentState = {
  v_type: 'Unknown',
  soc: 0,
  soh: 100,
  voltage: 0,
  speed: 0,
  odometer: 0,
  park_time: 0,
  isOn: false,
  gear: 'P',
  locked: false,
  
  // Temperatures
  temp_ambient: 0,
  temp_battery: 0,
  temp_motor: 0,
  temp_cabin: 0,

  // BMW i3 Specifics
  i3_pilot_current: 0,
  i3_plug_status: 'Not connected',

  // GPS/Env
  elevation: 0,
  gps_sats: 0,
  latitude: 0,
  longitude: 0,
  direction: 0,
  gps_lock: false,

  // Sessions
  isDriving: false,
  currentDriveId: null,
  driveStartTime: null,
  driveStartOdo: 0,
  driveStartSoc: 0,

  isCharging: false,
  currentChargeId: null,
  chargeStartTime: null,
  chargeStartSoc: 0,
  chargeChartData: [],
  chargePower: 0,

  rawMetrics: {}, 
  carMetrics: {}, 
  isDirty: false
};

const DB_MAP = {
  'v.type': 'v_type',
  'v.b.soc': 'soc',
  'v.b.soh': 'soh',
  'v.b.voltage': 'voltage',
  'v.p.speed': 'speed',
  'v.p.odometer': 'odometer',
  'v.e.gear': 'gear',
  'v.e.on': 'isOn',
  'v.e.parktime': 'park_time',
  'v.e.locked': 'locked',
  'v.p.altitude': 'elevation',
  'v.p.satcount': 'gps_sats',
  'v.p.latitude': 'latitude',
  'v.p.longitude': 'longitude',
  'v.p.direction': 'direction',
  'v.p.gpslock': 'gps_lock',
  'v.e.temp': 'temp_ambient',
  'v.b.temp': 'temp_battery',
  'v.m.temp': 'temp_motor',
  'v.e.cabintemp': 'temp_cabin',
  'v.b.12v.current': 'v12current',
  'v.b.12v.voltage': 'v12voltage',
  'v.b.power': 'power',
  'v.c.state': 'charge_state',
  'v.c.kwh': 'charge_kwh',
  'v.c.power': 'charge_power',
  'xi3.v.c.pilotsignal': 'i3_pilot_current',
  'xi3.v.c.chargeplugstatus': 'i3_plug_status'
};

const parseValue = (val) => {
  if (typeof val !== 'string') return val;
  const lval = val.toLowerCase().trim();
  if (lval === 'yes' || lval === 'true') return true;
  if (lval === 'no' || lval === 'false') return false;
  const match = val.match(/(-?\d+(\.\d+)?)/);
  return match ? parseFloat(match[0]) : val.trim();
};

const handleStateTransitions = async () => {
  if (!supabase) return;

  const isI3 = currentState.v_type === 'BMWI3' || currentState.v_type === 'RT';
  
  // 1. Driving Logic
  const isMoving = currentState.speed > 0 || (currentState.gear !== 'P' && currentState.gear !== 0 && currentState.gear !== 'N');
  const isCurrentlyDriving = currentState.isOn && isMoving;

  if (isCurrentlyDriving && !currentState.isDriving && currentState.odometer > 0) {
      // START DRIVE
      console.log(`[Drive] Session START at ${currentState.odometer}km`);
      currentState.isDriving = true;
      currentState.driveStartTime = new Date();
      currentState.driveStartOdo = currentState.odometer;
      currentState.driveStartSoc = currentState.soc;
      const { data } = await supabase.from('drives').insert({
        vehicle_id: CONFIG.vehicleId, start_date: currentState.driveStartTime.toISOString(),
        start_soc: currentState.soc, start_odometer: currentState.odometer, distance: 0, duration: 0, path: []
      }).select().single();
      if (data) currentState.currentDriveId = data.id;
  } else if (!isCurrentlyDriving && currentState.isDriving) {
      // Check if we should end the drive (parked for threshold or car turned off)
      const shouldEnd = !currentState.isOn || currentState.park_time > CONFIG.parkTimeoutSeconds;
      
      if (shouldEnd && currentState.currentDriveId) {
          const finalDistance = currentState.odometer - currentState.driveStartOdo;
          const finalDuration = Math.round((new Date() - currentState.driveStartTime) / 60000);
          
          if (finalDistance >= CONFIG.minDriveDistance) {
              console.log(`[Drive] Session END. Distance: ${finalDistance.toFixed(2)}km`);
              // Basic efficiency estimation for i3 (Wh/km)
              const socDrop = currentState.driveStartSoc - currentState.soc;
              // Assuming 33kWh usable for i3 94Ah, 1% = 0.33kWh = 330Wh
              const estimatedEnergyUsedWh = Math.max(0, socDrop * 330); 
              const efficiency = finalDistance > 0 ? Math.round(estimatedEnergyUsedWh / finalDistance) : 0;

              await supabase.from('drives').update({ 
                end_date: new Date().toISOString(),
                end_soc: currentState.soc,
                end_odometer: currentState.odometer,
                distance: finalDistance,
                duration: finalDuration,
                consumption: estimatedEnergyUsedWh / 1000,
                efficiency: efficiency
              }).eq('id', currentState.currentDriveId);
          } else {
              console.log(`[Drive] Session DISCARDED (too short: ${finalDistance.toFixed(3)}km)`);
              await supabase.from('drives').delete().eq('id', currentState.currentDriveId);
          }
          currentState.isDriving = false;
          currentState.currentDriveId = null;
      }
  }

  // 2. Charging Logic
  let isCurrentlyCharging = false;
  if (isI3) {
    isCurrentlyCharging = (currentState.i3_pilot_current > 0) && (currentState.i3_plug_status === 'Connected');
    currentState.chargePower = (currentState.i3_pilot_current * 220) / 1000;
  } else {
    const activeStates = ['charging', 'topoff', 'prepare', 'heating'];
    isCurrentlyCharging = activeStates.includes(currentState.charge_state?.toLowerCase());
    currentState.chargePower = currentState.charge_power || 0;
  }

  if (isCurrentlyCharging) {
    if (!currentState.isCharging) {
      currentState.isCharging = true;
      currentState.chargeStartTime = new Date();
      currentState.chargeStartSoc = currentState.soc;
      const { data } = await supabase.from('charges').insert({
        vehicle_id: CONFIG.vehicleId, date: currentState.chargeStartTime.toISOString(),
        location: currentState.latitude ? 'Location' : 'Unknown', start_soc: currentState.soc,
        added_kwh: 0, duration: 0, chart_data: []
      }).select().single();
      if (data) currentState.currentChargeId = data.id;
    } else {
      const duration = Math.round((new Date() - currentState.chargeStartTime) / 60000);
      await supabase.from('charges').update({
        duration: duration, end_soc: currentState.soc,
        max_power: Math.max(0, currentState.chargePower)
      }).eq('id', currentState.currentChargeId);
    }
  } else if (currentState.isCharging) {
    await supabase.from('charges').update({ end_date: new Date().toISOString() }).eq('id', currentState.currentChargeId);
    currentState.isCharging = false;
    currentState.currentChargeId = null;
  }
};

client.on('message', (topic, message) => {
  const metricPath = topic.split('/metric/')[1];
  if (!metricPath) return;
  const key = metricPath.replace(/\//g, '.');
  const val = parseValue(message.toString());
  const col = DB_MAP[key];
  if (col) currentState[col] = val;
  if (key.startsWith('v.')) currentState.rawMetrics[key] = val;
  else currentState.carMetrics[key] = val;
  currentState.isDirty = true;
});

setInterval(async () => {
  if (!supabase) return;
  await handleStateTransitions();
  if (currentState.isDirty) {
    const payload = {
      vehicle_id: CONFIG.vehicleId, timestamp: Date.now(),
      raw_metrics: currentState.rawMetrics, car_metrics: currentState.carMetrics,
      soc: currentState.soc, soh: currentState.soh, speed: currentState.speed,
      odometer: currentState.odometer, voltage: currentState.voltage, 
      current_12v: currentState.v12current, voltage_12v: currentState.v12voltage,
      temp_ambient: currentState.temp_ambient, temp_battery: currentState.temp_battery,
      temp_motor: currentState.temp_motor, inside_temp: currentState.temp_cabin,
      gear: currentState.gear, park_time: currentState.park_time, 
      power: currentState.isCharging ? currentState.chargePower : (currentState.power || 0),
      latitude: currentState.latitude, longitude: currentState.longitude,
      elevation: currentState.elevation, direction: currentState.direction,
      gps_lock: currentState.gps_lock, gps_sats: currentState.gps_sats,
      locked: currentState.locked, charge_state: currentState.isCharging ? 'charging' : 'stopped'
    };
    await supabase.from('telemetry').insert(payload);
    currentState.isDirty = false;
  }
}, CONFIG.batchInterval);

client.on('connect', () => {
  console.log('[MQTT] Connected to Server');
  client.subscribe(`ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/metric/#`);
});
