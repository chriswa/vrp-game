import type { Problem, VehicleId } from '../types/problem';
import type { Solution, Itinerary } from '../types/solution';
import type { SimulationResult, VehicleSimResult } from '../types/simulation';
import { UNASSIGNED_RIDER_PENALTY } from '../types/simulation';
import { PathCache } from '../pathfinding/pathCache';
import { simulate } from './simulate';

// Hash an itinerary for cache key
function hashItinerary(itinerary: Itinerary): string {
  return itinerary.map((s) => `${s.riderId}:${s.type}`).join('|');
}

// Simulation cache for incremental updates
export class SimulationCache {
  private results = new Map<VehicleId, { hash: string; result: VehicleSimResult }>();
  private pathCache: PathCache;
  private problem: Problem;

  constructor(problem: Problem) {
    this.problem = problem;
    this.pathCache = new PathCache(problem.city);
  }

  // Full simulation with caching
  simulate(solution: Solution): SimulationResult {
    // First pass: check which vehicles need recalculation
    const dirtyVehicles = new Set<VehicleId>();

    for (const vehicle of this.problem.vehicles) {
      const itinerary = solution.get(vehicle.id) || [];
      const hash = hashItinerary(itinerary);
      const cached = this.results.get(vehicle.id);

      if (!cached || cached.hash !== hash) {
        dirtyVehicles.add(vehicle.id);
      }
    }

    // If anything is dirty, run full simulation and update cache
    // (The simulate function already calculates everything correctly)
    if (dirtyVehicles.size > 0) {
      const fullResult = simulate(this.problem, solution, this.pathCache);

      // Update cache for all vehicles
      for (const vehicle of this.problem.vehicles) {
        const itinerary = solution.get(vehicle.id) || [];
        const hash = hashItinerary(itinerary);
        const result = fullResult.vehicleResults.get(vehicle.id);
        if (result) {
          this.results.set(vehicle.id, { hash, result });
        }
      }

      return fullResult;
    }

    // All cached - reconstruct result from cache
    return this.reconstructFromCache();
  }

  private reconstructFromCache(): SimulationResult {
    const vehicleResults = new Map<VehicleId, VehicleSimResult>();
    const assignedRiders = new Set<string>();
    let totalLateness = 0;

    for (const vehicle of this.problem.vehicles) {
      const cached = this.results.get(vehicle.id);
      if (cached) {
        vehicleResults.set(vehicle.id, cached.result);

        for (const stop of cached.result.stops) {
          if (stop.type === 'pickup') {
            assignedRiders.add(stop.riderId);
          }
          if (stop.minutesLate) totalLateness += stop.minutesLate;
          if (stop.minutesOverMaxTime) totalLateness += stop.minutesOverMaxTime;
        }
        if (cached.result.vehicleEnd.minutesLate) {
          totalLateness += cached.result.vehicleEnd.minutesLate;
        }
      }
    }

    const unassignedRiders = this.problem.riders
      .filter((r) => !assignedRiders.has(r.id))
      .map((r) => r.id);

    const unassignedPenalty = unassignedRiders.length * UNASSIGNED_RIDER_PENALTY;

    return {
      vehicleResults,
      unassignedRiders,
      totalLateness,
      unassignedPenalty,
      totalScore: totalLateness + unassignedPenalty,
    };
  }

  // Get the path cache for external use
  getPathCache(): PathCache {
    return this.pathCache;
  }

  // Clear the cache
  clear(): void {
    this.results.clear();
  }
}
