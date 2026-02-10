
import { createClient } from '@supabase/supabase-js';
import mqtt from 'mqtt';
import crypto from 'crypto';

console.log('================================================');
console.log('   OVMS MATE LOGGER - i3 DRIVE & CHARGE v2.5   ');
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

// --- LOGIC CONSTANTS ---
const DRIVE_COOLDOWN_MS = 15 * 60 * 1000; 
const MIN_DRIVE_DISTANCE_KM = 0.1;
const MIN_CHARGE_DURATION_MIN = 1; 
const CHARGE_HEARTBEAT_INTERVAL_MS = 60000; // Send 'stat' command if silence > 60s during charging

// --- STATE MACHINES ---
let activeDrive = null; 
let activeCharge = null;
let lastMsgTime = Date.now(); // Track silence

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
  // Battery
  'v.b.soc': 'soc',
  'v.b.soh': 'soh',
  'v.b.capacity': 'capacity',
  'v.b.cac': 'cac',           
  'v.b.voltage': 'voltage',
  'v.b.current': 'current',
  'v.b.power': 'power',
  'v.b.consumption': 'consumptionInst',
  'v.b.energy.used': 'tripEnergyUsed',
  
  // Driving
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
  
  // Temps
  'v.e.temp': 'temp_ambient',
  'v.b.temp': 'temp_battery',
  'v.m.temp': 'temp_motor',
  'v.m.rpm': 'motorRpm',
  'v.e.cabintemp': 'temp_cabin',
  'v.c.temp': 'chargerTemp',
  'v.e.cabinintake': 'ventMode',
  'v.e.cooling': 'acStatus',
  
  // 12V
  'v.b.12v.current': 'v12current',
  'v.b.12v.voltage': 'v12voltage',
  
  // Doors
  'v.d.cp': 'doorChargePort',
  'v.d.fl': 'doorFL',
  'v.d.fr': 'doorFR',
  'v.d.rl': 'doorRL',
  'v.d.rr': 'doorRR',
  'v.d.hood': 'doorHood',
  'v.d.trunk': 'doorTrunk',
  
  // i3 Specifics
  'xi3.v.b.range.bc': 'rangeEst',
  'xi3.s.age': 'lastUpdateAge',
  'xi3.v.c.pilotsignal': 'chargePilotA',       
  'xi3.v.c.chargeplugstatus': 'chargePlugStatus', 
  'xi3.v.c.readytocharge': 'readyToCharge',
  'xi3.v.p.tripconsumption': 'tripConsumptionAvg',

  // Standard Charging (Fallback/Primary)
  'v.c.charging': 'isChargingStandard',
  'v.c.state': 'chargeStateStandard',
  'v.c.kwh': 'chargeKwhAdded'
};

const parseValue = (val) => {
  if (typeof val !== 'string') return val;
  const lval = val.toLowerCase().trim();
  if (['yes', 'true', 'connected', 'online'].includes(lval)) return true;
  if (['no', 'false', 'not connected', 'offline'].includes(lval)) return false;
  // Try to parse number
  const match = val.match(/(-?\d+(\.\d+)?)/);
  // Only return number if it matches, otherwise return original string
  // This allows "Type 2" or "charging" to pass through as strings
  return match ? parseFloat(match[0]) : val.trim();
};

client.on('message', (topic, message) => {
  lastMsgTime = Date.now(); // Update silence tracker
  
  const metricPath = topic.split('/metric/')[1];
  if (!metricPath) return;
  const key = metricPath.replace(/\//g, '.');
  const rawValue = message.toString();
  
  // Special handling: Keep v.c.state / chargeplugstatus as strings if they are not bools
  let val = parseValue(rawValue);
  
  // Preserve string status for debugging if parseValue turned it into a partial number (rare but possible)
  if (key === 'xi3.v.c.chargeplugstatus' && typeof val === 'number') {
     val = rawValue; 
  }

  const field = DB_MAP[key];
  if (field) currentState[field] = val;
  
  if (key.startsWith('v.')) currentState.raw[key] = rawValue;
  else currentState.car[key] = rawValue;
  currentState.isDirty = true;
});

// --- HELPER: Send Heartbeat ---
const sendActiveHeartbeat = () => {
  if (!client.connected) return;
  
  // Generate a random UUID for the command ID
  const uuid = crypto.randomUUID();
  const clientId = 'ovms-mate-logger';
  const topic = `ovms/${CONFIG.mqttUser}/${CONFIG.vehicleId}/client/${clientId}/command/${uuid}`;
  
  // 'stat' command forces OVMS to re-read and publish status
  client.publish(topic, 'stat');
  console.log('💓 Active Charge Heartbeat: Sent "stat" command to keep session alive');
};

const getPackCapacity = () => {
  if (currentState.capacity) return currentState.capacity;
  if (currentState.cac) {
     return (currentState.cac * 360) / 1000;
  }
  return 37.9; 
};

// --- DRIVE PROCESSOR ---
const processDriveLogic = async () => {
  if (activeCharge) return; 

  const now = Date.now();
  const speed = currentState.speed || 0;
  const isMoving = speed > 0;
  
  if (!activeDrive && isMoving) {
    console.log(`🚗 Drive Started! Odo: ${currentState.odometer}`);
    activeDrive = {
      startTime: now,
      startOdo: currentState.odometer,
      startSoc: currentState.soc,
      path: [],
      cooldownStartTime: null
    };
  }

  if (activeDrive) {
    if (currentState.latitude && currentState.longitude) {
       const lastPoint = activeDrive.path[activeDrive.path.length - 1];
       if (!lastPoint || (now - lastPoint.ts > 5000)) { 
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

    if (!isMoving) {
      if (!activeDrive.cooldownStartTime) {
        activeDrive.cooldownStartTime = now;
      } else if (now - activeDrive.cooldownStartTime > DRIVE_COOLDOWN_MS) {
        await finalizeDrive(activeDrive);
        activeDrive = null;
      }
    } else {
      activeDrive.cooldownStartTime = null;
    }
  }
};

const finalizeDrive = async (drive) => {
  const realEndTime = drive.cooldownStartTime || Date.now();
  const distance = currentState.odometer - drive.startOdo;
  if (distance < MIN_DRIVE_DISTANCE_KM) return;

  const durationMin = (realEndTime - drive.startTime) / 1000 / 60;
  const endSoc = currentState.soc;
  const packCap = getPackCapacity();
  const energyUsed = ((drive.startSoc - endSoc) / 100) * packCap;
  
  let efficiency = 0;
  if (distance > 0 && energyUsed > 0) efficiency = (energyUsed * 1000) / distance;

  const drivePayload = {
    vehicle_id: CONFIG.vehicleId,
    start_date: new Date(drive.startTime).toISOString(),
    end_date: new Date(realEndTime).toISOString(),
    distance: distance,
    duration: durationMin,
    start_soc: drive.startSoc,
    end_soc: endSoc,
    consumption: energyUsed,
    efficiency: efficiency,
    path: drive.path
  };

  console.log(`✅ Drive Saved: ${distance.toFixed(1)}km`);
  if (supabase) await supabase.from('drives').insert(drivePayload);
};

// --- CHARGE PROCESSOR ---
const processChargeLogic = async () => {
  if (activeDrive) return; 

  const now = Date.now();
  
  // --- Charging Detection Logic ---
  
  // 1. i3 Specific Signals
  const plugStatus = currentState.chargePlugStatus; // Expected: "Connected", "Type 2", etc.
  const pilotSignal = currentState.chargePilotA || 0;
  // const readyToCharge = currentState.readyToCharge; 

  // Check if plugStatus contains "Connected" or is boolean true (insensitive check)
  const isPlugConnected = plugStatus === true || 
                          (typeof plugStatus === 'string' && plugStatus.toLowerCase().includes('connect'));
  
  const isI3Charging = isPlugConnected && pilotSignal > 0;

  // 2. Standard OVMS Signals (v.c.charging / v.c.state)
  const isStandardCharging = currentState.isChargingStandard === true;
  const isStateCharging = currentState.chargeStateStandard === 'charging';

  // Combined Condition
  const isCharging = isI3Charging || isStandardCharging || isStateCharging;
  
  // Stop Condition
  // If we started, we stop when ALL indications are false/stopped
  const isStopped = (!isPlugConnected && !isStandardCharging && !isStateCharging) || 
                    (isPlugConnected && pilotSignal === 0 && !isStandardCharging && !isStateCharging);

  // START
  if (!activeCharge && isCharging) {
    console.log(`⚡ Charging Started!`);
    
    activeCharge = {
      startTime: now,
      startSoc: currentState.soc,
      location: currentState.locationName || '',
      latitude: currentState.latitude,
      longitude: currentState.longitude,
      chartData: [],
      maxPower: 0,
      powerSum: 0,
      samples: 0
    };
  }

  // UPDATE
  if (activeCharge) {
    // --- Heartbeat Logic ---
    // If we believe we are charging, but haven't heard from the car in > 60s,
    // sending a 'stat' command to wake up OVMS reporting logic.
    if ((now - lastMsgTime) > CHARGE_HEARTBEAT_INTERVAL_MS) {
        sendActiveHeartbeat();
        // Reset timer locally to avoid spamming if network is just slow
        lastMsgTime = now; 
    }

    const rawPower = currentState.power || 0;
    const absPower = Math.abs(rawPower);
    
    activeCharge.maxPower = Math.max(activeCharge.maxPower, absPower);
    activeCharge.powerSum += absPower;
    activeCharge.samples++;
    
    // Log sample data
    const lastPoint = activeCharge.chartData[activeCharge.chartData.length - 1];
    if (!lastPoint || (now - lastPoint.timestamp > 60000)) {
      activeCharge.chartData.push({
        time: new Date(now).toISOString(),
        timestamp: now,
        power: absPower, 
        soc: currentState.soc
      });
    }

    // END
    if (isStopped) {
      console.log(`⚡ Charging Stopped.`);
      await finalizeCharge(activeCharge);
      activeCharge = null;
    }
  }
};

const finalizeCharge = async (charge) => {
  const endTime = Date.now();
  const durationMin = (endTime - charge.startTime) / 1000 / 60;
  
  if (durationMin < MIN_CHARGE_DURATION_MIN) {
     console.log(`🗑️ Charge discarded (Duration ${durationMin.toFixed(1)} min < 1 min)`);
     return;
  }

  const endSoc = currentState.soc;
  const packCap = getPackCapacity();
  
  let addedKwh = ((endSoc - charge.startSoc) / 100) * packCap;
  if (addedKwh < 0) addedKwh = 0; 
  
  // If standard metric v.c.kwh is available (energy added this session), prefer that
  if (currentState.chargeKwhAdded && currentState.chargeKwhAdded > 0) {
      addedKwh = currentState.chargeKwhAdded;
  }

  const avgPower = charge.samples > 0 ? (charge.powerSum / charge.samples) : 0;

  const payload = {
    vehicle_id: CONFIG.vehicleId,
    date: new Date(charge.startTime).toISOString(),
    end_date: new Date(endTime).toISOString(),
    location: charge.location,
    latitude: charge.latitude,
    longitude: charge.longitude,
    start_soc: charge.startSoc,
    end_soc: endSoc,
    added_kwh: addedKwh,
    duration: durationMin,
    avg_power: avgPower,
    max_power: charge.maxPower,
    chart_data: charge.chartData
  };

  console.log(`✅ Charge Saved: +${addedKwh.toFixed(2)} kWh`);
  if (supabase) await supabase.from('charges').insert(payload);
};


// --- MAIN LOOP ---
setInterval(async () => {
  await processDriveLogic();
  await processChargeLogic();

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
    charge_plug_status: currentState.chargePlugStatus === true ? 'Connected' : (currentState.chargePlugStatus || 'Not connected'),
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
