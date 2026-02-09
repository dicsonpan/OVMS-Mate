import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';

console.log('================================================');
console.log('   OVMS MATE LOGGER - FULL DATA MODE           ');
console.log('================================================');

// --- CONFIGURATION ---
const CONFIG = {
  mqttUser: process.env.OVMS_USER || process.env.OVMS_ID,
  vehicleId: process.env.OVMS_ID,
  password: process.env.OVMS_PASS,
  server: process.env.OVMS_SERVER, 
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
  batchInterval: 5000 
};

// 检查必要配置
if (!CONFIG.vehicleId || !CONFIG.server) {
  console.error("❌ ERROR: Missing required environment variables.");
  console.error("Please set OVMS_ID and OVMS_SERVER in your .env file.");
  process.exit(1);
}

// Construct Broker URL
let serverInput = CONFIG.server;
let mqttUrl = serverInput.includes('://') ? serverInput : `mqtt://${serverInput}`;
if (!mqttUrl.split('://')[1].includes(':')) mqttUrl = `${mqttUrl}:1883`;

console.log(`[Config] User: ${CONFIG.mqttUser} | Car: ${CONFIG.vehicleId}`);
console.log(`[Config] Broker: ${mqttUrl}`);
console.log(`[Config] Supabase: ${CONFIG.supabaseUrl ? 'Configured' : 'MISSING'}`);

// --- SUPABASE SETUP ---
const supabase = (CONFIG.supabaseUrl && CONFIG.supabaseKey) 
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) 
  : null;

// --- DEBUG: TEST SUPABASE CONNECTION ---
const testSupabaseConnection = async () => {
  if (!supabase) return;
  console.log('[Debug] Testing Supabase connection...');
  try {
    // 尝试读取一行数据来测试连接
    const { data, error } = await supabase.from('telemetry').select('count').limit(1).single();
    if (error) {
        console.error('❌ [Supabase] Connection Test FAILED:', error.message);
        console.error('   Hint: Check your VITE_SUPABASE_URL, ANON_KEY, and RLS Policies.');
    } else {
        console.log('✅ [Supabase] Connection verified. Database is reachable.');
    }
  } catch (err) {
    console.error('❌ [Supabase] Unexpected error during test:', err);
  }
};
testSupabaseConnection();

// --- MQTT SETUP ---
const client = mqtt.connect(mqttUrl, {
  username: CONFIG.mqttUser,
  password: CONFIG.password,
  clientId: `ovms-mate-${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  reconnectPeriod: 5000,
});

// --- STATE MANAGEMENT ---
let currentState = {
  // Core
  soc: 0,
  range: 0,
  speed: 0,
  odometer: 0,
  charge_state: 'stopped',
  latitude: 0,
  longitude: 0,
  // Derived
  isDriving: false,
  isCharging: false,
  // Session IDs
  currentDriveId: null,
  currentChargeId: null,
  // Buffer
  rawMetrics: {}, 
  carMetrics: {}, 
  // Flags
  isDirty: false,
  lastDbWrite: 0
};

// --- METRIC MAPPING ---
// Keys are the DOT notation of the topic suffix (e.g. v/b/soc -> v.b.soc)
const DB_MAP = {
  'v.b.soc': 'soc',
  'v.b.soh': 'soh',
  'v.b.capacity': 'capacity',
  'v.b.range.est': 'est_range',
  'v.b.range.ideal': 'ideal_range',
  'v.b.range.full': 'ideal_range', 
  'v.b.voltage': 'voltage',
  'v.b.current': 'current',
  'v.b.power': 'power',
  'v.b.12v.voltage': 'voltage_12v',
  'v.b.12v.current': 'current_12v',
  'v.c.state': 'charge_state',
  'v.c.mode': 'charge_mode',
  'v.c.kwh': 'charge_kwh',
  'v.c.time': 'charge_time',
  'v.c.temp': 'charge_temp',
  'v.c.pilot': 'charge_pilot',
  'v.c.limit.soc': 'charge_limit_soc',
  'v.c.limit.range': 'charge_limit_range',
  'v.c.type': 'charge_type',
  'v.p.speed': 'speed',
  'v.p.odometer': 'odometer',
  'v.p.latitude': 'latitude',
  'v.p.longitude': 'longitude',
  'v.p.altitude': 'elevation',
  'v.p.location': 'location_name',
  'v.p.direction': 'direction',
  'v.p.gpslock': 'gps_lock',
  'v.p.satcount': 'gps_sats',
  'v.b.temp': 'temp_battery',
  'v.m.temp': 'temp_motor',
  'v.e.temp': 'temp_ambient',     
  'v.e.cabintemp': 'inside_temp',
  'v.e.temp.outside': 'outside_temp', 
  'v.e.locked': 'locked',
  'v.e.valet': 'valet',
  'v.e.awake': 'car_awake',
  'v.e.gear': 'gear',
  'v.e.handbrake': 'handbrake',
  'v.tp.fl.p': 'tpms_fl',
  'v.tp.fr.p': 'tpms_fr',
  'v.tp.rl.p': 'tpms_rl',
  'v.tp.rr.p': 'tpms_rr',
};

const parseValue = (val) => {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase().trim();
  if (lower === 'yes' || lower === 'true') return true;
  if (lower === 'no' || lower === 'false') return false;
  const match = lower.match(/^(-?\d+(\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[0]);
    if (!isNaN(num)) return num;
  }
  return val.trim();
};

// --- LOGIC: SESSION MANAGEMENT ---
const handleStateTransitions = async () => {
  const isDrivingNow = currentState.speed > 0 || currentState.gear === 'D' || currentState.gear === 'R';
  const isChargingNow = currentState.charge_state === 'charging' || currentState.charge_state === 'top-off';
  
  if (isDrivingNow && !currentState.isDriving) {
    console.log('[Session] Drive STARTED');
    currentState.isDriving = true;
    if (supabase) {
      const { data, error } = await supabase.from('drives').insert({
        vehicle_id: CONFIG.vehicleId,
        start_date: new Date().toISOString(),
        start_soc: currentState.soc,
        start_odometer: currentState.odometer,
        path: [] 
      }).select().single();
      if (error) console.error('[Session] Drive Start Error:', error.message);
      if (data) currentState.currentDriveId = data.id;
    }
  }
  
  if (!isDrivingNow && currentState.isDriving) {
    console.log('[Session] Drive ENDED');
    currentState.isDriving = false;
    if (currentState.currentDriveId && supabase) {
      await supabase.from('drives').update({
        end_date: new Date().toISOString(),
        end_soc: currentState.soc,
        end_odometer: currentState.odometer,
        distance: currentState.odometer - (currentState.rawMetrics['v.p.odometer'] || currentState.odometer)
      }).eq('id', currentState.currentDriveId);
      currentState.currentDriveId = null;
    }
  }

  if (isChargingNow && !currentState.isCharging) {
    console.log('[Session] Charge STARTED');
    currentState.isCharging = true;
    if (supabase) {
      const { data, error } = await supabase.from('charges').insert({
        vehicle_id: CONFIG.vehicleId,
        date: new Date().toISOString(),
        start_soc: currentState.soc,
        location: currentState.location_name || 'Unknown',
        chart_data: []
      }).select().single();
      if (error) console.error('[Session] Charge Start Error:', error.message);
      if (data) currentState.currentChargeId = data.id;
    }
  }

  if (!isChargingNow && currentState.isCharging) {
    console.log('[Session] Charge ENDED');
    currentState.isCharging = false;
    if (currentState.currentChargeId && supabase) {
      await supabase.from('charges').update({
        end_date: new Date().toISOString(),
        end_soc: currentState.soc,
        end_odometer: currentState.odometer,
        added_kwh: currentState.charge_kwh || 0
      }).eq('id', currentState.currentChargeId);
      currentState.currentChargeId = null;
    }
  }
};

// --- MQTT EVENTS ---

client.on('connect', () => {
  console.log('[MQTT] ✅ Connected to broker!');
  const topic = `ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/metric/#`; 
  client.subscribe(topic, (err) => {
    if (!err) console.log(`[MQTT] Subscribed to ALL metrics: ${topic}`);
    else console.error(`[MQTT] Subscription failed:`, err);
  });
});

client.on('error', (err) => {
    console.error('[MQTT] Connection Error:', err.message);
});

let msgCount = 0;
client.on('message', (topic, message) => {
  const parts = topic.split('/metric/');
  if (parts.length < 2) return;
  const metricPath = parts[1];
  if (metricPath.startsWith('m/')) return;

  const rawValue = message.toString();
  const value = parseValue(rawValue);
  const normalizedKey = metricPath.replace(/\//g, '.');
  
  if (normalizedKey.startsWith('v.')) {
    const dbCol = DB_MAP[normalizedKey];
    if (dbCol) {
      currentState[dbCol] = value;
    } else {
      currentState.rawMetrics[normalizedKey] = value;
    }
  } else {
    // any key not starting with v. (like xi3. or leaf.)
    currentState.carMetrics[normalizedKey] = value;
  }
  
  currentState.isDirty = true;
  msgCount++;
});

// --- SYNC LOOP ---
setInterval(async () => {
  if (!currentState.isDirty) return;
  if (!supabase) return;

  await handleStateTransitions();

  const payload = {
    vehicle_id: CONFIG.vehicleId,
    timestamp: Date.now(),
    raw_metrics: currentState.rawMetrics,
    car_metrics: currentState.carMetrics
  };
  
  Object.values(DB_MAP).forEach(col => {
    if (currentState[col] !== undefined) payload[col] = currentState[col];
  });
  
  const { error } = await supabase.from('telemetry').insert(payload);
  
  if (error) {
      console.error('[Supabase] ❌ Insert Error:', error.message);
      if (error.message.includes("Could not find the") && error.message.includes("column")) {
          console.error("   💡 HINT: Database schema mismatch. Please run 'fix_db_schema.sql' in Supabase SQL Editor.");
      }
  } else {
      // Improved logging to reassure user that ALL data is being saved
      const mappedCount = Object.keys(payload).length - 4; // exclude ID, TS, and JSON blobs
      const rawCount = Object.keys(currentState.rawMetrics).length;
      const carCount = Object.keys(currentState.carMetrics).length;
      
      console.log(`[Sync] 💾 Saved Full Telemetry Snapshot:`);
      console.log(`       → Mapped Columns: ${mappedCount} (Speed, SoC, Voltage, TPMS...)`);
      console.log(`       → Raw Metrics:    ${rawCount} items`);
      console.log(`       → Car Specific:   ${carCount} items`);
      console.log(`       → Summary:        Speed:${currentState.speed}km/h | SoC:${currentState.soc}% | Odo:${currentState.odometer}km`);
  }
  
  currentState.isDirty = false;
  currentState.lastDbWrite = Date.now();

}, CONFIG.batchInterval);

process.stdin.resume();