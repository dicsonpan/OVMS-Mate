export enum VehicleState {
  Parked = 'Parked',
  Driving = 'Driving',
  Charging = 'Charging',
  Offline = 'Offline'
}

export interface TelemetryData {
  timestamp: number;
  soc: number; // State of charge %
  range: number; // Estimated range in km
  speed: number; // km/h
  power: number; // kW (positive = discharge, negative = regen/charge)
  voltage: number; // V
  current: number; // A
  odometer: number; // km
  tempBattery: number; // Celsius
  tempMotor: number; // Celsius
  latitude: number;
  longitude: number;
  elevation: number;
  locationName?: string;
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