
import { DriveSession, ChargeSession, TelemetryData } from '../types';

// Helper to generate random path
const generatePath = (points: number) => {
  const path = [];
  let lat = 37.7749;
  let lng = -122.4194;
  for (let i = 0; i < points; i++) {
    lat += (Math.random() - 0.5) * 0.01;
    lng += (Math.random() - 0.5) * 0.01;
    path.push({ lat, lng, speed: 20 + Math.random() * 60 });
  }
  return path;
};

export const MOCK_DRIVES: DriveSession[] = [
  {
    id: 'd1',
    startDate: '2023-10-24T08:30:00Z',
    endDate: '2023-10-24T09:15:00Z',
    distance: 45.2,
    duration: 45,
    consumption: 7.2,
    efficiency: 159,
    startSoc: 80,
    endSoc: 65,
    path: generatePath(20)
  },
  {
    id: 'd2',
    startDate: '2023-10-23T18:00:00Z',
    endDate: '2023-10-23T18:40:00Z',
    distance: 32.1,
    duration: 40,
    consumption: 5.5,
    efficiency: 171,
    startSoc: 55,
    endSoc: 44,
    path: generatePath(15)
  },
  {
    id: 'd3',
    startDate: '2023-10-23T07:45:00Z',
    endDate: '2023-10-23T08:15:00Z',
    distance: 12.5,
    duration: 30,
    consumption: 2.1,
    efficiency: 168,
    startSoc: 90,
    endSoc: 86,
    path: generatePath(10)
  }
];

export const MOCK_CHARGES: ChargeSession[] = [
  {
    id: 'c1',
    date: '2023-10-24T20:00:00Z',
    location: 'Home',
    addedKwh: 25.5,
    duration: 240,
    avgPower: 6.4,
    maxPower: 7.2,
    chartData: Array.from({ length: 10 }, (_, i) => ({
      time: `${i * 24}m`,
      power: i < 8 ? 7.2 : 3.0,
      soc: 40 + i * 5
    }))
  },
  {
    id: 'c2',
    date: '2023-10-22T14:30:00Z',
    location: 'Supercharger X',
    addedKwh: 35.0,
    duration: 45,
    avgPower: 45.0,
    maxPower: 50.0,
    chartData: Array.from({ length: 10 }, (_, i) => ({
      time: `${i * 5}m`,
      power: 50 - i * 2,
      soc: 10 + i * 8
    }))
  }
];

export const getLiveTelemetry = (): TelemetryData => {
  return {
    timestamp: Date.now(),
    soc: 72,
    range: 184,
    estRange: 184,
    idealRange: 200,
    speed: 0,
    power: -0.2, // Vampire drain
    voltage: 365,
    current: 0.5,
    chargeState: 'stopped',
    odometer: 45231,
    tempBattery: 22,
    tempMotor: 25,
    tempAmbient: 20,
    latitude: 37.7749,
    longitude: -122.4194,
    elevation: 45,
    locationName: "Home Garage"
  };
};
