
import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';

console.log('================================================');
console.log('   OVMS MATE LOGGER - i3 HOME REFIT v10        ');
console.log('================================================');

const CONFIG = {
  mqttUser: process.env.OVMS_USER || process.env.OVMS_ID,
  vehicleId: process.env.OVMS_ID,
  password: process.env.OVMS_PASS,
  server: process.env.OVMS_SERVER, 
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY,
  batchInterval: 5000,
};

const supabase = (CONFIG.supabaseUrl && CONFIG.supabaseKey) 
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) 
  : null;

const client = mqtt.connect(CONFIG.server.includes('://') ? CONFIG.server : `mqtt://${CONFIG.server}:1883`, {
  username: CONFIG.mqttUser,
  password: CONFIG.password,
  clean: true,
});

let currentState = {
  raw: {}, car: {}, isDirty: false
};

const DB_MAP = {
  'v.b.soc': 'soc',
  'v.b.soh': 'soh',
  'v.b.voltage': 'voltage',
  'v.b.current': 'current',
  'v.b.power': 'power',
  'v.b.consumption': 'consumptionInst',
  'v.b.energy.used': 'tripEnergyUsed',
  'v.p.speed': 'speed',
  'v.p.odometer': 'odometer',
  'v.p.trip': 'tripDistance',
  'v.e.gear': 'gear',
  'v.e.on': 'carOn',
  'v.e.parktime': 'parkTime',
  'v.e.drivetime': 'driveTime',
  'v.e.locked': 'locked',
  'v.p.altitude': 'elevation',
  'v.p.satcount': 'gpsSats',
  'v.p.gpssq': 'gpsQuality',
  'v.p.latitude': 'latitude',
  'v.p.longitude': 'longitude',
  'v.p.location': 'locationName',
  'v.e.temp': 'temp_ambient',
  'v.b.temp': 'temp_battery',
  'v.m.temp': 'temp_motor',
  'v.m.rpm': 'motorRpm',
  'v.e.cabintemp': 'temp_cabin',
  'v.c.temp': 'chargerTemp',
  'v.e.cabinintake': 'ventMode',
  'v.e.cooling': 'acStatus',
  'v.b.12v.current': 'v12current',
  'v.b.12v.voltage': 'v12voltage',
  
  // Door details
  'v.d.cp': 'doorChargePort',
  'v.d.fl': 'doorFL',
  'v.d.fr': 'doorFR',
  'v.d.rl': 'doorRL',
  'v.d.rr': 'doorRR',
  'v.d.hood': 'doorHood',
  'v.d.trunk': 'doorTrunk',

  // xi3 specific
  'xi3.v.b.range.bc': 'rangeEst',
  'xi3.s.age': 'lastUpdateAge',
  'xi3.v.c.pilotsignal': 'chargePilotA',
  'xi3.v.c.chargeplugstatus': 'chargePlugStatus',
  'xi3.v.p.tripconsumption': 'tripConsumptionAvg'
};

const parseValue = (val) => {
  if (typeof val !== 'string') return val;
  const lval = val.toLowerCase().trim();
  if (['yes', 'true', 'connected', 'online'].includes(lval)) return true;
  if (['no', 'false', 'not connected', 'offline'].includes(lval)) return false;
  const match = val.match(/(-?\d+(\.\d+)?)/);
  return match ? parseFloat(match[0]) : val.trim();
};

client.on('message', (topic, message) => {
  const metricPath = topic.split('/metric/')[1];
  if (!metricPath) return;
  const key = metricPath.replace(/\//g, '.');
  const rawValue = message.toString();
  const val = parseValue(rawValue);
  
  const field = DB_MAP[key];
  if (field) currentState[field] = val;
  
  if (key.startsWith('v.')) currentState.raw[key] = rawValue;
  else currentState.car[key] = rawValue;
  currentState.isDirty = true;
});

setInterval(async () => {
  if (!supabase || !currentState.isDirty) return;
  
  const payload = {
    vehicle_id: CONFIG.vehicleId,
    timestamp: Date.now(),
    soc: currentState.soc,
    soh: currentState.soh,
    voltage: currentState.voltage,
    current: currentState.current,
    power: currentState.power,
    range_est: currentState.rangeEst,
    speed: currentState.speed,
    odometer: currentState.odometer,
    trip_distance: currentState.tripDistance,
    trip_consumption: currentState.tripConsumptionAvg,
    consumption_inst: currentState.consumptionInst,
    motor_rpm: currentState.motorRpm,
    trip_energy: currentState.tripEnergyUsed,
    voltage_12v: currentState.v12voltage,
    current_12v: currentState.v12current,
    charge_pilot_a: currentState.chargePilotA,
    charge_plug_status: currentState.chargePlugStatus ? 'Connected' : 'Not connected',
    latitude: currentState.latitude,
    longitude: currentState.longitude,
    elevation: currentState.elevation,
    location_name: currentState.locationName,
    gps_sats: currentState.gpsSats,
    gps_quality: currentState.gpsQuality,
    temp_battery: currentState.temp_battery,
    temp_motor: currentState.temp_motor,
    temp_ambient: currentState.temp_ambient,
    inside_temp: currentState.temp_cabin,
    charger_temp: currentState.chargerTemp,
    vent_mode: currentState.ventMode,
    ac_status: currentState.acStatus,
    locked: currentState.locked,
    car_on: currentState.carOn,
    gear: currentState.gear,
    park_time: currentState.parkTime,
    drive_time: currentState.driveTime,
    last_update_age: currentState.lastUpdateAge,
    door_fl: currentState.doorFL,
    door_fr: currentState.doorFR,
    door_rl: currentState.doorRL,
    door_rr: currentState.doorRR,
    door_hood: currentState.doorHood,
    door_trunk: currentState.doorTrunk,
    door_cp: currentState.doorChargePort,
    raw_metrics: currentState.raw,
    car_metrics: currentState.car
  };
  
  await supabase.from('telemetry').insert(payload);
  currentState.isDirty = false;
}, CONFIG.batchInterval);

client.on('connect', () => {
  client.subscribe(`ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/metric/#`);
});
