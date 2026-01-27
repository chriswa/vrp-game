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

interface GeneratorOptions {
  seed?: number;
  gridSize?: number; // number of nodes per side
  vehicleCount?: number;
  riderCount?: number;
  serviceStart?: number; // minutes from midnight
  serviceEnd?: number;
}

export function generateProblem(options: GeneratorOptions = {}): Problem {
  const {
    seed = Date.now(),
    gridSize = 8,
    vehicleCount = 3,
    riderCount = 10,
    serviceStart = 8 * 60, // 8:00 AM
    serviceEnd = 18 * 60, // 6:00 PM
  } = options;

  const rng = new SeededRandom(seed);

  const city = generateGridCity(gridSize, rng);
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
    rng
  );

  return {
    city,
    vehicles,
    riders,
    serviceWindow: { earliest: serviceStart, latest: serviceEnd },
  };
}

function generateGridCity(size: number, rng: SeededRandom): City {
  const nodes = new Map<NodeId, CityNode>();
  const edges = new Map<EdgeId, CityEdge>();
  const adjacency = new Map<NodeId, EdgeId[]>();

  const spacing = 100; // pixels between nodes

  // Create nodes in a grid
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const id = `node_${x}_${y}` as NodeId;
      nodes.set(id, {
        id,
        x: x * spacing + spacing / 2,
        y: y * spacing + spacing / 2,
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

      // Horizontal edge (to the right)
      if (x < size - 1) {
        const toId = `node_${x + 1}_${y}` as NodeId;
        const edgeId = `edge_${edgeCount++}` as EdgeId;
        const cost = 2 + rng.nextFloat(0, 1); // 2-3 minutes travel time

        edges.set(edgeId, {
          id: edgeId,
          from: fromId,
          to: toId,
          cost,
          distance: spacing,
          roadType: RoadType.Local,
        });

        adjacency.get(fromId)!.push(edgeId);
        adjacency.get(toId)!.push(edgeId);
      }

      // Vertical edge (downward)
      if (y < size - 1) {
        const toId = `node_${x}_${y + 1}` as NodeId;
        const edgeId = `edge_${edgeCount++}` as EdgeId;
        const cost = 2 + rng.nextFloat(0, 1);

        edges.set(edgeId, {
          id: edgeId,
          from: fromId,
          to: toId,
          cost,
          distance: spacing,
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
      startTime: serviceStart,
      endTime: serviceEnd,
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
  rng: SeededRandom
): Rider[] {
  const riders: Rider[] = [];
  const shuffledNames = rng.shuffle([...RIDER_NAMES]);

  for (let i = 0; i < count; i++) {
    const name = shuffledNames[i % shuffledNames.length];
    const needsWheelchair = rng.next() > 0.85;

    // Pick different pickup and dropoff nodes
    const pickupNode = rng.pick(nodeIds);
    let dropoffNode: NodeId;
    do {
      dropoffNode = rng.pick(nodeIds);
    } while (dropoffNode === pickupNode);

    // Generate time windows for some riders
    const hasPickupWindow = rng.next() > 0.5;
    const hasDropoffWindow = rng.next() > 0.5;
    const hasMaxTime = rng.next() > 0.6;

    const windowDuration = 30 + rng.nextInt(0, 30); // 30-60 minute windows
    const serviceRange = serviceEnd - serviceStart;

    let pickupWindow;
    if (hasPickupWindow) {
      const earliest = serviceStart + rng.nextInt(0, Math.floor(serviceRange * 0.6));
      pickupWindow = {
        earliest,
        latest: earliest + windowDuration,
      };
    }

    let dropoffWindow;
    if (hasDropoffWindow) {
      const earliest = serviceStart + rng.nextInt(Math.floor(serviceRange * 0.3), Math.floor(serviceRange * 0.8));
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
      maxTimeInVehicle: hasMaxTime ? 30 + rng.nextInt(0, 30) : undefined,
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
