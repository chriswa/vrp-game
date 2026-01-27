import { useRef, useEffect, useCallback, useState } from 'react';
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
  const vehicleIndex = new Map<VehicleId, number>();
  problem.vehicles.forEach((v, i) => vehicleIndex.set(v.id, i));

  const riderMap = new Map<RiderId, typeof problem.riders[0]>();
  problem.riders.forEach((r) => riderMap.set(r.id, r));

  // Get assigned riders
  const assignedRiders = new Set<RiderId>();
  for (const [, itinerary] of solution) {
    for (const stop of itinerary) {
      if (stop.type === 'pickup') {
        assignedRiders.add(stop.riderId);
      }
    }
  }

  // Calculate map width (for opacity fade)
  let minX = Infinity, maxX = -Infinity;
  for (const node of problem.city.nodes.values()) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
  }
  const mapWidth = maxX - minX;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if clicking on a vehicle
      const vehiclePositions = getVehiclePositions(
        problem.vehicles,
        simulationResult.vehicleResults,
        problem.city,
        currentTime,
        pathCache
      );
      for (const vp of vehiclePositions) {
        const dx = vp.x - x;
        const dy = vp.y - y;
        if (dx * dx + dy * dy <= 12 * 12) {
          onVehicleClick?.(vp.vehicleId);
          return;
        }
      }

      // Check if clicking on a rider marker
      const riderHit = findRiderAtPosition(x, y, problem.riders, problem.city);
      if (riderHit) {
        onRiderClick?.(riderHit.riderId);
      }
    },
    [problem.riders, problem.vehicles, problem.city, simulationResult.vehicleResults, currentTime, pathCache, onRiderClick, onVehicleClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Check if hovering over a vehicle
      const vehiclePositions = getVehiclePositions(
        problem.vehicles,
        simulationResult.vehicleResults,
        problem.city,
        currentTime,
        pathCache
      );
      let isOverVehicle = false;
      for (const vp of vehiclePositions) {
        const dx = vp.x - x;
        const dy = vp.y - y;
        if (dx * dx + dy * dy <= 12 * 12) {
          isOverVehicle = true;
          break;
        }
      }
      setHoveringVehicle(isOverVehicle);

      // Check if hovering over a rider marker
      const riderHit = findRiderAtPosition(x, y, problem.riders, problem.city);
      const newHoveredRider = riderHit?.riderId ?? null;

      if (newHoveredRider !== localHoveredRider) {
        setLocalHoveredRider(newHoveredRider);
        onRiderHover?.(newHoveredRider);
      }
    },
    [problem.riders, problem.vehicles, problem.city, simulationResult.vehicleResults, currentTime, pathCache, localHoveredRider, onRiderHover]
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

    // Draw city (roads and nodes)
    drawCity(ctx, problem.city, {});

    // Draw unassigned rider markers first (behind routes)
    drawAllRiders(
      ctx,
      problem.riders,
      riderNumbers,
      problem.city,
      assignedRiders,
      effectiveHoveredRider,
      selectedRiderId
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
        mapWidth,
      }
    );

    // Draw vehicles at current positions
    const vehiclePositions = getVehiclePositions(
      problem.vehicles,
      simulationResult.vehicleResults,
      problem.city,
      currentTime,
      pathCache
    );
    drawVehicles(ctx, vehiclePositions, vehicleIndex);
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
    effectiveHoveredRider,
    mapWidth,
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
