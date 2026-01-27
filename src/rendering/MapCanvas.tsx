import { useRef, useEffect, useCallback, useState } from 'react';
import type { Problem, NodeId, RiderId, VehicleId } from '../types/problem';
import type { Solution } from '../types/solution';
import type { SimulationResult } from '../types/simulation';
import { drawCity, findNodeAtPosition } from './drawCity';
import { drawRoutes, drawUnassignedRiders } from './drawRoutes';
import { drawVehicles, getVehiclePositions } from './drawVehicles';
import { PathCache } from '../pathfinding/pathCache';

interface MapCanvasProps {
  problem: Problem;
  solution: Solution;
  simulationResult: SimulationResult;
  currentTime: number;
  pathCache: PathCache;
  width?: number;
  height?: number;
  onNodeClick?: (nodeId: NodeId) => void;
}

export function MapCanvas({
  problem,
  solution,
  simulationResult,
  currentTime,
  pathCache,
  width = 800,
  height = 800,
  onNodeClick,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverNode, setHoverNode] = useState<NodeId | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<NodeId[]>([]);
  const [highlightedPath, setHighlightedPath] = useState<NodeId[]>([]);

  // Build lookup maps
  const vehicleIndex = new Map<VehicleId, number>();
  problem.vehicles.forEach((v, i) => vehicleIndex.set(v.id, i));

  const riderMap = new Map<RiderId, typeof problem.riders[0]>();
  problem.riders.forEach((r) => riderMap.set(r.id, r));

  // Get unassigned riders
  const unassignedRidersList = problem.riders.filter((r) =>
    simulationResult.unassignedRiders.includes(r.id)
  );

  // Handle path highlighting when two nodes are selected
  useEffect(() => {
    if (selectedNodes.length === 2) {
      const result = pathCache.getPath(selectedNodes[0], selectedNodes[1]);
      if (result) {
        setHighlightedPath(result.path);
      }
    } else {
      setHighlightedPath([]);
    }
  }, [selectedNodes, pathCache]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const nodeId = findNodeAtPosition(problem.city, x, y);
      if (nodeId) {
        onNodeClick?.(nodeId);

        // Toggle selection for path debugging
        setSelectedNodes((prev) => {
          if (prev.includes(nodeId)) {
            return prev.filter((id) => id !== nodeId);
          }
          if (prev.length >= 2) {
            return [nodeId];
          }
          return [...prev, nodeId];
        });
      }
    },
    [problem.city, onNodeClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const nodeId = findNodeAtPosition(problem.city, x, y);
      setHoverNode(nodeId);
    },
    [problem.city]
  );

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, width, height);

    // Draw city (roads and nodes)
    drawCity(ctx, problem.city, {
      highlightedPath,
      selectedNode: selectedNodes[0],
      hoverNode: hoverNode ?? undefined,
    });

    // Draw planned routes
    drawRoutes(
      ctx,
      problem.vehicles,
      solution,
      riderMap,
      problem.city,
      vehicleIndex
    );

    // Draw unassigned rider locations
    drawUnassignedRiders(ctx, unassignedRidersList, problem.city);

    // Draw vehicles at current positions
    const vehiclePositions = getVehiclePositions(
      problem.vehicles,
      simulationResult.vehicleResults,
      problem.city,
      currentTime
    );
    drawVehicles(ctx, vehiclePositions, vehicleIndex);
  }, [
    problem,
    solution,
    simulationResult,
    currentTime,
    highlightedPath,
    selectedNodes,
    hoverNode,
    width,
    height,
    vehicleIndex,
    riderMap,
    unassignedRidersList,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
    />
  );
}
