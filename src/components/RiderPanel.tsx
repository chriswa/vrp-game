import type { Rider, RiderId } from '../types/problem';
import { formatTime } from '../utils/time';

interface RiderPanelProps {
  riders: Rider[];
  unassignedRiderIds: RiderId[];
  onDragStart: (riderId: RiderId) => void;
}

export function RiderPanel({
  riders,
  unassignedRiderIds,
  onDragStart,
}: RiderPanelProps) {
  const unassignedRiders = riders.filter((r) =>
    unassignedRiderIds.includes(r.id)
  );

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
    }}>
      <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
        Unassigned Riders ({unassignedRiders.length})
      </h2>

      {unassignedRiders.length === 0 ? (
        <div style={{
          padding: '12px',
          backgroundColor: '#dcfce7',
          borderRadius: '4px',
          color: '#166534',
          fontSize: '14px',
          textAlign: 'center',
        }}>
          All riders assigned!
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {unassignedRiders.map((rider) => (
            <RiderCard
              key={rider.id}
              rider={rider}
              onDragStart={() => onDragStart(rider.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RiderCardProps {
  rider: Rider;
  onDragStart: () => void;
}

function RiderCard({ rider, onDragStart }: RiderCardProps) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('riderId', rider.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStart();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      style={{
        padding: '10px 12px',
        backgroundColor: '#f9fafb',
        borderRadius: '6px',
        border: '1px solid #e5e7eb',
        cursor: 'grab',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span style={{ fontWeight: 500 }}>{rider.name}</span>
        {rider.accessibility.needsWheelchair && (
          <span style={{
            fontSize: '12px',
            padding: '2px 6px',
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            borderRadius: '4px',
          }}>
            Wheelchair
          </span>
        )}
      </div>

      <div style={{ fontSize: '12px', color: '#6b7280' }}>
        {rider.pickupWindow && (
          <div>
            Pickup: {formatTime(rider.pickupWindow.earliest)} - {formatTime(rider.pickupWindow.latest)}
          </div>
        )}
        {rider.dropoffWindow && (
          <div>
            Dropoff: {formatTime(rider.dropoffWindow.earliest)} - {formatTime(rider.dropoffWindow.latest)}
          </div>
        )}
        {rider.maxTimeInVehicle && (
          <div>Max time: {rider.maxTimeInVehicle} min</div>
        )}
      </div>
    </div>
  );
}
