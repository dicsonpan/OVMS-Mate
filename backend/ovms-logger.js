
import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';

console.log('================================================');
console.log('   OVMS MATE LOGGER - PRECISION MODE v2        ');
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
  parkTimeoutSeconds: 1800, // 30 mins
  minDriveDistance: 0.1, // 100m
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
  soc: 0,
  soh: 100,
  voltage: 0,
  cac: 0,
  capacity_kwh: 0,
  speed: 0,
  odometer: 0,
  park_time: 0,
  isOn: false,
  gear: 'P',
  v12current: 0,
  ambient_temp: 0,
  isDriving: false,
  currentDriveId: null,
  currentDrivePath: [],
  driveStartTime: null,
  driveStartOdo: 0,
  driveStartSoc: 0,
  rawMetrics: {}, 
  carMetrics: {}, 
  isDirty: false
};

const DB_MAP = {
  'v.b.soc': 'soc',
  'v.b.soh': 'soh',
  'v.b.cac': 'cac',
  'v.b.capacity': 'capacity_kwh',
  'v.b.voltage': 'voltage',
  'v.p.speed': 'speed',
  'v.p.odometer': 'odometer',
  'v.e.gear': 'gear',
  'v.e.on': 'isOn',
  'v.e.parktime': 'park_time',
  'v.e.temp': 'ambient_temp',
  'v.b.12v.current': 'v12current',
  'v.b.12v.voltage': 'v12voltage',
  'v.b.power': 'power',
  'v.p.latitude': 'latitude',
  'v.p.longitude': 'longitude',
  'v.c.state': 'charge_state'
};

const parseValue = (val) => {
  if (typeof val !== 'string') return val;
  if (val.toLowerCase() === 'yes') return true;
  if (val.toLowerCase() === 'no') return false;
  const match = val.match(/(-?\d+(\.\d+)?)/);
  return match ? parseFloat(match[0]) : val.trim();
};

const getEffectiveCapacity = () => {
  // 1. 如果车端直接上报了 kWh 容量
  if (currentState.capacity_kwh > 0) return currentState.capacity_kwh;
  // 2. 如果只有 Ah (CAC)，按当前电压换算: kWh = (Ah * V) / 1000
  if (currentState.cac > 0 && currentState.voltage > 0) {
    return (currentState.cac * currentState.voltage) / 1000;
  }
  // 3. 保底默认值 (需根据车型调整，这里设为 30 作为 fallback)
  return 30;
};

const updateActiveDrive = async () => {
  if (!currentState.isDriving || !currentState.currentDriveId || !supabase) return;
  if (currentState.odometer === 0 || currentState.driveStartOdo === 0) return;

  const currentDistance = Math.max(0, currentState.odometer - currentState.driveStartOdo);
  const currentDuration = Math.round((new Date() - currentState.driveStartTime) / 60000);
  const socDiff = currentState.driveStartSoc - currentState.soc;
  
  // 考虑 SoH 的真实可用容量
  const realCapacity = getEffectiveCapacity() * (currentState.soh / 100);
  const consumption = Math.max(0, (socDiff / 100) * realCapacity);
  const efficiency = currentDistance > 0.05 ? Math.round((consumption * 1000) / currentDistance) : 0;

  if (currentState.latitude !== 0) {
    currentState.currentDrivePath.push({
      lat: currentState.latitude, lng: currentState.longitude,
      speed: currentState.speed, soc: currentState.soc, time: new Date().toISOString()
    });
    if (currentState.currentDrivePath.length > 1000) currentState.currentDrivePath.shift();
  }

  await supabase.from('drives').update({
    distance: currentDistance, duration: currentDuration,
    end_soc: currentState.soc, end_odometer: currentState.odometer,
    consumption: consumption, efficiency: efficiency, path: currentState.currentDrivePath
  }).eq('id', currentState.currentDriveId);
};

const handleStateTransitions = async () => {
  // 判定是否正在驾驶：车辆已点火 (v.e.on) 且 (有速度 或 档位不在P)
  const isCurrentlyDriving = currentState.isOn && (currentState.speed > 0 || (currentState.gear !== 'P' && currentState.gear !== 0));
  const isParkedLongEnough = currentState.park_time > CONFIG.parkTimeoutSeconds;

  if (isCurrentlyDriving) {
    if (!currentState.isDriving && currentState.odometer > 0) {
      console.log(`[Drive] Session START. Odo: ${currentState.odometer}, Ignition: ON`);
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
    } else {
      await updateActiveDrive();
    }
  } else if (currentState.isDriving && isParkedLongEnough) {
    console.log(`[Drive] Session END. Parked for ${currentState.park_time}s.`);
    await updateActiveDrive();
    const finalDistance = currentState.odometer - currentState.driveStartOdo;
    if (finalDistance < CONFIG.minDriveDistance) {
       await supabase.from('drives').delete().eq('id', currentState.currentDriveId);
    } else {
       await supabase.from('drives').update({ end_date: new Date().toISOString() }).eq('id', currentState.currentDriveId);
    }
    currentState.isDriving = false;
    currentState.currentDriveId = null;
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
      temp_ambient: currentState.ambient_temp, gear: currentState.gear,
      park_time: currentState.park_time, power: currentState.power,
      latitude: currentState.latitude, longitude: currentState.longitude
    };
    await supabase.from('telemetry').insert(payload);
    currentState.isDirty = false;
  }
}, CONFIG.batchInterval);

client.on('connect', () => {
  console.log('[MQTT] Connected');
  client.subscribe(`ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/metric/#`);
});
