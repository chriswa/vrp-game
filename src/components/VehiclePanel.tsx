import { useState } from 'react';
import type { Vehicle, VehicleId, Rider, RiderId } from '../types/problem';
import type { Itinerary, ItineraryStop, Solution } from '../types/solution';
import type { VehicleSimResult, SimulatedStop } from '../types/simulation';
import { formatTime } from '../utils/time';

const VEHICLE_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

interface VehiclePanelProps {
  vehicles: Vehicle[];
  solution: Solution;
  vehicleResults: Map<VehicleId, VehicleSimResult>;
  riders: Map<RiderId, Rider>;
  onSolutionChange: (solution: Solution) => void;
}

export function VehiclePanel({
  vehicles,
  solution,
  vehicleResults,
  riders,
  onSolutionChange,
}: VehiclePanelProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <h2 style={{ margin: '0', fontSize: '18px', fontWeight: 600 }}>
        Vehicles
      </h2>

      {vehicles.map((vehicle, index) => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          color={VEHICLE_COLORS[index % VEHICLE_COLORS.length]}
          itinerary={solution.get(vehicle.id) || []}
          simResult={vehicleResults.get(vehicle.id)}
          riders={riders}
          onItineraryChange={(newItinerary) => {
            const newSolution = new Map(solution);
            newSolution.set(vehicle.id, newItinerary);
            onSolutionChange(newSolution);
          }}
        />
      ))}
    </div>
  );
}

interface VehicleCardProps {
  vehicle: Vehicle;
  color: string;
  itinerary: Itinerary;
  simResult?: VehicleSimResult;
  riders: Map<RiderId, Rider>;
  onItineraryChange: (itinerary: Itinerary) => void;
}

function VehicleCard({
  vehicle,
  color,
  itinerary,
  simResult,
  riders,
  onItineraryChange,
}: VehicleCardProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDrop = (e: React.DragEvent, insertIndex: number) => {
    e.preventDefault();
    const riderId = e.dataTransfer.getData('riderId') as RiderId;
    const fromIndex = parseInt(e.dataTransfer.getData('fromIndex'), 10);
    const fromVehicle = e.dataTransfer.getData('fromVehicle');

    if (riderId) {
      // Dropping a new rider from the rider panel
      // Check if already in this vehicle
      const existingPickup = itinerary.findIndex(
        (s) => s.riderId === riderId && s.type === 'pickup'
      );

      if (existingPickup === -1) {
        // Add pickup and dropoff at the drop position
        const newItinerary = [...itinerary];
        newItinerary.splice(insertIndex, 0, { riderId, type: 'pickup' });
        newItinerary.splice(insertIndex + 1, 0, { riderId, type: 'dropoff' });
        onItineraryChange(newItinerary);
      }
    } else if (!isNaN(fromIndex) && fromVehicle === vehicle.id) {
      // Reordering within same vehicle
      const newItinerary = [...itinerary];
      const [moved] = newItinerary.splice(fromIndex, 1);

      // Adjust insert index if we removed before it
      const adjustedIndex = fromIndex < insertIndex ? insertIndex - 1 : insertIndex;
      newItinerary.splice(adjustedIndex, 0, moved);

      // Validate: pickup must come before dropoff for each rider
      const isValid = validateItinerary(newItinerary);
      if (isValid) {
        onItineraryChange(newItinerary);
      }
    }

    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleStopDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('fromIndex', String(index));
    e.dataTransfer.setData('fromVehicle', vehicle.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRemoveRider = (riderId: RiderId) => {
    const newItinerary = itinerary.filter((s) => s.riderId !== riderId);
    onItineraryChange(newItinerary);
  };

  return (
    <div style={{
      padding: '12px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px',
      }}>
        <span style={{ fontWeight: 600 }}>{vehicle.driverName}</span>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>
          {vehicle.seatCount} seats
          {vehicle.wheelchairCapacity > 0 && ` • ${vehicle.wheelchairCapacity} WC`}
        </span>
      </div>

      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
        {formatTime(vehicle.startTime)} - {formatTime(vehicle.endTime)}
        {simResult?.vehicleEnd.minutesLate && (
          <span style={{ color: '#ef4444', marginLeft: '8px' }}>
            Ends {simResult.vehicleEnd.minutesLate.toFixed(0)}min late
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => handleDragOver(e, 0)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 0)}
        style={{
          minHeight: '32px',
          padding: '4px',
          backgroundColor: dragOverIndex === 0 ? '#dbeafe' : 'transparent',
          borderRadius: '4px',
          transition: 'background-color 0.15s',
        }}
      >
        {itinerary.length === 0 && (
          <div style={{
            padding: '12px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px',
            border: '2px dashed #e5e7eb',
            borderRadius: '4px',
          }}>
            Drop riders here
          </div>
        )}
      </div>

      {itinerary.map((stop, index) => (
        <div key={`${stop.riderId}-${stop.type}`}>
          <StopCard
            stop={stop}
            simStop={simResult?.stops[index]}
            rider={riders.get(stop.riderId)}
            index={index}
            onDragStart={(e) => handleStopDragStart(e, index)}
            onRemove={() => handleRemoveRider(stop.riderId)}
          />
          <div
            onDragOver={(e) => handleDragOver(e, index + 1)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index + 1)}
            style={{
              height: dragOverIndex === index + 1 ? '32px' : '4px',
              backgroundColor: dragOverIndex === index + 1 ? '#dbeafe' : 'transparent',
              borderRadius: '4px',
              transition: 'all 0.15s',
            }}
          />
        </div>
      ))}
    </div>
  );
}

interface StopCardProps {
  stop: ItineraryStop;
  simStop?: SimulatedStop;
  rider?: Rider;
  index: number;
  onDragStart: (e: React.DragEvent) => void;
  onRemove: () => void;
}

function StopCard({ stop, simStop, rider, index, onDragStart, onRemove }: StopCardProps) {
  const isPickup = stop.type === 'pickup';
  const hasIssue = simStop?.minutesLate || simStop?.minutesOverMaxTime;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        backgroundColor: hasIssue ? '#fef2f2' : '#f9fafb',
        borderRadius: '4px',
        border: `1px solid ${hasIssue ? '#fecaca' : '#e5e7eb'}`,
        cursor: 'grab',
      }}
    >
      <span style={{
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 500,
        color: '#ffffff',
        backgroundColor: isPickup ? '#22c55e' : '#ef4444',
        borderRadius: '4px',
      }}>
        {index + 1}
      </span>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500 }}>
          {isPickup ? '↑' : '↓'} {rider?.name || stop.riderId}
        </div>
        {simStop && (
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {formatTime(simStop.arrivalTime)}
            {simStop.minutesEarly && (
              <span style={{ color: '#3b82f6', marginLeft: '4px' }}>
                (wait {simStop.minutesEarly.toFixed(0)}min)
              </span>
            )}
            {simStop.minutesLate && (
              <span style={{ color: '#ef4444', marginLeft: '4px' }}>
                ({simStop.minutesLate.toFixed(0)}min late)
              </span>
            )}
            {simStop.minutesOverMaxTime && (
              <span style={{ color: '#ef4444', marginLeft: '4px' }}>
                (+{simStop.minutesOverMaxTime.toFixed(0)}min over max)
              </span>
            )}
          </div>
        )}
      </div>

      {isPickup && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            color: '#6b7280',
            backgroundColor: 'transparent',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function validateItinerary(itinerary: Itinerary): boolean {
  const pickupSeen = new Set<RiderId>();

  for (const stop of itinerary) {
    if (stop.type === 'pickup') {
      pickupSeen.add(stop.riderId);
    } else {
      if (!pickupSeen.has(stop.riderId)) {
        return false; // Dropoff before pickup
      }
    }
  }

  return true;
}
