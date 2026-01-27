import type { City, NodeId, RiderId, Vehicle, VehicleId } from '../types/problem';
import type { Rider } from '../types/problem';
import type { Itinerary } from '../types/solution';

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

export interface DrawRoutesOptions {
  showRouteLines?: boolean;
  showStopMarkers?: boolean;
}

export function drawRoutes(
  ctx: CanvasRenderingContext2D,
  vehicles: Vehicle[],
  itineraries: Map<VehicleId, Itinerary>,
  riders: Map<RiderId, Rider>,
  city: City,
  vehicleIndex: Map<VehicleId, number>,
  options: DrawRoutesOptions = {}
): void {
  const { showRouteLines = true, showStopMarkers = true } = options;

  for (const vehicle of vehicles) {
    const itinerary = itineraries.get(vehicle.id);
    if (!itinerary || itinerary.length === 0) continue;

    const index = vehicleIndex.get(vehicle.id) ?? 0;
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];

    // Build node sequence
    const nodeSequence: NodeId[] = [vehicle.startNodeId];
    for (const stop of itinerary) {
      const rider = riders.get(stop.riderId);
      if (!rider) continue;
      nodeSequence.push(
        stop.type === 'pickup' ? rider.pickupNodeId : rider.dropoffNodeId
      );
    }
    nodeSequence.push(vehicle.endNodeId);

    // Draw route lines
    if (showRouteLines) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      for (let i = 0; i < nodeSequence.length; i++) {
        const node = city.nodes.get(nodeSequence[i]);
        if (!node) continue;
        if (i === 0) {
          ctx.moveTo(node.x, node.y);
        } else {
          ctx.lineTo(node.x, node.y);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw stop markers
    if (showStopMarkers) {
      for (let i = 0; i < itinerary.length; i++) {
        const stop = itinerary[i];
        const rider = riders.get(stop.riderId);
        if (!rider) continue;

        const nodeId =
          stop.type === 'pickup' ? rider.pickupNodeId : rider.dropoffNodeId;
        const node = city.nodes.get(nodeId);
        if (!node) continue;

        // Draw marker
        ctx.beginPath();

        if (stop.type === 'pickup') {
          // Pickup: upward triangle
          ctx.moveTo(node.x, node.y - 10);
          ctx.lineTo(node.x - 7, node.y + 5);
          ctx.lineTo(node.x + 7, node.y + 5);
        } else {
          // Dropoff: downward triangle
          ctx.moveTo(node.x, node.y + 10);
          ctx.lineTo(node.x - 7, node.y - 5);
          ctx.lineTo(node.x + 7, node.y - 5);
        }

        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw order number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), node.x, node.y);
      }
    }
  }
}

// Draw pickup/dropoff indicators for unassigned riders
export function drawUnassignedRiders(
  ctx: CanvasRenderingContext2D,
  riders: Rider[],
  city: City
): void {
  for (const rider of riders) {
    // Draw pickup location
    const pickupNode = city.nodes.get(rider.pickupNodeId);
    if (pickupNode) {
      ctx.beginPath();
      ctx.arc(pickupNode.x, pickupNode.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.stroke();

      // "P" for pickup
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', pickupNode.x, pickupNode.y);
    }

    // Draw dropoff location
    const dropoffNode = city.nodes.get(rider.dropoffNodeId);
    if (dropoffNode) {
      ctx.beginPath();
      ctx.arc(dropoffNode.x, dropoffNode.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.stroke();

      // "D" for dropoff
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('D', dropoffNode.x, dropoffNode.y);
    }
  }
}
