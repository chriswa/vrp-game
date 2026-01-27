import type { City, NodeId, Vehicle, VehicleId } from '../types/problem';
import type { VehicleSimResult } from '../types/simulation';
import { lerp } from '../utils/geometry';

export interface VehiclePosition {
  vehicleId: VehicleId;
  x: number;
  y: number;
  passengers: number;
}

// Get vehicle positions at a given time
export function getVehiclePositions(
  vehicles: Vehicle[],
  vehicleResults: Map<VehicleId, VehicleSimResult>,
  city: City,
  currentTime: number
): VehiclePosition[] {
  const positions: VehiclePosition[] = [];

  for (const vehicle of vehicles) {
    const result = vehicleResults.get(vehicle.id);
    const position = getVehiclePosition(vehicle, result, city, currentTime);
    if (position) {
      positions.push(position);
    }
  }

  return positions;
}

function getVehiclePosition(
  vehicle: Vehicle,
  result: VehicleSimResult | undefined,
  city: City,
  currentTime: number
): VehiclePosition | null {
  // Before start time - at start depot
  if (currentTime < vehicle.startTime) {
    const startNode = city.nodes.get(vehicle.startNodeId);
    if (!startNode) return null;
    return {
      vehicleId: vehicle.id,
      x: startNode.x,
      y: startNode.y,
      passengers: 0,
    };
  }

  if (!result || result.stops.length === 0) {
    // No stops - check if traveling to end depot or already there
    const startNode = city.nodes.get(vehicle.startNodeId);
    const endNode = city.nodes.get(vehicle.endNodeId);
    if (!startNode || !endNode) return null;

    // For simplicity, if no stops, vehicle is at start or end
    if (!result || currentTime >= result.vehicleEnd.arrivalTime) {
      return {
        vehicleId: vehicle.id,
        x: endNode.x,
        y: endNode.y,
        passengers: 0,
      };
    }

    // Interpolate between start and end
    const travelStart = vehicle.startTime;
    const travelEnd = result.vehicleEnd.arrivalTime;
    const t = (currentTime - travelStart) / (travelEnd - travelStart);

    return {
      vehicleId: vehicle.id,
      x: lerp(startNode.x, endNode.x, Math.max(0, Math.min(1, t))),
      y: lerp(startNode.y, endNode.y, Math.max(0, Math.min(1, t))),
      passengers: 0,
    };
  }

  // Find current segment
  const stops = result.stops;
  let prevNodeId: NodeId = vehicle.startNodeId;
  let prevDepartureTime = vehicle.startTime;
  let passengers = 0;

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];

    // Between previous and this stop (traveling)
    if (currentTime < stop.arrivalTime) {
      const prevNode = city.nodes.get(prevNodeId);
      const currNode = city.nodes.get(stop.nodeId);
      if (!prevNode || !currNode) return null;

      const t =
        (currentTime - prevDepartureTime) /
        (stop.arrivalTime - prevDepartureTime);

      return {
        vehicleId: vehicle.id,
        x: lerp(prevNode.x, currNode.x, Math.max(0, Math.min(1, t))),
        y: lerp(prevNode.y, currNode.y, Math.max(0, Math.min(1, t))),
        passengers,
      };
    }

    // At this stop
    if (currentTime <= stop.departureTime) {
      const node = city.nodes.get(stop.nodeId);
      if (!node) return null;
      return {
        vehicleId: vehicle.id,
        x: node.x,
        y: node.y,
        passengers: stop.type === 'pickup' ? passengers + 1 : passengers,
      };
    }

    // Update for next iteration
    prevNodeId = stop.nodeId;
    prevDepartureTime = stop.departureTime;
    passengers += stop.type === 'pickup' ? 1 : -1;
  }

  // After last stop - traveling to end or at end
  const lastStop = stops[stops.length - 1];
  const lastNode = city.nodes.get(lastStop.nodeId);
  const endNode = city.nodes.get(vehicle.endNodeId);
  if (!lastNode || !endNode) return null;

  if (currentTime >= result.vehicleEnd.arrivalTime) {
    return {
      vehicleId: vehicle.id,
      x: endNode.x,
      y: endNode.y,
      passengers: 0,
    };
  }

  // Traveling to end
  const t =
    (currentTime - lastStop.departureTime) /
    (result.vehicleEnd.arrivalTime - lastStop.departureTime);

  return {
    vehicleId: vehicle.id,
    x: lerp(lastNode.x, endNode.x, Math.max(0, Math.min(1, t))),
    y: lerp(lastNode.y, endNode.y, Math.max(0, Math.min(1, t))),
    passengers,
  };
}

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

export function drawVehicles(
  ctx: CanvasRenderingContext2D,
  positions: VehiclePosition[],
  vehicleIndex: Map<VehicleId, number>
): void {
  for (const pos of positions) {
    const index = vehicleIndex.get(pos.vehicleId) ?? 0;
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];

    // Draw vehicle as a circle with border
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw passenger count
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pos.passengers), pos.x, pos.y);
  }
}
