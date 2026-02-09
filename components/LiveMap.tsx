import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { TelemetryData, DriveSession } from '../types';
import L from 'leaflet';

// Fix for default Leaflet markers in React
const iconPerson = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Create a rotated icon div if direction is available
const createRotatedIcon = (heading: number) => {
  return L.divIcon({
    className: 'custom-car-icon',
    html: `<div style="transform: rotate(${heading}deg); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="#3b82f6" stroke="white" stroke-width="2"/>
             </svg>
           </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Component to auto-center map when car moves
const RecenterMap = ({ lat, lng }: { lat: number, lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
};

interface LiveMapProps {
  telemetry: TelemetryData;
  activeDrive?: DriveSession | null;
}

const LiveMap: React.FC<LiveMapProps> = ({ telemetry, activeDrive }) => {
  const position: [number, number] = [telemetry.latitude, telemetry.longitude];
  
  // Convert drive path to Leaflet format if a drive is selected
  const trajectory: [number, number][] = activeDrive 
    ? activeDrive.path.map(p => [p.lat, p.lng]) 
    : [];
    
  // Use direction for rotation if moving, otherwise 0
  const heading = telemetry.direction || 0;

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        center={position} 
        zoom={15} 
        scrollWheelZoom={true} 
        className="h-full w-full rounded-xl"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Car Marker - Uses directional arrow if direction available, else standard pin */}
        <Marker 
          position={position} 
          icon={telemetry.speed > 0 || telemetry.direction ? createRotatedIcon(heading) : iconPerson}
        >
          <Popup>
            <div className="text-slate-900">
              <strong>{telemetry.vehicleId || 'EV'}</strong><br />
              Speed: {telemetry.speed.toFixed(0)} km/h<br />
              SoC: {telemetry.soc}%<br/>
              Alt: {telemetry.elevation}m
            </div>
          </Popup>
        </Marker>

        {/* Trajectory Polyline */}
        {trajectory.length > 0 && (
          <Polyline 
            positions={trajectory} 
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.7 }} 
          />
        )}

        {/* Start/End markers for trajectory */}
        {trajectory.length > 0 && (
            <>
                <Marker position={trajectory[0]} opacity={0.6}>
                     <Popup>Start</Popup>
                </Marker>
            </>
        )}

        <RecenterMap lat={position[0]} lng={position[1]} />
      </MapContainer>
      
      {/* Map Overlay Stats */}
      <div className="absolute top-4 right-4 z-[400] bg-slate-800/90 backdrop-blur p-3 rounded-lg border border-slate-600 shadow-xl pointer-events-none">
         <div className="text-xs text-slate-400">Current Speed</div>
         <div className="text-xl font-mono font-bold text-white">{telemetry.speed.toFixed(0)} <span className="text-xs">km/h</span></div>
      </div>
    </div>
  );
};

export default LiveMap;