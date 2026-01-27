import type { Problem, Rider, RiderId, Vehicle, VehicleId } from '../types/problem';
import type { Solution, Itinerary } from '../types/solution';
import type {
  SimulationResult,
  VehicleSimResult,
  SimulatedStop,
  VehicleEndResult,
} from '../types/simulation';
import { UNASSIGNED_RIDER_PENALTY } from '../types/simulation';
import { PathCache } from '../pathfinding/pathCache';

export function simulate(
  problem: Problem,
  solution: Solution,
  pathCache: PathCache
): SimulationResult {
  const vehicleResults = new Map<VehicleId, VehicleSimResult>();
  const assignedRiders = new Set<RiderId>();

  // Build rider lookup map
  const riderMap = new Map<RiderId, Rider>();
  for (const rider of problem.riders) {
    riderMap.set(rider.id, rider);
  }

  // Build vehicle lookup map
  const vehicleMap = new Map<VehicleId, Vehicle>();
  for (const vehicle of problem.vehicles) {
    vehicleMap.set(vehicle.id, vehicle);
  }

  let totalLateness = 0;

  // Simulate each vehicle
  for (const vehicle of problem.vehicles) {
    const itinerary = solution.get(vehicle.id) || [];
    const result = simulateVehicle(vehicle, itinerary, riderMap, pathCache);
    vehicleResults.set(vehicle.id, result);

    // Track assigned riders and sum lateness
    for (const stop of result.stops) {
      if (stop.type === 'pickup') {
        assignedRiders.add(stop.riderId);
      }
      if (stop.minutesLate) totalLateness += stop.minutesLate;
      if (stop.minutesOverMaxTime) totalLateness += stop.minutesOverMaxTime;
    }
    if (result.vehicleEnd.minutesLate) {
      totalLateness += result.vehicleEnd.minutesLate;
    }
  }

  // Find unassigned riders
  const unassignedRiders: RiderId[] = [];
  for (const rider of problem.riders) {
    if (!assignedRiders.has(rider.id)) {
      unassignedRiders.push(rider.id);
    }
  }

  const unassignedPenalty = unassignedRiders.length * UNASSIGNED_RIDER_PENALTY;

  return {
    vehicleResults,
    unassignedRiders,
    totalLateness,
    unassignedPenalty,
    totalScore: totalLateness + unassignedPenalty,
  };
}

function simulateVehicle(
  vehicle: Vehicle,
  itinerary: Itinerary,
  riderMap: Map<RiderId, Rider>,
  pathCache: PathCache
): VehicleSimResult {
  const stops: SimulatedStop[] = [];
  const pickupTimes = new Map<RiderId, number>(); // track when each rider was picked up

  let currentNodeId = vehicle.startNodeId;
  let currentTime = vehicle.startTime;

  for (const stop of itinerary) {
    const rider = riderMap.get(stop.riderId);
    if (!rider) continue;

    const targetNodeId = stop.type === 'pickup' ? rider.pickupNodeId : rider.dropoffNodeId;
    const window = stop.type === 'pickup' ? rider.pickupWindow : rider.dropoffWindow;

    // Travel to stop
    const travelTime = pathCache.getTravelTime(currentNodeId, targetNodeId);
    const arrivalTime = currentTime + travelTime;

    // Calculate wait time and service start
    let serviceStartTime = arrivalTime;
    let minutesEarly: number | undefined;

    if (window && arrivalTime < window.earliest) {
      minutesEarly = window.earliest - arrivalTime;
      serviceStartTime = window.earliest;
    }

    // Service time (boarding/deboarding)
    const serviceEndTime = serviceStartTime + rider.accessibility.boardingTime;
    const departureTime = serviceEndTime;

    // Calculate penalties
    let minutesLate: number | undefined;
    if (window && serviceStartTime > window.latest) {
      minutesLate = serviceStartTime - window.latest;
    }

    // Track max time violation for dropoffs
    let minutesOverMaxTime: number | undefined;
    if (stop.type === 'pickup') {
      pickupTimes.set(stop.riderId, departureTime);
    } else if (stop.type === 'dropoff' && rider.maxTimeInVehicle !== undefined) {
      const pickupTime = pickupTimes.get(stop.riderId);
      if (pickupTime !== undefined) {
        const timeInVehicle = arrivalTime - pickupTime;
        if (timeInVehicle > rider.maxTimeInVehicle) {
          minutesOverMaxTime = timeInVehicle - rider.maxTimeInVehicle;
        }
      }
    }

    stops.push({
      riderId: stop.riderId,
      type: stop.type,
      nodeId: targetNodeId,
      arrivalTime,
      serviceStartTime,
      serviceEndTime,
      departureTime,
      minutesEarly,
      minutesLate,
      minutesOverMaxTime,
    });

    currentNodeId = targetNodeId;
    currentTime = departureTime;
  }

  // Travel to end depot
  const travelToEnd = pathCache.getTravelTime(currentNodeId, vehicle.endNodeId);
  const endArrivalTime = currentTime + travelToEnd;

  const vehicleEnd: VehicleEndResult = {
    nodeId: vehicle.endNodeId,
    arrivalTime: endArrivalTime,
    minutesLate:
      endArrivalTime > vehicle.endTime
        ? endArrivalTime - vehicle.endTime
        : undefined,
  };

  return { stops, vehicleEnd };
}
