import type { NodeId, RiderId, VehicleId } from './problem';

export interface SimulationResult {
  vehicleResults: Map<VehicleId, VehicleSimResult>;
  unassignedRiders: RiderId[];

  // Score breakdown
  totalLateness: number; // sum of all minutesLate + minutesOverMaxTime
  unassignedPenalty: number; // unassignedRiders.length * 1_000_000
  totalScore: number; // totalLateness + unassignedPenalty (lower is better)
}

export interface VehicleSimResult {
  stops: SimulatedStop[]; // 1:1 with itinerary
  vehicleEnd: VehicleEndResult;
}

export interface SimulatedStop {
  // Echo from itinerary
  riderId: RiderId;
  type: 'pickup' | 'dropoff';
  nodeId: NodeId;

  // Computed times (minutes from midnight)
  arrivalTime: number;
  serviceStartTime: number; // arrivalTime + any wait
  serviceEndTime: number; // after boarding/deboarding
  departureTime: number;

  // Penalty/indicator fields
  minutesEarly?: number; // driver wait time (no penalty, visual only)
  minutesLate?: number; // late for window
  minutesOverMaxTime?: number; // exceeded max time in vehicle (dropoffs only)
}

export interface VehicleEndResult {
  nodeId: NodeId;
  arrivalTime: number;
  minutesLate?: number; // if arrived after vehicle endTime
}

// Constants
export const UNASSIGNED_RIDER_PENALTY = 1_000_000;
