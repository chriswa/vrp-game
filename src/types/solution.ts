import type { RiderId, VehicleId } from './problem';

// The player's solution - maps each vehicle to an ordered itinerary
export type Solution = Map<VehicleId, Itinerary>;

// Ordered list of stops for a vehicle
export type Itinerary = ItineraryStop[];

export interface ItineraryStop {
  riderId: RiderId;
  type: 'pickup' | 'dropoff';
}

// Helper to create an empty solution
export function createEmptySolution(): Solution {
  return new Map();
}

// Helper to clone a solution (for immutable updates)
export function cloneSolution(solution: Solution): Solution {
  const newSolution: Solution = new Map();
  for (const [vehicleId, itinerary] of solution) {
    newSolution.set(vehicleId, [...itinerary]);
  }
  return newSolution;
}
