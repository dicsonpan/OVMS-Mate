
import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';

console.log('================================================');
console.log('   OVMS MATE LOGGER - BMW i3 PRECISION v5      ');
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
  parkTimeoutSeconds: 1200, // 20 mins
  chargeTimeoutSeconds: 120,
  minDriveDistance: 0.1, 
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
  i3_led_state: 0,
  i3_plug_status: 'Not connected',
  i3_gate_temp: 0,
  i3_ready: false,

  // Driving Session
  isDriving: false,
  currentDriveId: null,
  currentDrivePath: [],
  driveStartTime: null,
  driveStartOdo: 0,
  driveStartSoc: 0,

  // Charging Session
  isCharging: false,
  currentChargeId: null,
  chargeStartTime: null,
  chargeStartSoc: 0,
  chargeChartData: [],
  chargeState: 'stopped',
  chargeKwh: 0,
  chargePower: 0,
  chargeHeadTemp: 0,

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
  
  // Temperature Mappings
  'v.e.temp': 'temp_ambient',
  'v.b.temp': 'temp_battery',
  'v.m.temp': 'temp_motor',
  'v.e.cabintemp': 'temp_cabin',
  
  'v.b.12v.current': 'v12current',
  'v.b.12v.voltage': 'v12voltage',
  'v.b.power': 'power',
  'v.p.latitude': 'latitude',
  'v.p.longitude': 'longitude',
  
  // Standard Charging (might be empty for i3)
  'v.c.state': 'charge_state',
  'v.c.kwh': 'charge_kwh',
  'v.c.power': 'charge_power',
  'v.c.temp': 'chargeHeadTemp',

  // BMW i3 Specific Charging Metrics
  'xi3.v.c.pilotsignal': 'i3_pilot_current',
  'xi3.v.c.chargeledstate': 'i3_led_state',
  'xi3.v.c.chargeplugstatus': 'i3_plug_status',
  'xi3.v.c.readytocharge': 'i3_ready',
  'xi3.v.c.temp.gatedriver': 'i3_gate_temp'
};

const parseValue = (val) => {
  if (typeof val !== 'string') return val;
  const lval = val.toLowerCase().trim();
  if (lval === 'yes' || lval === 'true') return true;
  if (lval === 'no' || lval === 'false') return false;
  const match = val.match(/(-?\d+(\.\d+)?)/);
  return match ? parseFloat(match[0]) : val.trim();
};

// --- LOGIC ---
const handleStateTransitions = async () => {
  if (!supabase) return;

  const isI3 = currentState.v_type === 'BMWI3' || currentState.v_type === 'RT';
  
  // 1. Driving Transitions
  const isCurrentlyDriving = currentState.isOn && (currentState.speed > 0 || (currentState.gear !== 'P' && currentState.gear !== 0));
  if (isCurrentlyDriving && !currentState.isDriving && currentState.odometer > 0) {
      currentState.isDriving = true;
      currentState.driveStartTime = new Date();
      currentState.driveStartOdo = currentState.odometer;
      currentState.driveStartSoc = currentState.soc;
      currentState.currentDrivePath = [];
      const { data } = await supabase.from('drives').insert({
        vehicle_id: CONFIG.vehicleId, start_date: currentState.driveStartTime.toISOString(),
        start_soc: currentState.soc, start_odometer: currentState.odometer, distance: 0, duration: 0, path: []
      }).select().single();
      if (data) currentState.currentDriveId = data.id;
  } else if (!isCurrentlyDriving && currentState.isDriving && currentState.park_time > CONFIG.parkTimeoutSeconds) {
      const currentDistance = currentState.odometer - currentState.driveStartOdo;
      if (currentDistance > CONFIG.minDriveDistance) {
         await supabase.from('drives').update({ end_date: new Date().toISOString() }).eq('id', currentState.currentDriveId);
      } else {
         await supabase.from('drives').delete().eq('id', currentState.currentDriveId);
      }
      currentState.isDriving = false;
      currentState.currentDriveId = null;
  }

  // 2. Charging Transitions (Enhanced for i3)
  let isCurrentlyCharging = false;
  let currentChargePower = 0;

  if (isI3) {
    // i3 Logic: LED > 0 (usually 3 or blue) and Plug is Connected
    isCurrentlyCharging = (currentState.i3_led_state > 0) && (currentState.i3_plug_status === 'Connected');
    // Calculate power: Pilot Current (A) * 220V / 1000 = kW
    currentChargePower = (currentState.i3_pilot_current * 220) / 1000;
    currentState.chargePower = currentChargePower;
  } else {
    // Standard OVMS
    const activeStates = ['charging', 'topoff', 'prepare', 'heating'];
    isCurrentlyCharging = activeStates.includes(currentState.charge_state?.toLowerCase());
    currentChargePower = currentState.charge_power || 0;
  }

  if (isCurrentlyCharging) {
    if (!currentState.isCharging) {
      console.log(`[Charge] Session START (Type: ${currentState.v_type}) Power: ${currentChargePower.toFixed(2)}kW`);
      currentState.isCharging = true;
      currentState.chargeStartTime = new Date();
      currentState.chargeStartSoc = currentState.soc;
      currentState.chargeChartData = [];
      const { data } = await supabase.from('charges').insert({
        vehicle_id: CONFIG.vehicleId, date: currentState.chargeStartTime.toISOString(),
        location: currentState.latitude ? 'Public' : 'Unknown', start_soc: currentState.soc,
        added_kwh: 0, duration: 0, chart_data: []
      }).select().single();
      if (data) currentState.currentChargeId = data.id;
    } else {
      const duration = Math.round((new Date() - currentState.chargeStartTime) / 60000);
      currentState.chargeChartData.push({
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        power: currentChargePower, soc: currentState.soc
      });
      if (currentState.chargeChartData.length > 500) currentState.chargeChartData.shift();

      // Energy calculation for i3 (integrate power over time)
      const estimatedAddedKwh = currentState.charge_kwh > 0 
        ? currentState.charge_kwh 
        : (currentChargePower * (duration / 60));

      await supabase.from('charges').update({
        added_kwh: estimatedAddedKwh, duration: duration, end_soc: currentState.soc,
        chart_data: currentState.chargeChartData, max_power: Math.max(0, currentChargePower)
      }).eq('id', currentState.currentChargeId);
    }
  } else if (currentState.isCharging) {
    console.log(`[Charge] Session END.`);
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
      temp_ambient: currentState.temp_ambient, 
      temp_battery: currentState.temp_battery,
      temp_motor: currentState.temp_motor,
      inside_temp: currentState.temp_cabin,
      gear: currentState.gear, park_time: currentState.park_time, 
      power: currentState.isCharging ? currentState.chargePower : (currentState.power || 0),
      latitude: currentState.latitude, longitude: currentState.longitude,
      locked: currentState.locked, 
      charge_state: currentState.isCharging ? 'charging' : (currentState.charge_state || 'stopped'),
      charge_kwh: currentState.charge_kwh,
      charge_temp: currentState.i3_gate_temp || currentState.chargeHeadTemp
    };
    await supabase.from('telemetry').insert(payload);
    currentState.isDirty = false;
  }
}, CONFIG.batchInterval);

client.on('connect', () => {
  console.log('[MQTT] Connected to Server');
  client.subscribe(`ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/metric/#`);
});
