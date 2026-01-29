import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { Problem, RiderId, VehicleId } from '../types/problem';
import type { Solution } from '../types/solution';
import type { SimulationResult } from '../types/simulation';
import { drawCity } from './drawCity';
import { drawRoutes, drawAllRiders, findRiderAtPosition } from './drawRoutes';
import { drawVehicles, getVehiclePositions } from './drawVehicles';
import { PathCache } from '../pathfinding/pathCache';

interface MapCanvasProps {
  problem: Problem;
  solution: Solution;
  simulationResult: SimulationResult;
  currentTime: number;
  pathCache: PathCache;
  riderNumbers: Map<RiderId, number>;
  selectedRiderId: RiderId | null;
  selectedVehicleId: VehicleId | null;
  hoveredRiderId: RiderId | null;
  onRiderClick?: (riderId: RiderId) => void;
  onRiderHover?: (riderId: RiderId | null) => void;
  onVehicleClick?: (vehicleId: VehicleId) => void;
  width?: number;
  height?: number;
}

export function MapCanvas({
  problem,
  solution,
  simulationResult,
  currentTime,
  pathCache,
  riderNumbers,
  selectedRiderId,
  selectedVehicleId,
  hoveredRiderId,
  onRiderClick,
  onRiderHover,
  onVehicleClick,
  width = 500,
  height = 500,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [localHoveredRider, setLocalHoveredRider] = useState<RiderId | null>(null);
  const [hoveringVehicle, setHoveringVehicle] = useState(false);

  // Combine external hover with local hover
  const effectiveHoveredRider = hoveredRiderId ?? localHoveredRider;

  // Build lookup maps
  const vehicleIndex = useMemo(() => {
    const map = new Map<VehicleId, number>();
    problem.vehicles.forEach((v, i) => map.set(v.id, i));
    return map;
  }, [problem.vehicles]);

  const riderMap = useMemo(() => {
    const map = new Map<RiderId, typeof problem.riders[0]>();
    problem.riders.forEach((r) => map.set(r.id, r));
    return map;
  }, [problem.riders]);

  // Get assigned riders
  const assignedRiders = useMemo(() => {
    const set = new Set<RiderId>();
    for (const [, itinerary] of solution) {
      for (const stop of itinerary) {
        if (stop.type === 'pickup') {
          set.add(stop.riderId);
        }
      }
    }
    return set;
  }, [solution]);

  // Calculate map bounds and scale
  const { mapBounds, scale, offset } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (const node of problem.city.nodes.values()) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    }

    const mapW = maxX - minX;
    const mapH = maxY - minY;
    const padding = 20;

    // Scale to fit canvas
    const scaleX = (width - padding * 2) / mapW;
    const scaleY = (height - padding * 2) / mapH;
    const s = Math.min(scaleX, scaleY);

    // Center offset
    const offsetX = (width - mapW * s) / 2 - minX * s;
    const offsetY = (height - mapH * s) / 2 - minY * s;

    return {
      mapBounds: { minX, maxX, minY, maxY, width: mapW, height: mapH },
      scale: s,
      offset: { x: offsetX, y: offsetY },
    };
  }, [problem.city.nodes, width, height]);

  // Transform canvas coordinates to world coordinates
  const toWorld = useCallback((cx: number, cy: number) => ({
    x: (cx - offset.x) / scale,
    y: (cy - offset.y) / scale,
  }), [scale, offset]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const world = toWorld(cx, cy);

      // Check if clicking on a vehicle (in world coordinates)
      const vehiclePositions = getVehiclePositions(
        problem.vehicles,
        simulationResult.vehicleResults,
        problem.city,
        currentTime,
        pathCache
      );
      for (const vp of vehiclePositions) {
        const dx = vp.x - world.x;
        const dy = vp.y - world.y;
        const threshold = 12 / scale;
        if (dx * dx + dy * dy <= threshold * threshold) {
          onVehicleClick?.(vp.vehicleId);
          return;
        }
      }

      // Check if clicking on a rider marker
      const threshold = 12 / scale;
      const riderHit = findRiderAtPosition(world.x, world.y, problem.riders, problem.city, threshold);
      if (riderHit) {
        onRiderClick?.(riderHit.riderId);
      }
    },
    [problem.riders, problem.vehicles, problem.city, simulationResult.vehicleResults, currentTime, pathCache, onRiderClick, onVehicleClick, toWorld, scale]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const world = toWorld(cx, cy);

      // Check if hovering over a vehicle
      const vehiclePositions = getVehiclePositions(
        problem.vehicles,
        simulationResult.vehicleResults,
        problem.city,
        currentTime,
        pathCache
      );
      let isOverVehicle = false;
      const threshold = 12 / scale;
      for (const vp of vehiclePositions) {
        const dx = vp.x - world.x;
        const dy = vp.y - world.y;
        if (dx * dx + dy * dy <= threshold * threshold) {
          isOverVehicle = true;
          break;
        }
      }
      setHoveringVehicle(isOverVehicle);

      // Check if hovering over a rider marker
      const riderHit = findRiderAtPosition(world.x, world.y, problem.riders, problem.city, threshold);
      const newHoveredRider = riderHit?.riderId ?? null;

      if (newHoveredRider !== localHoveredRider) {
        setLocalHoveredRider(newHoveredRider);
        onRiderHover?.(newHoveredRider);
      }
    },
    [problem.riders, problem.vehicles, problem.city, simulationResult.vehicleResults, currentTime, pathCache, localHoveredRider, onRiderHover, toWorld, scale]
  );

  const handleMouseLeave = useCallback(() => {
    setLocalHoveredRider(null);
    setHoveringVehicle(false);
    onRiderHover?.(null);
  }, [onRiderHover]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Apply transform for scaling
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw city (roads and nodes)
    drawCity(ctx, problem.city, { scale });

    // Draw unassigned rider markers first (behind routes)
    drawAllRiders(
      ctx,
      problem.riders,
      riderNumbers,
      problem.city,
      assignedRiders,
      effectiveHoveredRider,
      selectedRiderId,
      scale
    );

    // Draw planned routes (includes assigned rider markers)
    drawRoutes(
      ctx,
      problem.vehicles,
      solution,
      riderMap,
      problem.city,
      vehicleIndex,
      {
        pathCache,
        riderNumbers,
        currentTime,
        vehicleResults: simulationResult.vehicleResults,
        hoveredRiderId: effectiveHoveredRider,
        selectedRiderId,
        selectedVehicleId,
        mapWidth: mapBounds.width,
        scale,
      }
    );

    // Draw curved arrow for hovered rider (only when hovered, not just selected)
    if (effectiveHoveredRider) {
      const rider = riderMap.get(effectiveHoveredRider);
      if (rider) {
        const pickupNode = problem.city.nodes.get(rider.pickupNodeId);
        const dropoffNode = problem.city.nodes.get(rider.dropoffNodeId);
        if (pickupNode && dropoffNode) {
          drawCurvedArrow(ctx, pickupNode.x, pickupNode.y, dropoffNode.x, dropoffNode.y, scale);
        }
      }
    }

    // Draw vehicles at current positions
    const vehiclePositions = getVehiclePositions(
      problem.vehicles,
      simulationResult.vehicleResults,
      problem.city,
      currentTime,
      pathCache
    );
    drawVehicles(ctx, vehiclePositions, vehicleIndex, scale);

    ctx.restore();
  }, [
    problem,
    solution,
    simulationResult,
    currentTime,
    width,
    height,
    vehicleIndex,
    riderMap,
    assignedRiders,
    pathCache,
    riderNumbers,
    selectedRiderId,
    selectedVehicleId,
    effectiveHoveredRider,
    mapBounds.width,
    scale,
    offset,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        cursor: (localHoveredRider || hoveringVehicle) ? 'pointer' : 'default',
      }}
    />
  );
}

// Draw a curved arrow from pickup to dropoff
function drawCurvedArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  scale: number
): void {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Calculate control point (perpendicular to the line)
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;
  const perpX = -dy / dist;
  const perpY = dx / dist;
  const curvature = dist * 0.3;
  const ctrlX = midX + perpX * curvature;
  const ctrlY = midY + perpY * curvature;

  // Draw the curved line
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.quadraticCurveTo(ctrlX, ctrlY, toX, toY);
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
  ctx.lineWidth = 2 / scale;
  ctx.setLineDash([6 / scale, 4 / scale]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw arrowhead at the end
  const arrowSize = 8 / scale;
  const angle = Math.atan2(toY - ctrlY, toX - ctrlX);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - arrowSize * Math.cos(angle - Math.PI / 6),
    toY - arrowSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - arrowSize * Math.cos(angle + Math.PI / 6),
    toY - arrowSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
  ctx.fill();
}
