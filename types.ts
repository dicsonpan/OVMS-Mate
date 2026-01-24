export enum VehicleState {
  Parked = 'Parked',
  Driving = 'Driving',
  Charging = 'Charging',
  Offline = 'Offline'
}

export interface TelemetryData {
  timestamp: number;
  soc: number; // State of charge %
  range: number; // Display range (usually est_range)
  estRange: number; // Estimated based on driving history
  idealRange: number; // Rated range
  speed: number; // km/h
  power: number; // kW
  voltage: number; // V
  current: number; // A
  chargeState: string; // 'done', 'charging', 'stopped'
  odometer: number; // km
  tempBattery: number; // Celsius
  tempMotor: number; // Celsius
  tempAmbient: number; // Celsius
  latitude: number;
  longitude: number;
  elevation: number;
  locationName?: string;
  vehicleId?: string;
}

export interface DriveSession {
  id: string;
  startDate: string;
  endDate: string;
  distance: number; // km
  duration: number; // minutes
  consumption: number; // kWh
  efficiency: number; // Wh/km
  startSoc: number;
  endSoc: number;
  path: { lat: number; lng: number; speed: number }[]; // Simplified path for visualization
}

export interface ChargeSession {
  id: string;
  date: string;
  location: string;
  addedKwh: number;
  duration: number; // minutes
  cost?: number;
  avgPower: number; // kW
  maxPower: number; // kW
  chartData: { time: string; power: number; soc: number }[];
}

export interface OvmsConfig {
  vehicleId: string;
  serverPassword: string;
  serverUrl: string;
}

// Raw response structure from OVMS V3 API (Status/Location)
export interface OvmsApiData {
  soc?: string | number;
  range?: string | number;
  speed?: string | number;
  power?: string | number;
  voltage?: string | number;
  current?: string | number;
  odometer?: string | number;
  batt_temp?: string | number;
  motor_temp?: string | number;
  latitude?: string | number;
  longitude?: string | number;
  altitude?: string | number;
  location?: string;
  m_msgtime?: string;
}