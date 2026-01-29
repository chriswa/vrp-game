import type { City, NodeId, Vehicle, VehicleId } from '../types/problem';
import type { VehicleSimResult } from '../types/simulation';
import { PathCache } from '../pathfinding/pathCache';
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
  currentTime: number,
  pathCache: PathCache
): VehiclePosition[] {
  const positions: VehiclePosition[] = [];

  for (const vehicle of vehicles) {
    const result = vehicleResults.get(vehicle.id);
    const position = getVehiclePosition(vehicle, result, city, currentTime, pathCache);
    if (position) {
      positions.push(position);
    }
  }

  return positions;
}

// Interpolate position along a path given a progress value (0-1)
function interpolateAlongPath(
  city: City,
  path: NodeId[],
  progress: number
): { x: number; y: number } | null {
  if (path.length === 0) return null;
  if (path.length === 1) {
    const node = city.nodes.get(path[0]);
    return node ? { x: node.x, y: node.y } : null;
  }

  // Calculate total path length
  let totalLength = 0;
  const segmentLengths: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = city.nodes.get(path[i]);
    const to = city.nodes.get(path[i + 1]);
    if (!from || !to) return null;
    const len = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    segmentLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    const node = city.nodes.get(path[0]);
    return node ? { x: node.x, y: node.y } : null;
  }

  // Find which segment we're on
  const targetDist = progress * totalLength;
  let accumulatedDist = 0;
  for (let i = 0; i < segmentLengths.length; i++) {
    const segmentLen = segmentLengths[i];
    if (accumulatedDist + segmentLen >= targetDist) {
      const from = city.nodes.get(path[i])!;
      const to = city.nodes.get(path[i + 1])!;
      const segmentProgress = segmentLen > 0 ? (targetDist - accumulatedDist) / segmentLen : 0;
      return {
        x: lerp(from.x, to.x, Math.max(0, Math.min(1, segmentProgress))),
        y: lerp(from.y, to.y, Math.max(0, Math.min(1, segmentProgress))),
      };
    }
    accumulatedDist += segmentLen;
  }

  // At the end
  const lastNode = city.nodes.get(path[path.length - 1]);
  return lastNode ? { x: lastNode.x, y: lastNode.y } : null;
}

function getVehiclePosition(
  vehicle: Vehicle,
  result: VehicleSimResult | undefined,
  city: City,
  currentTime: number,
  pathCache: PathCache
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

    // Interpolate along path between start and end
    const travelStart = vehicle.startTime;
    const travelEnd = result.vehicleEnd.arrivalTime;
    const t = (currentTime - travelStart) / (travelEnd - travelStart);

    const pathResult = pathCache.getPath(vehicle.startNodeId, vehicle.endNodeId);
    if (pathResult) {
      const pos = interpolateAlongPath(city, pathResult.path, Math.max(0, Math.min(1, t)));
      if (pos) {
        return { vehicleId: vehicle.id, ...pos, passengers: 0 };
      }
    }

    // Fallback to direct line
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
      const t =
        (currentTime - prevDepartureTime) /
        (stop.arrivalTime - prevDepartureTime);

      const pathResult = pathCache.getPath(prevNodeId, stop.nodeId);
      if (pathResult) {
        const pos = interpolateAlongPath(city, pathResult.path, Math.max(0, Math.min(1, t)));
        if (pos) {
          return { vehicleId: vehicle.id, ...pos, passengers };
        }
      }

      // Fallback to direct line
      const prevNode = city.nodes.get(prevNodeId);
      const currNode = city.nodes.get(stop.nodeId);
      if (!prevNode || !currNode) return null;

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
  const endNode = city.nodes.get(vehicle.endNodeId);
  if (!endNode) return null;

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

  const pathResult = pathCache.getPath(lastStop.nodeId, vehicle.endNodeId);
  if (pathResult) {
    const pos = interpolateAlongPath(city, pathResult.path, Math.max(0, Math.min(1, t)));
    if (pos) {
      return { vehicleId: vehicle.id, ...pos, passengers };
    }
  }

  // Fallback
  const lastNode = city.nodes.get(lastStop.nodeId);
  if (!lastNode) return null;

  return {
    vehicleId: vehicle.id,
    x: lerp(lastNode.x, endNode.x, Math.max(0, Math.min(1, t))),
    y: lerp(lastNode.y, endNode.y, Math.max(0, Math.min(1, t))),
    passengers,
  };
}

export const VEHICLE_COLORS = [
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
  vehicleIndex: Map<VehicleId, number>,
  scale: number = 1
): void {
  const radius = 10 / scale;
  const fontSize = 9 / scale;

  for (const pos of positions) {
    const index = vehicleIndex.get(pos.vehicleId) ?? 0;
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];

    // Draw vehicle as a circle with border
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2 / scale;
    ctx.stroke();

    // Draw passenger count
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pos.passengers), pos.x, pos.y);
  }
}
