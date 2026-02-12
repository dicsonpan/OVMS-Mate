
import { ChargeSession, OvmsConfig, ChargingLocation, TariffSegment } from '../types';

/**
 * Finds a matching location config based on the session's location string.
 * Performs a case-insensitive, trimmed comparison.
 */
const findLocationConfig = (locationName: string, config: OvmsConfig): ChargingLocation | undefined => {
  if (!config.locations || !locationName) return undefined;
  
  const normalize = (s: string) => s.toLowerCase().trim();
  const target = normalize(locationName);

  return config.locations.find(loc => normalize(loc.name) === target);
};

/**
 * Gets the rate for a specific hour of the day from a list of segments.
 * Handles midnight wrapping (e.g., 22:00 - 06:00).
 */
const getRateForTime = (date: Date, segments: TariffSegment[]): number => {
  const hour = date.getHours();
  
  for (const seg of segments) {
    // Normal range: 06:00 - 22:00
    if (seg.startHour <= seg.endHour) {
      if (hour >= seg.startHour && hour < seg.endHour) {
        return seg.rate;
      }
    } 
    // Wrapping range: 22:00 - 06:00 (Start > End)
    else {
      if (hour >= seg.startHour || hour < seg.endHour) {
        return seg.rate;
      }
    }
  }
  
  // Fallback if gaps exist in schedule (shouldn't happen if config is good)
  return segments.length > 0 ? segments[0].rate : 0;
};

/**
 * Calculates the total cost of a charging session.
 * 
 * Strategy:
 * 1. If we have chartData (power samples), we integrate (Riemann sum) power over time,
 *    applying the specific rate for each time interval. This is very accurate.
 * 2. If no chartData, we fallback to a simple (Total kWh * Rate at Start Time).
 */
export const calculateSessionCost = (session: ChargeSession, config: OvmsConfig): number => {
  const defaultRate = config.costPerKwh || 0;
  const locationConfig = findLocationConfig(session.location, config);

  // Case 1: Unknown Location -> Use Default Flat Rate
  if (!locationConfig) {
    return session.addedKwh * defaultRate;
  }

  // Case 2: Known Location, Flat Rate
  if (locationConfig.isFlatRate) {
    return session.addedKwh * (locationConfig.flatRate || defaultRate);
  }

  // Case 3: Known Location, Time-of-Use (TOU)
  // We need chart data to calculate this accurately.
  if (!session.chartData || session.chartData.length < 2) {
    // Fallback: Use rate at start time
    const startRate = locationConfig.timeSlots 
      ? getRateForTime(new Date(session.date), locationConfig.timeSlots) 
      : defaultRate;
    return session.addedKwh * startRate;
  }

  let totalCost = 0;
  const segments = locationConfig.timeSlots || [];

  // Iterate through chart points to calculate energy in each interval
  for (let i = 0; i < session.chartData.length - 1; i++) {
    const p1 = session.chartData[i];
    const p2 = session.chartData[i+1];

    const t1 = p1.timestamp;
    const t2 = p2.timestamp;
    
    // Duration in hours
    const durationHours = (t2 - t1) / (1000 * 60 * 60);
    
    // Average power in this interval (kW)
    // Using trapezoidal rule approximation or just simple average
    const avgPowerKw = (p1.power + p2.power) / 2;
    
    // Energy added in this tiny interval (kWh)
    const energyKwh = avgPowerKw * durationHours;

    // Determine rate at the midpoint of this interval
    const midTime = new Date((t1 + t2) / 2);
    const rate = getRateForTime(midTime, segments);

    totalCost += energyKwh * rate;
  }

  return totalCost;
};
