import type { City, NodeId } from '../types/problem';
import { PriorityQueue } from './priorityQueue';
import { distance } from '../utils/geometry';

export interface PathResult {
  path: NodeId[]; // sequence of nodes from start to end
  cost: number; // total travel time
}

// A* pathfinding algorithm
export function findPath(city: City, startId: NodeId, endId: NodeId): PathResult | null {
  if (startId === endId) {
    return { path: [startId], cost: 0 };
  }

  const startNode = city.nodes.get(startId);
  const endNode = city.nodes.get(endId);
  if (!startNode || !endNode) return null;

  // Heuristic: straight-line distance scaled to approximate travel time
  // Assuming average speed, we estimate time based on distance
  const heuristic = (nodeId: NodeId): number => {
    const node = city.nodes.get(nodeId)!;
    // Scale distance to approximate travel time (tuned for grid cities)
    return distance(node.x, node.y, endNode.x, endNode.y) * 0.5;
  };

  const openSet = new PriorityQueue<NodeId>();
  const cameFrom = new Map<NodeId, NodeId>();
  const gScore = new Map<NodeId, number>();
  const fScore = new Map<NodeId, number>();

  gScore.set(startId, 0);
  fScore.set(startId, heuristic(startId));
  openSet.push(startId, fScore.get(startId)!);

  const visited = new Set<NodeId>();

  while (!openSet.isEmpty()) {
    const current = openSet.pop()!;

    if (current === endId) {
      // Reconstruct path
      const path: NodeId[] = [current];
      let node = current;
      while (cameFrom.has(node)) {
        node = cameFrom.get(node)!;
        path.unshift(node);
      }
      return { path, cost: gScore.get(current)! };
    }

    if (visited.has(current)) continue;
    visited.add(current);

    const edgeIds = city.adjacency.get(current) || [];
    for (const edgeId of edgeIds) {
      const edge = city.edges.get(edgeId)!;
      const neighbor = edge.from === current ? edge.to : edge.from;

      if (visited.has(neighbor)) continue;

      const tentativeG = gScore.get(current)! + edge.cost;
      const currentG = gScore.get(neighbor);

      if (currentG === undefined || tentativeG < currentG) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        const f = tentativeG + heuristic(neighbor);
        fScore.set(neighbor, f);
        openSet.push(neighbor, f);
      }
    }
  }

  return null; // No path found
}
