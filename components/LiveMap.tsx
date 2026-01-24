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
        
        {/* Car Marker */}
        <Marker position={position} icon={iconPerson}>
          <Popup>
            <div className="text-slate-900">
              <strong>BMW i3</strong><br />
              Speed: {telemetry.speed.toFixed(0)} km/h<br />
              SoC: {telemetry.soc}%
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
      <div className="absolute top-4 right-4 z-[400] bg-slate-800/90 backdrop-blur p-3 rounded-lg border border-slate-600 shadow-xl">
         <div className="text-xs text-slate-400">Current Speed</div>
         <div className="text-xl font-mono font-bold text-white">{telemetry.speed.toFixed(0)} <span className="text-xs">km/h</span></div>
      </div>
    </div>
  );
};

export default LiveMap;