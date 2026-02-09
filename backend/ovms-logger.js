import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';

console.log('================================================');
console.log('   OVMS MATE LOGGER - TESLAMATE EDITION        ');
console.log('================================================');

// --- CONFIGURATION ---
// 敏感数据必须通过环境变量传入，不再保留硬编码默认值
const CONFIG = {
  mqttUser: process.env.OVMS_USER || process.env.OVMS_ID,
  vehicleId: process.env.OVMS_ID,
  password: process.env.OVMS_PASS,
  server: process.env.OVMS_SERVER, 
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
  // Throttling: How often to write to DB (ms)
  batchInterval: 5000 
};

// 检查必要配置
if (!CONFIG.vehicleId || !CONFIG.server) {
  console.error("❌ ERROR: Missing required environment variables.");
  console.error("Please set OVMS_ID and OVMS_SERVER in your .env file or environment.");
  process.exit(1);
}

// Construct Broker URL
let serverInput = CONFIG.server;
let mqttUrl = serverInput.includes('://') ? serverInput : `mqtt://${serverInput}`;
if (!mqttUrl.split('://')[1].includes(':')) mqttUrl = `${mqttUrl}:1883`;

console.log(`[Config] User: ${CONFIG.mqttUser} | Car: ${CONFIG.vehicleId}`);
console.log(`[Config] Broker: ${mqttUrl}`);

// --- SUPABASE SETUP ---
const supabase = (CONFIG.supabaseUrl && CONFIG.supabaseKey) 
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) 
  : null;

if (!supabase) console.warn("[Warn] Supabase keys missing. Data will not be saved.");

// --- MQTT SETUP ---
const client = mqtt.connect(mqttUrl, {
  username: CONFIG.mqttUser,
  password: CONFIG.password,
  clientId: `ovms-mate-${Math.random().toString(16).substr(2, 8)}`,
  clean: true,
  reconnectPeriod: 5000,
});

// --- STATE MANAGEMENT ---
// We keep a local copy of the full vehicle state to detect changes
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
  // Buffer for metrics
  rawMetrics: {}, // v.* that are not mapped to columns
  carMetrics: {}, // xi3.*, leaf.*, etc. (Vehicle specific)
  // Flags
  isDirty: false,
  lastDbWrite: 0
};

// --- METRIC MAPPING ---
// Map OVMS metrics (v.* only) to our flat DB columns. 
// Keys are the DOT notation of the topic suffix (e.g. v/b/soc -> v.b.soc)
const DB_MAP = {
  // Battery & Range
  'v.b.soc': 'soc',
  'v.b.soh': 'soh',
  'v.b.capacity': 'capacity',
  'v.b.range.est': 'est_range',
  'v.b.range.ideal': 'ideal_range',
  'v.b.range.full': 'ideal_range', // Fallback
  
  // Electrical
  'v.b.voltage': 'voltage',
  'v.b.current': 'current',
  'v.b.power': 'power',
  'v.b.12v.voltage': 'voltage_12v',
  'v.b.12v.current': 'current_12v',
  
  // Charging
  'v.c.state': 'charge_state',
  'v.c.mode': 'charge_mode',
  'v.c.kwh': 'charge_kwh',
  'v.c.time': 'charge_time',
  'v.c.temp': 'charge_temp',
  'v.c.pilot': 'charge_pilot',
  'v.c.limit.soc': 'charge_limit_soc',
  'v.c.limit.range': 'charge_limit_range',
  'v.c.type': 'charge_type',
  
  // Driving & Location
  'v.p.speed': 'speed',
  'v.p.odometer': 'odometer',
  'v.p.latitude': 'latitude',
  'v.p.longitude': 'longitude',
  'v.p.altitude': 'elevation',
  'v.p.location': 'location_name',
  'v.p.direction': 'direction',
  'v.p.gpslock': 'gps_lock',
  'v.p.satcount': 'gps_sats',
  
  // Temperatures
  'v.b.temp': 'temp_battery',
  'v.m.temp': 'temp_motor',
  'v.e.temp': 'temp_ambient',     // Ambient temp usually
  'v.e.cabintemp': 'inside_temp',
  'v.e.temp.outside': 'outside_temp', // Sometimes available
  
  // Status
  'v.e.locked': 'locked',
  'v.e.valet': 'valet',
  'v.e.awake': 'car_awake',
  'v.e.gear': 'gear',
  'v.e.handbrake': 'handbrake',
  
  // TPMS (Scalar values)
  'v.tp.fl.p': 'tpms_fl',
  'v.tp.fr.p': 'tpms_fr',
  'v.tp.rl.p': 'tpms_rl',
  'v.tp.rr.p': 'tpms_rr',
};

// Helper: Parse OVMS values (remove units, handle bools, trim)
const parseValue = (val) => {
  if (typeof val !== 'string') return val;
  const lower = val.toLowerCase().trim();
  
  if (lower === 'yes' || lower === 'true') return true;
  if (lower === 'no' || lower === 'false') return false;
  
  // Remove common units to check if it's a number
  // e.g. "12.5 V" -> "12.5", "100 km" -> "100"
  // Regex looks for a number at the start, optionally followed by units
  const match = lower.match(/^(-?\d+(\.\d+)?)/);
  if (match) {
    const num = parseFloat(match[0]);
    if (!isNaN(num)) return num;
  }
  
  return val.trim(); // Return as string if not a simple boolean or number
};

// --- LOGIC: SESSION MANAGEMENT ---
const handleStateTransitions = async () => {
  const isDrivingNow = currentState.speed > 0 || currentState.gear === 'D' || currentState.gear === 'R';
  const isChargingNow = currentState.charge_state === 'charging' || currentState.charge_state === 'top-off';
  
  // 1. DRIVE START
  if (isDrivingNow && !currentState.isDriving) {
    console.log('[Session] Drive STARTED');
    currentState.isDriving = true;
    if (supabase) {
      const { data } = await supabase.from('drives').insert({
        vehicle_id: CONFIG.vehicleId,
        start_date: new Date().toISOString(),
        start_soc: currentState.soc,
        start_odometer: currentState.odometer,
        path: [] 
      }).select().single();
      if (data) currentState.currentDriveId = data.id;
    }
  }
  
  // 2. DRIVE END
  if (!isDrivingNow && currentState.isDriving) {
    console.log('[Session] Drive ENDED');
    currentState.isDriving = false;
    if (currentState.currentDriveId && supabase) {
      await supabase.from('drives').update({
        end_date: new Date().toISOString(),
        end_soc: currentState.soc,
        end_odometer: currentState.odometer,
        distance: currentState.odometer - (currentState.rawMetrics['v.p.odometer'] || currentState.odometer) // Approximation
      }).eq('id', currentState.currentDriveId);
      currentState.currentDriveId = null;
    }
  }

  // 3. CHARGE START
  if (isChargingNow && !currentState.isCharging) {
    console.log('[Session] Charge STARTED');
    currentState.isCharging = true;
    if (supabase) {
      const { data } = await supabase.from('charges').insert({
        vehicle_id: CONFIG.vehicleId,
        date: new Date().toISOString(),
        start_soc: currentState.soc,
        location: currentState.location_name || 'Unknown',
        chart_data: []
      }).select().single();
      if (data) currentState.currentChargeId = data.id;
    }
  }

  // 4. CHARGE END
  if (!isChargingNow && currentState.isCharging) {
    console.log('[Session] Charge ENDED');
    currentState.isCharging = false;
    if (currentState.currentChargeId && supabase) {
      await supabase.from('charges').update({
        end_date: new Date().toISOString(),
        end_soc: currentState.soc,
        added_kwh: currentState.charge_kwh || 0
      }).eq('id', currentState.currentChargeId);
      currentState.currentChargeId = null;
    }
  }
};

// --- MQTT EVENTS ---

client.on('connect', () => {
  console.log('[MQTT] ✅ Connected!');
  // Subscribe to ALL metrics except client notifications (m)
  const topic = `ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/metric/#`; 
  client.subscribe(topic, (err) => {
    if (!err) console.log(`[MQTT] Subscribed to ${topic}`);
  });
});

client.on('message', (topic, message) => {
  const parts = topic.split('/metric/');
  if (parts.length < 2) return;
  
  const metricPath = parts[1]; // e.g., "v/b/soc" or "xi3/v/b/soc"
  
  // Filter out unwanted metrics (e.g. m.* messages)
  if (metricPath.startsWith('m/')) return;

  const rawValue = message.toString();
  const value = parseValue(rawValue);
  
  // Normalize key to dots: "v/b/soc" -> "v.b.soc"
  const normalizedKey = metricPath.replace(/\//g, '.');
  
  // --- SEPARATION LOGIC ---
  if (normalizedKey.startsWith('v.')) {
    // 1. Public / Standard Metrics (v.*)
    const dbCol = DB_MAP[normalizedKey];
    if (dbCol) {
      // It maps to a top-level column in 'telemetry' table
      currentState[dbCol] = value;
    } else {
      // It's a standard metric but we don't have a column for it -> raw_metrics
      currentState.rawMetrics[normalizedKey] = value;
    }
  } else {
    // 2. Vehicle Specific Metrics (xi3.*, leaf.*, etc.)
    // These always go to 'car_metrics' JSONB column
    currentState.carMetrics[normalizedKey] = value;
  }
  
  currentState.isDirty = true;
});

// --- SYNC LOOP ---
setInterval(async () => {
  if (!currentState.isDirty) return;
  if (!supabase) return;

  // 1. Process Logic
  await handleStateTransitions();

  // 2. Prepare Payload
  const payload = {
    vehicle_id: CONFIG.vehicleId,
    timestamp: Date.now(),
    raw_metrics: currentState.rawMetrics,
    car_metrics: currentState.carMetrics
  };
  
  // Add mapped columns if they exist in state
  Object.values(DB_MAP).forEach(col => {
    if (currentState[col] !== undefined) payload[col] = currentState[col];
  });
  
  // 3. Write to Telemetry
  const { error } = await supabase.from('telemetry').insert(payload);
  
  if (error) console.error('[Supabase] Insert Error:', error.message);
  else console.log(`[Sync] 💾 Saved. Speed:${currentState.speed} SoC:${currentState.soc}% 12V:${currentState.voltage_12v}`);
  
  currentState.isDirty = false;
  currentState.lastDbWrite = Date.now();

}, CONFIG.batchInterval);

// Keep alive
process.stdin.resume();
