import type { Problem, Rider, RiderId, VehicleId } from '../types/problem';
import type { Solution, Itinerary, ItineraryStop } from '../types/solution';
import { PathCache } from '../pathfinding/pathCache';

// Simple greedy solver for testing - not optimal but reasonable
export function generateTestSolution(problem: Problem, pathCache: PathCache): Solution {
  const solution: Solution = new Map();

  // Initialize empty itineraries for all vehicles
  for (const vehicle of problem.vehicles) {
    solution.set(vehicle.id, []);
  }

  // Sort riders by earliest constraint time (pickup or dropoff window)
  const sortedRiders = [...problem.riders].sort((a, b) => {
    const aTime = getEarliestConstraintTime(a);
    const bTime = getEarliestConstraintTime(b);
    return aTime - bTime;
  });

  // Greedily assign each rider to the best vehicle
  for (const rider of sortedRiders) {
    let bestVehicle: VehicleId | null = null;
    let bestCost = Infinity;
    let bestInsertPosition: { pickupIdx: number; dropoffIdx: number } | null = null;

    for (const vehicle of problem.vehicles) {
      const itinerary = solution.get(vehicle.id)!;

      // Check wheelchair compatibility
      if (rider.accessibility.needsWheelchair && vehicle.wheelchairCapacity === 0) {
        continue;
      }

      // Try all valid insertion positions
      const result = findBestInsertionPosition(
        problem,
        vehicle.id,
        itinerary,
        rider,
        pathCache
      );

      if (result && result.cost < bestCost) {
        bestCost = result.cost;
        bestVehicle = vehicle.id;
        bestInsertPosition = result.position;
      }
    }

    // Insert rider into best vehicle
    if (bestVehicle && bestInsertPosition) {
      const itinerary = solution.get(bestVehicle)!;
      const newItinerary = insertRider(
        itinerary,
        rider.id,
        bestInsertPosition.pickupIdx,
        bestInsertPosition.dropoffIdx
      );
      solution.set(bestVehicle, newItinerary);
    }
  }

  return solution;
}

function getEarliestConstraintTime(rider: Rider): number {
  if (rider.pickupWindow) return rider.pickupWindow.earliest;
  if (rider.dropoffWindow) return rider.dropoffWindow.earliest;
  return 0; // No constraints, can be scheduled anytime
}

interface InsertionResult {
  cost: number;
  position: { pickupIdx: number; dropoffIdx: number };
}

function findBestInsertionPosition(
  problem: Problem,
  vehicleId: VehicleId,
  itinerary: Itinerary,
  rider: Rider,
  pathCache: PathCache
): InsertionResult | null {
  const vehicle = problem.vehicles.find((v) => v.id === vehicleId)!;
  const riderMap = new Map(problem.riders.map((r) => [r.id, r]));

  let bestResult: InsertionResult | null = null;

  // Try all valid insertion positions (pickup before dropoff)
  for (let pickupIdx = 0; pickupIdx <= itinerary.length; pickupIdx++) {
    for (let dropoffIdx = pickupIdx + 1; dropoffIdx <= itinerary.length + 1; dropoffIdx++) {
      const testItinerary = insertRider(itinerary, rider.id, pickupIdx, dropoffIdx);
      const cost = evaluateItinerary(problem, vehicle, testItinerary, riderMap, pathCache);

      if (cost !== null && (bestResult === null || cost < bestResult.cost)) {
        bestResult = {
          cost,
          position: { pickupIdx, dropoffIdx },
        };
      }
    }
  }

  return bestResult;
}

function insertRider(
  itinerary: Itinerary,
  riderId: RiderId,
  pickupIdx: number,
  dropoffIdx: number
): Itinerary {
  const newItinerary = [...itinerary];
  const pickupStop: ItineraryStop = { riderId, type: 'pickup' };
  const dropoffStop: ItineraryStop = { riderId, type: 'dropoff' };

  newItinerary.splice(pickupIdx, 0, pickupStop);
  newItinerary.splice(dropoffIdx, 0, dropoffStop);

  return newItinerary;
}

function evaluateItinerary(
  problem: Problem,
  vehicle: typeof problem.vehicles[0],
  itinerary: Itinerary,
  riderMap: Map<RiderId, Rider>,
  pathCache: PathCache
): number | null {
  let currentTime = vehicle.startTime;
  let currentNode = vehicle.startNodeId;
  let totalPenalty = 0;
  const pickupTimes = new Map<RiderId, number>();
  let currentPassengers = 0;
  let wheelchairPassengers = 0;

  for (const stop of itinerary) {
    const rider = riderMap.get(stop.riderId);
    if (!rider) return null;

    const targetNode = stop.type === 'pickup' ? rider.pickupNodeId : rider.dropoffNodeId;
    const travelTime = pathCache.getTravelTime(currentNode, targetNode);
    const arrivalTime = currentTime + travelTime;

    const window = stop.type === 'pickup' ? rider.pickupWindow : rider.dropoffWindow;

    // Wait if early
    let serviceStart = arrivalTime;
    if (window && arrivalTime < window.earliest) {
      serviceStart = window.earliest;
    }

    // Penalty if late
    if (window && serviceStart > window.latest) {
      totalPenalty += (serviceStart - window.latest) * 10; // Weight lateness
    }

    // Handle passenger count
    if (stop.type === 'pickup') {
      currentPassengers++;
      if (rider.accessibility.needsWheelchair) {
        wheelchairPassengers++;
      }
      pickupTimes.set(stop.riderId, serviceStart + rider.accessibility.boardingTime);

      // Check capacity
      const seatUsed = currentPassengers - wheelchairPassengers + wheelchairPassengers * 1.5;
      if (seatUsed > vehicle.seatCount) {
        return null; // Infeasible
      }
      if (wheelchairPassengers > vehicle.wheelchairCapacity) {
        return null; // Infeasible
      }
    } else {
      currentPassengers--;
      if (rider.accessibility.needsWheelchair) {
        wheelchairPassengers--;
      }

      // Check max time in vehicle
      if (rider.maxTimeInVehicle !== undefined) {
        const pickupTime = pickupTimes.get(stop.riderId);
        if (pickupTime !== undefined) {
          const timeInVehicle = arrivalTime - pickupTime;
          if (timeInVehicle > rider.maxTimeInVehicle) {
            totalPenalty += (timeInVehicle - rider.maxTimeInVehicle) * 10;
          }
        }
      }
    }

    currentTime = serviceStart + rider.accessibility.boardingTime;
    currentNode = targetNode;
  }

  // Travel to end depot
  const travelToEnd = pathCache.getTravelTime(currentNode, vehicle.endNodeId);
  const endArrivalTime = currentTime + travelToEnd;

  if (endArrivalTime > vehicle.endTime) {
    totalPenalty += (endArrivalTime - vehicle.endTime) * 5;
  }

  // Add total travel time as a small cost factor (prefer shorter routes)
  totalPenalty += (endArrivalTime - vehicle.startTime) * 0.1;

  return totalPenalty;
}
