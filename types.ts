
export enum VehicleState {
  Parked = 'Parked',
  Driving = 'Driving',
  Charging = 'Charging',
  Offline = 'Offline',
  Asleep = 'Asleep'
}

export interface TelemetryData {
  vehicleId?: string;
  timestamp: number;
  
  // Core
  soc: number; 
  soh?: number; 
  capacity?: number; 
  range: number; 
  estRange: number; 
  idealRange: number;
  
  // Driving
  speed: number; 
  odometer: number; 
  
  // Electrical
  power: number; 
  voltage: number; 
  current: number; 
  voltage12v?: number; 
  current12v?: number; 
  
  // Charging
  chargeState: string; 
  chargeMode?: string;
  chargeKwh?: number;
  chargeTime?: number;
  chargeTemp?: number;
  chargePilot?: boolean;
  chargeLimitSoc?: number;
  chargeLimitRange?: number;
  chargeType?: string;
  
  // Temps
  tempBattery: number;
  tempMotor: number;
  tempAmbient: number;
  insideTemp?: number;
  outsideTemp?: number;
  
  // Location
  latitude: number;
  longitude: number;
  elevation: number;
  locationName?: string;
  direction?: number;
  gpsLock?: boolean;
  gpsSats?: number;
  
  // Status
  gear?: string;
  locked?: boolean;
  valet?: boolean;
  carAwake?: boolean;
  handbrake?: boolean;
  parkTime?: number;
  
  // BMW i3 Custom Display Fields
  i3PilotCurrent?: number;
  i3LedState?: number;
  i3PlugStatus?: string;
  i3Ready?: boolean;
  
  rawMetrics?: Record<string, any>;
  carMetrics?: Record<string, any>;
}

export interface DriveSession {
  id: string;
  startDate: string;
  endDate?: string;
  distance: number; 
  duration: number; 
  consumption: number; 
  efficiency: number; 
  startSoc: number;
  endSoc: number;
  path: { lat: number; lng: number; speed: number; soc: number }[];
}

export interface ChargeSession {
  id: string;
  date: string;
  endDate?: string;
  location: string;
  addedKwh: number;
  duration: number; 
  cost?: number;
  avgPower: number; 
  maxPower: number; 
  startSoc?: number;
  endSoc?: number;
  chartData: { time: string; power: number; soc: number }[];
}

export interface OvmsConfig {
  supabaseUrl: string;
  supabaseKey: string;
  vehicleId: string;
  serverPassword?: string;
  serverUrl?: string;
}
