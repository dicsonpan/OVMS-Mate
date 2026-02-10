
import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';

console.log('================================================');
console.log('   OVMS MATE LOGGER - i3 DRIVE TRACKER v2.1    ');
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

// --- DRIVE LOGIC CONSTANTS ---
const DRIVE_COOLDOWN_MS = 15 * 60 * 1000; // 15 Minutes
const MIN_DRIVE_DISTANCE_KM = 0.1;

// --- STATE MACHINE ---
let activeDrive = null; 
// activeDrive Structure:
// {
//   startTime: number (ms),
//   startOdo: number,
//   startSoc: number,
//   maxSpeed: number,
//   path: Array<{ts, lat, lng, speed, soc, elevation}>,
//   cooldownStartTime: number | null
// }

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

// Mapping MQTT topics to internal state keys
const DB_MAP = {
  'v.b.soc': 'soc',
  'v.b.soh': 'soh',
  'v.b.capacity': 'capacity', // Added: Usable capacity in kWh
  'v.b.cac': 'cac',           // Added: Calculated Amp-hours
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

// --- DRIVE PROCESSOR ---
const processDriveLogic = async () => {
  const now = Date.now();
  const speed = currentState.speed || 0;
  
  const isMoving = speed > 0;
  
  // 1. START CONDITION: Car starts moving
  if (!activeDrive && isMoving) {
    console.log(`🚗 Drive Started! Odo: ${currentState.odometer}, SoC: ${currentState.soc}%`);
    activeDrive = {
      startTime: now,
      startOdo: currentState.odometer,
      startSoc: currentState.soc,
      path: [],
      cooldownStartTime: null
    };
  }

  // 2. ONGOING DRIVE
  if (activeDrive) {
    // Record Path Points (only if we have GPS)
    if (currentState.latitude && currentState.longitude) {
       // Avoid duplicates: only push if different from last point OR significant time passed
       const lastPoint = activeDrive.path[activeDrive.path.length - 1];
       if (!lastPoint || (now - lastPoint.ts > 5000)) { // Sample every 5s
         activeDrive.path.push({
           ts: now,
           lat: currentState.latitude,
           lng: currentState.longitude,
           speed: speed,
           soc: currentState.soc,
           elevation: currentState.elevation || 0
         });
       }
    }

    // 3. COOLDOWN / STOP CHECK
    // If not moving, start cooldown timer
    if (!isMoving) {
      if (!activeDrive.cooldownStartTime) {
        activeDrive.cooldownStartTime = now;
        console.log(`⏱️ Car stopped. Cooldown started.`);
      } else {
        const elapsed = now - activeDrive.cooldownStartTime;
        // 4. END CONDITION
        if (elapsed > DRIVE_COOLDOWN_MS) {
          await finalizeDrive(activeDrive);
          activeDrive = null;
        }
      }
    } else {
      // Car moved again, reset cooldown
      if (activeDrive.cooldownStartTime) {
        console.log(`🚗 Car moved again. Cooldown reset.`);
        activeDrive.cooldownStartTime = null;
      }
    }
  }
};

const finalizeDrive = async (drive) => {
  // Logic 3: End time is "now" minus the 15 min cooldown
  const realEndTime = drive.cooldownStartTime || Date.now();
  const endOdo = currentState.odometer;
  const distance = endOdo - drive.startOdo;
  
  // Logic 4: Filter short drives
  if (distance < MIN_DRIVE_DISTANCE_KM) {
    console.log(`🗑️ Drive discarded (Distance ${distance.toFixed(3)}km < 0.1km)`);
    return;
  }

  const durationMin = (realEndTime - drive.startTime) / 1000 / 60;
  const endSoc = currentState.soc;
  
  // --- ENERGY CALCULATION UPDATE ---
  // Formula: (StartSoC - EndSoC) * TotalCapacity
  // We prefer 'v.b.capacity' (kWh) which is the BMS reported usable capacity.
  // If not available, we estimate using 'v.b.cac' (Ah) * 360V (Nominal Voltage for i3) / 1000.
  
  let packCapacityKwh = currentState.capacity;
  if (!packCapacityKwh && currentState.cac) {
     // Fallback: Estimate kWh from Ah. 
     // i3 60Ah ~ 360V, 94Ah ~ 352V, 120Ah ~ 352V nominal. Using 360V as a safe general multiplier.
     packCapacityKwh = (currentState.cac * 360) / 1000;
  }
  // Ultimate fallback if metrics missing (assume 120Ah / 40kWh model as default)
  if (!packCapacityKwh) packCapacityKwh = 37.9;

  const deltaSoc = drive.startSoc - endSoc;
  
  // Calculate Energy Used (kWh)
  // We use Math.max(0, ...) to avoid negative consumption on downhill-only short trips (regen), 
  // though physically it is negative energy, usually drives show 0 or positive consumption.
  let energyUsed = (deltaSoc / 100) * packCapacityKwh;
  
  // If negative (net regen), we can either store negative or 0. TeslaMate usually stores 0 or net.
  // Let's keep the signed value if it's significant, but usually trips consume energy.
  
  // Calculate efficiency (Wh/km)
  let efficiency = 0;
  if (distance > 0 && energyUsed > 0) {
    efficiency = (energyUsed * 1000) / distance;
  }

  const drivePayload = {
    vehicle_id: CONFIG.vehicleId,
    start_date: new Date(drive.startTime).toISOString(),
    end_date: new Date(realEndTime).toISOString(),
    distance: distance,
    duration: durationMin,
    start_soc: drive.startSoc,
    end_soc: endSoc,
    consumption: energyUsed, // Calculated from SoC delta
    efficiency: efficiency, // Wh/km
    path: drive.path
  };

  console.log(`✅ Drive Finished! Dist: ${distance.toFixed(2)}km, Energy: ${energyUsed.toFixed(2)}kWh (Cap: ${packCapacityKwh.toFixed(1)}kWh)`);
  
  if (supabase) {
    const { error } = await supabase.from('drives').insert(drivePayload);
    if (error) console.error("Error saving drive:", error);
    else console.log("💾 Drive saved to Supabase.");
  }
};


// --- MAIN LOOP ---
setInterval(async () => {
  // 1. Process Logic
  await processDriveLogic();

  // 2. Save Telemetry Batch
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
  console.log('🔌 MQTT Connected');
  client.subscribe(`ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/metric/#`);
});
