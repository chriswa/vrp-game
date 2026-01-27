import type {
  City,
  CityEdge,
  CityNode,
  EdgeId,
  NodeId,
  Problem,
  Rider,
  RiderId,
  Vehicle,
  VehicleId,
} from '../types/problem';
import { RoadType } from '../types/problem';
import { SeededRandom } from '../utils/random';
import { roundTime } from '../utils/time';
import { distance } from '../utils/geometry';

const DRIVER_NAMES = [
  'Alice',
  'Bob',
  'Carol',
  'Dave',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Ivy',
  'Jack',
];

const RIDER_NAMES = [
  'Alex',
  'Blake',
  'Casey',
  'Dana',
  'Ellis',
  'Finley',
  'Gray',
  'Harper',
  'Indigo',
  'Jordan',
  'Kelly',
  'Logan',
  'Morgan',
  'Noel',
  'Oakley',
  'Parker',
  'Quinn',
  'Riley',
  'Sage',
  'Taylor',
];

export type Difficulty = 'easy' | 'medium' | 'hard';

interface GeneratorOptions {
  seed?: number;
  gridSize?: number; // number of nodes per side
  vehicleCount?: number;
  riderCount?: number;
  serviceStart?: number; // minutes from midnight
  serviceEnd?: number;
  nodeJitter?: number; // max pixels to jitter nodes (0 = perfect grid)
  difficulty?: Difficulty;
}

export function generateProblem(options: GeneratorOptions = {}): Problem {
  const {
    seed = Date.now(),
    gridSize = 8,
    vehicleCount = 3,
    riderCount = 10,
    serviceStart = 8 * 60, // 8:00 AM
    serviceEnd = 18 * 60, // 6:00 PM
    nodeJitter = 20, // default jitter
    difficulty = 'easy',
  } = options;

  const rng = new SeededRandom(seed);

  const city = generateGridCity(gridSize, nodeJitter, rng);
  const nodeIds = Array.from(city.nodes.keys());

  const vehicles = generateVehicles(
    vehicleCount,
    nodeIds,
    serviceStart,
    serviceEnd,
    rng
  );

  const riders = generateRiders(
    riderCount,
    nodeIds,
    serviceStart,
    serviceEnd,
    rng,
    difficulty
  );

  return {
    city,
    vehicles,
    riders,
    serviceWindow: { earliest: serviceStart, latest: serviceEnd },
  };
}

function generateGridCity(size: number, jitter: number, rng: SeededRandom): City {
  const nodes = new Map<NodeId, CityNode>();
  const edges = new Map<EdgeId, CityEdge>();
  const adjacency = new Map<NodeId, EdgeId[]>();

  const spacing = 60; // pixels between nodes (smaller for compact map)
  const margin = 30; // margin from edge

  // Create nodes in a grid with jitter
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const id = `node_${x}_${y}` as NodeId;
      const baseX = x * spacing + margin;
      const baseY = y * spacing + margin;

      // Add random jitter
      const jitterX = jitter > 0 ? rng.nextFloat(-jitter, jitter) : 0;
      const jitterY = jitter > 0 ? rng.nextFloat(-jitter, jitter) : 0;

      nodes.set(id, {
        id,
        x: baseX + jitterX,
        y: baseY + jitterY,
        name: `(${x},${y})`,
      });
      adjacency.set(id, []);
    }
  }

  // Create edges (horizontal and vertical connections)
  let edgeCount = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fromId = `node_${x}_${y}` as NodeId;
      const fromNode = nodes.get(fromId)!;

      // Horizontal edge (to the right)
      if (x < size - 1) {
        const toId = `node_${x + 1}_${y}` as NodeId;
        const toNode = nodes.get(toId)!;
        const edgeId = `edge_${edgeCount++}` as EdgeId;
        const dist = distance(fromNode.x, fromNode.y, toNode.x, toNode.y);
        // Travel time based on distance, roughly 2-3 min per edge
        const cost = roundTime((dist / spacing) * (2 + rng.nextFloat(0, 1)), 1);

        edges.set(edgeId, {
          id: edgeId,
          from: fromId,
          to: toId,
          cost,
          distance: dist,
          roadType: RoadType.Local,
        });

        adjacency.get(fromId)!.push(edgeId);
        adjacency.get(toId)!.push(edgeId);
      }

      // Vertical edge (downward)
      if (y < size - 1) {
        const toId = `node_${x}_${y + 1}` as NodeId;
        const toNode = nodes.get(toId)!;
        const edgeId = `edge_${edgeCount++}` as EdgeId;
        const dist = distance(fromNode.x, fromNode.y, toNode.x, toNode.y);
        const cost = roundTime((dist / spacing) * (2 + rng.nextFloat(0, 1)), 1);

        edges.set(edgeId, {
          id: edgeId,
          from: fromId,
          to: toId,
          cost,
          distance: dist,
          roadType: RoadType.Local,
        });

        adjacency.get(fromId)!.push(edgeId);
        adjacency.get(toId)!.push(edgeId);
      }
    }
  }

  return { nodes, edges, adjacency };
}

function generateVehicles(
  count: number,
  nodeIds: NodeId[],
  serviceStart: number,
  serviceEnd: number,
  rng: SeededRandom
): Vehicle[] {
  const vehicles: Vehicle[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Pick a unique driver name
    let driverName: string;
    do {
      driverName = rng.pick(DRIVER_NAMES);
    } while (usedNames.has(driverName) && usedNames.size < DRIVER_NAMES.length);
    usedNames.add(driverName);

    const hasWheelchair = rng.next() > 0.7;
    const startNode = rng.pick(nodeIds);
    const endNode = rng.pick(nodeIds);

    vehicles.push({
      id: `vehicle_${i}` as VehicleId,
      driverName,
      seatCount: rng.nextInt(3, 6),
      wheelchairCapacity: hasWheelchair ? 1 : 0,
      startTime: roundTime(serviceStart, 5),
      endTime: roundTime(serviceEnd, 5),
      startNodeId: startNode,
      endNodeId: endNode,
    });
  }

  return vehicles;
}

function generateRiders(
  count: number,
  nodeIds: NodeId[],
  serviceStart: number,
  serviceEnd: number,
  rng: SeededRandom,
  difficulty: Difficulty
): Rider[] {
  const riders: Rider[] = [];
  const shuffledNames = rng.shuffle([...RIDER_NAMES]);

  // Difficulty settings
  const windowChance = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 0.3 : 0.6;
  const maxTimeChance = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 0.2 : 0.5;
  const wheelchairChance = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 0.1 : 0.15;

  for (let i = 0; i < count; i++) {
    const name = shuffledNames[i % shuffledNames.length];
    const needsWheelchair = rng.next() < wheelchairChance;

    // Pick different pickup and dropoff nodes
    const pickupNode = rng.pick(nodeIds);
    let dropoffNode: NodeId;
    do {
      dropoffNode = rng.pick(nodeIds);
    } while (dropoffNode === pickupNode);

    // Generate time windows based on difficulty
    const hasPickupWindow = rng.next() < windowChance;
    const hasDropoffWindow = rng.next() < windowChance;
    const hasMaxTime = rng.next() < maxTimeChance;

    const windowDuration = roundTime(30 + rng.nextInt(0, 6) * 5, 5); // 30-60 minutes in 5-min increments
    const serviceRange = serviceEnd - serviceStart;

    let pickupWindow;
    if (hasPickupWindow) {
      const earliest = roundTime(serviceStart + rng.nextInt(0, Math.floor(serviceRange * 0.6 / 5)) * 5, 5);
      pickupWindow = {
        earliest,
        latest: earliest + windowDuration,
      };
    }

    let dropoffWindow;
    if (hasDropoffWindow) {
      const earliest = roundTime(
        serviceStart + rng.nextInt(Math.floor(serviceRange * 0.3 / 5), Math.floor(serviceRange * 0.8 / 5)) * 5,
        5
      );
      dropoffWindow = {
        earliest,
        latest: earliest + windowDuration,
      };
    }

    riders.push({
      id: `rider_${i}` as RiderId,
      name: `${name}${count > RIDER_NAMES.length ? ` ${i + 1}` : ''}`,
      pickupNodeId: pickupNode,
      dropoffNodeId: dropoffNode,
      pickupWindow,
      dropoffWindow,
      maxTimeInVehicle: hasMaxTime ? roundTime(30 + rng.nextInt(0, 6) * 5, 5) : undefined,
      timePreference: rng.next() > 0.5 ? 'asap' : 'arrive-by',
      accessibility: {
        needsWheelchair,
        seatEquivalent: needsWheelchair ? 1.5 : 1.0,
        boardingTime: needsWheelchair ? 3 : 1, // minutes
      },
    });
  }

  return riders;
}
