

export enum VehicleState {
  Parked = 'Parked',
  Driving = 'Driving',
  Charging = 'Charging',
  Offline = 'Offline',
  Asleep = 'Asleep'
}

// Added DrivePathPoint to support trajectory path in DriveSession
export interface DrivePathPoint {
  ts: number; // Added timestamp for X-axis
  lat: number;
  lng: number;
  speed: number;
  soc: number;
  elevation: number;
}

// Added DriveSession interface for drive tracking
export interface DriveSession {
  id: string;
  startDate: string;
  endDate?: string;
  distance: number;
  duration: number;
  consumption: number;
  efficiency: number;
  startSoc: number;
  endSoc?: number;
  path: DrivePathPoint[];
}

// Added ChargeChartPoint for charging visualization
export interface ChargeChartPoint {
  time: string;
  timestamp: number;
  power: number;
  soc: number;
}

// Added ChargeSession interface for charging history
export interface ChargeSession {
  id: string;
  date: string;
  endDate?: string;
  location: string;
  latitude?: number;
  longitude?: number;
  addedKwh: number;
  startSoc: number;
  endSoc: number;
  duration: number;
  avgPower: number;
  maxPower: number;
  chartData: ChargeChartPoint[];
}

export interface TelemetryData {
  vehicleId?: string;
  timestamp: number;
  
  // Core (v.b.*)
  soc: number; 
  soh?: number; 
  capacityAh?: number; 
  rangeEst?: number; // Maps to xi3.v.b.range.bc
  rangeIdeal?: number;
  rangeFull?: number;
  
  // Driving (v.p.*)
  speed: number; 
  odometer: number; 
  tripDistance: number; // v.p.trip
  tripConsumptionAvg: number; // xi3.v.p.tripconsumption
  consumptionInst: number; // v.b.consumption
  motorRpm?: number; // v.m.rpm
  tripEnergyUsed?: number; // v.b.energy.used
  // Added direction property for map heading visualization
  direction?: number; 
  
  // Electrical
  power: number; // v.b.power
  voltage: number; 
  current: number; 
  voltage12v?: number; 
  current12v?: number; 
  
  // Charging (xi3.v.c.*)
  chargeState: string; 
  chargeKwh?: number;
  chargeTemp?: number;
  chargePilotA?: number; // xi3.v.c.pilotsignal
  chargePlugStatus?: string; // xi3.v.c.chargeplugstatus
  readyToCharge?: boolean; // xi3.v.c.readytocharge
  
  // Temps & Vent
  tempBattery: number;
  tempMotor: number;
  tempAmbient: number;
  insideTemp?: number;
  chargerTemp?: number; // v.c.temp
  ventMode?: string; // v.e.cabinintake
  acStatus?: boolean; // v.e.cooling
  
  // Location & GPS
  latitude: number;
  longitude: number;
  elevation: number;
  locationName?: string; // v.p.location
  gpsSats?: number;
  gpsQuality?: number; // v.p.gpssq
  
  // Status (v.e.*)
  gear?: string;
  locked?: boolean;
  carOn?: boolean;
  parkTime: number; // v.e.parktime
  driveTime: number; // v.e.drivetime
  lastUpdateAge: number; // xi3.s.age (mins)
  
  // Door Status (v.d.*)
  doorFL?: boolean;
  doorFR?: boolean;
  doorRL?: boolean;
  doorRR?: boolean;
  doorHood?: boolean;
  doorTrunk?: boolean;
  doorChargePort?: boolean;
  
  rawMetrics?: Record<string, any>;
  carMetrics?: Record<string, any>;
}

export interface OvmsConfig {
  supabaseUrl: string;
  supabaseKey: string;
  vehicleId: string;
  vehicleName?: string; 
  serverPassword?: string;
  serverUrl?: string;
  costPerKwh?: number; // New setting
  currency?: string;   // New setting
  geminiApiKey?: string; // New setting for AI Insight
}