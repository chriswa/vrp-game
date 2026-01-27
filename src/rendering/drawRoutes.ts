import type { City, NodeId, RiderId, Vehicle, VehicleId } from '../types/problem';
import type { Rider } from '../types/problem';
import type { Itinerary } from '../types/solution';
import type { VehicleSimResult } from '../types/simulation';
import { PathCache } from '../pathfinding/pathCache';
import { VEHICLE_COLORS } from './drawVehicles';

export interface DrawRoutesOptions {
  pathCache: PathCache;
  riderNumbers: Map<RiderId, number>;
  currentTime: number;
  vehicleResults: Map<VehicleId, VehicleSimResult>;
  hoveredRiderId: RiderId | null;
  selectedRiderId: RiderId | null;
  mapWidth: number; // for opacity fade calculation
}

export function drawRoutes(
  ctx: CanvasRenderingContext2D,
  vehicles: Vehicle[],
  itineraries: Map<VehicleId, Itinerary>,
  riders: Map<RiderId, Rider>,
  city: City,
  vehicleIndex: Map<VehicleId, number>,
  options: DrawRoutesOptions
): void {
  const { pathCache, riderNumbers, currentTime, vehicleResults, hoveredRiderId, selectedRiderId, mapWidth } = options;

  for (const vehicle of vehicles) {
    const itinerary = itineraries.get(vehicle.id) || [];
    const index = vehicleIndex.get(vehicle.id) ?? 0;
    const color = VEHICLE_COLORS[index % VEHICLE_COLORS.length];
    const simResult = vehicleResults.get(vehicle.id);

    // Build segments with timing info
    const segments = buildRouteSegments(vehicle, itinerary, riders, city, pathCache, simResult);

    // Draw route lines with time-based visibility and distance-based opacity
    drawRouteLines(ctx, segments, city, currentTime, color, mapWidth);

    // Draw stop markers with rider numbers
    for (const stop of itinerary) {
      const rider = riders.get(stop.riderId);
      if (!rider) continue;

      const nodeId = stop.type === 'pickup' ? rider.pickupNodeId : rider.dropoffNodeId;
      const node = city.nodes.get(nodeId);
      if (!node) continue;

      const riderNum = riderNumbers.get(stop.riderId) ?? 0;
      const isHovered = stop.riderId === hoveredRiderId;
      const isSelected = stop.riderId === selectedRiderId;
      drawRiderMarker(ctx, node.x, node.y, riderNum, stop.type === 'pickup', color, isHovered || isSelected);
    }
  }
}

interface RouteSegment {
  path: NodeId[];
  departureTime: number;
  arrivalTime: number;
}

function buildRouteSegments(
  vehicle: Vehicle,
  itinerary: Itinerary,
  riders: Map<RiderId, Rider>,
  _city: City,
  pathCache: PathCache,
  simResult: VehicleSimResult | undefined
): RouteSegment[] {
  const segments: RouteSegment[] = [];

  // Build node sequence
  const nodeSequence: { nodeId: NodeId; departureTime: number; arrivalTime: number }[] = [];

  // Start depot
  nodeSequence.push({
    nodeId: vehicle.startNodeId,
    departureTime: vehicle.startTime,
    arrivalTime: vehicle.startTime,
  });

  // Stops
  if (simResult) {
    for (let i = 0; i < itinerary.length; i++) {
      const stop = itinerary[i];
      const simStop = simResult.stops[i];
      const rider = riders.get(stop.riderId);
      if (!rider || !simStop) continue;

      nodeSequence.push({
        nodeId: simStop.nodeId,
        arrivalTime: simStop.arrivalTime,
        departureTime: simStop.departureTime,
      });
    }
  }

  // End depot
  if (simResult) {
    nodeSequence.push({
      nodeId: vehicle.endNodeId,
      arrivalTime: simResult.vehicleEnd.arrivalTime,
      departureTime: simResult.vehicleEnd.arrivalTime,
    });
  }

  // Build segments between consecutive nodes
  for (let i = 0; i < nodeSequence.length - 1; i++) {
    const from = nodeSequence[i];
    const to = nodeSequence[i + 1];
    const pathResult = pathCache.getPath(from.nodeId, to.nodeId);

    if (pathResult && pathResult.path.length > 1) {
      segments.push({
        path: pathResult.path,
        departureTime: from.departureTime,
        arrivalTime: to.arrivalTime,
      });
    }
  }

  return segments;
}

function drawRouteLines(
  ctx: CanvasRenderingContext2D,
  segments: RouteSegment[],
  city: City,
  currentTime: number,
  color: string,
  mapWidth: number
): void {
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  // Calculate cumulative distance from current position
  let cumulativeDistanceAhead = 0;
  let foundCurrentPosition = false;

  for (const segment of segments) {
    // Skip segments entirely in the past
    if (segment.arrivalTime <= currentTime) {
      continue;
    }

    // Calculate path points and distances
    const points: { x: number; y: number }[] = [];
    const segmentDistances: number[] = [];
    let totalSegmentLength = 0;

    for (let i = 0; i < segment.path.length; i++) {
      const node = city.nodes.get(segment.path[i]);
      if (!node) continue;
      points.push({ x: node.x, y: node.y });

      if (i > 0) {
        const prev = points[points.length - 2];
        const dist = Math.sqrt((node.x - prev.x) ** 2 + (node.y - prev.y) ** 2);
        segmentDistances.push(dist);
        totalSegmentLength += dist;
      }
    }

    if (points.length < 2) continue;

    // Determine start point based on current time
    let startIdx = 0;
    let startProgress = 0;

    if (segment.departureTime < currentTime && currentTime < segment.arrivalTime) {
      // Currently traveling this segment - interpolate start position
      foundCurrentPosition = true;
      const timeProgress = (currentTime - segment.departureTime) / (segment.arrivalTime - segment.departureTime);
      const targetDist = timeProgress * totalSegmentLength;

      let accumulated = 0;
      for (let i = 0; i < segmentDistances.length; i++) {
        if (accumulated + segmentDistances[i] >= targetDist) {
          startIdx = i;
          startProgress = (targetDist - accumulated) / segmentDistances[i];
          break;
        }
        accumulated += segmentDistances[i];
      }
    } else if (!foundCurrentPosition) {
      // This segment is in the future, add its distance
      cumulativeDistanceAhead += totalSegmentLength;
    }

    // Draw each edge of this segment with appropriate opacity
    for (let i = startIdx; i < points.length - 1; i++) {
      let fromX = points[i].x;
      let fromY = points[i].y;
      const toX = points[i + 1].x;
      const toY = points[i + 1].y;

      // Interpolate start if this is the current edge
      if (i === startIdx && startProgress > 0) {
        fromX = fromX + (toX - fromX) * startProgress;
        fromY = fromY + (toY - fromY) * startProgress;
      }

      // Calculate opacity based on distance ahead
      const edgeDist = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
      const distanceFromCurrent = cumulativeDistanceAhead;
      cumulativeDistanceAhead += (i === startIdx ? edgeDist * (1 - startProgress) : edgeDist);

      // Opacity calculation:
      // 0 to 1 mapWidth: full opacity (1.0)
      // 1 to 3 mapWidths: linear fade to 0
      // Beyond 3 mapWidths: don't draw
      let opacity = 1.0;
      if (distanceFromCurrent > mapWidth) {
        if (distanceFromCurrent > mapWidth * 3) {
          continue; // Don't draw
        }
        opacity = 1.0 - (distanceFromCurrent - mapWidth) / (mapWidth * 2);
      }

      ctx.beginPath();
      ctx.strokeStyle = hexToRgba(color, opacity);
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }
  }

  ctx.setLineDash([]);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRiderMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  riderNum: number,
  isPickup: boolean,
  color: string,
  isHighlighted: boolean
): void {
  const size = isHighlighted ? 10 : 8;

  ctx.beginPath();
  if (isPickup) {
    // Upward triangle - number centered in lower portion
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.8, y + size * 0.6);
    ctx.lineTo(x + size * 0.8, y + size * 0.6);
  } else {
    // Downward triangle - number centered in upper portion
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size * 0.8, y - size * 0.6);
    ctx.lineTo(x + size * 0.8, y - size * 0.6);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = isHighlighted ? '#1e3a8a' : '#1f2937';
  ctx.lineWidth = isHighlighted ? 2 : 1;
  ctx.stroke();

  // Draw rider number - centered properly
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isHighlighted ? 9 : 8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Offset to center in the wider part of triangle
  const textY = isPickup ? y + size * 0.1 : y - size * 0.1;
  ctx.fillText(String(riderNum), x, textY);
}

// Draw pickup/dropoff indicators for unassigned riders
export function drawAllRiders(
  ctx: CanvasRenderingContext2D,
  riders: Rider[],
  riderNumbers: Map<RiderId, number>,
  city: City,
  assignedRiders: Set<RiderId>,
  hoveredRiderId: RiderId | null,
  selectedRiderId: RiderId | null
): void {
  // Group markers by position to handle overlaps
  const positionGroups = new Map<string, { x: number; y: number; markers: { riderId: RiderId; type: 'pickup' | 'dropoff' }[] }>();

  for (const rider of riders) {
    if (assignedRiders.has(rider.id)) continue;

    const pickupNode = city.nodes.get(rider.pickupNodeId);
    const dropoffNode = city.nodes.get(rider.dropoffNodeId);

    if (pickupNode) {
      const key = `${Math.round(pickupNode.x)},${Math.round(pickupNode.y)}`;
      if (!positionGroups.has(key)) {
        positionGroups.set(key, { x: pickupNode.x, y: pickupNode.y, markers: [] });
      }
      positionGroups.get(key)!.markers.push({ riderId: rider.id, type: 'pickup' });
    }

    if (dropoffNode) {
      const key = `${Math.round(dropoffNode.x)},${Math.round(dropoffNode.y)}`;
      if (!positionGroups.has(key)) {
        positionGroups.set(key, { x: dropoffNode.x, y: dropoffNode.y, markers: [] });
      }
      positionGroups.get(key)!.markers.push({ riderId: rider.id, type: 'dropoff' });
    }
  }

  // Draw each group with offsets for overlaps
  for (const group of positionGroups.values()) {
    const count = group.markers.length;

    for (let i = 0; i < count; i++) {
      const marker = group.markers[i];
      const riderNum = riderNumbers.get(marker.riderId) ?? 0;
      const isHovered = marker.riderId === hoveredRiderId;
      const isSelected = marker.riderId === selectedRiderId;

      // Calculate offset for overlapping markers
      let offsetX = 0;
      let offsetY = 0;
      if (count > 1) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const radius = 12;
        offsetX = Math.cos(angle) * radius;
        offsetY = Math.sin(angle) * radius;
      }

      const x = group.x + offsetX;
      const y = group.y + offsetY;

      const color = isHovered || isSelected ? '#3b82f6' : '#6b7280';
      drawUnassignedMarker(ctx, x, y, riderNum, marker.type === 'pickup', color, isHovered || isSelected);
    }
  }
}

function drawUnassignedMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  riderNum: number,
  isPickup: boolean,
  color: string,
  isHighlighted: boolean
): void {
  const size = isHighlighted ? 10 : 8;

  ctx.beginPath();
  if (isPickup) {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.8, y + size * 0.6);
    ctx.lineTo(x + size * 0.8, y + size * 0.6);
  } else {
    ctx.moveTo(x, y + size);
    ctx.lineTo(x - size * 0.8, y - size * 0.6);
    ctx.lineTo(x + size * 0.8, y - size * 0.6);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = isHighlighted ? '#1e3a8a' : '#374151';
  ctx.lineWidth = isHighlighted ? 2 : 1;
  ctx.stroke();

  // Draw rider number - centered properly
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${isHighlighted ? 9 : 8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const textY = isPickup ? y + size * 0.1 : y - size * 0.1;
  ctx.fillText(String(riderNum), x, textY);
}

// Find rider at position (for click/hover detection)
export function findRiderAtPosition(
  x: number,
  y: number,
  riders: Rider[],
  city: City,
  threshold: number = 12
): { riderId: RiderId; type: 'pickup' | 'dropoff' } | null {
  for (const rider of riders) {
    const pickupNode = city.nodes.get(rider.pickupNodeId);
    if (pickupNode) {
      const dx = pickupNode.x - x;
      const dy = pickupNode.y - y;
      if (dx * dx + dy * dy <= threshold * threshold) {
        return { riderId: rider.id, type: 'pickup' };
      }
    }

    const dropoffNode = city.nodes.get(rider.dropoffNodeId);
    if (dropoffNode) {
      const dx = dropoffNode.x - x;
      const dy = dropoffNode.y - y;
      if (dx * dx + dy * dy <= threshold * threshold) {
        return { riderId: rider.id, type: 'dropoff' };
      }
    }
  }
  return null;
}
