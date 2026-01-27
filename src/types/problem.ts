// Branded types for type safety
export type NodeId = string & { readonly __brand: 'NodeId' };
export type EdgeId = string & { readonly __brand: 'EdgeId' };
export type VehicleId = string & { readonly __brand: 'VehicleId' };
export type RiderId = string & { readonly __brand: 'RiderId' };

// The complete puzzle definition - immutable during gameplay
export interface Problem {
  city: City;
  vehicles: Vehicle[];
  riders: Rider[];
  serviceWindow: TimeWindow; // overall service window (minutes from midnight)
}

// City graph
export interface City {
  nodes: Map<NodeId, CityNode>;
  edges: Map<EdgeId, CityEdge>;
  adjacency: Map<NodeId, EdgeId[]>; // for fast pathfinding
}

export interface CityNode {
  id: NodeId;
  x: number;
  y: number;
  name?: string;
}

export interface CityEdge {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  cost: number; // travel time in minutes
  distance: number; // for display
  roadType: RoadType;
}

export const RoadType = {
  Highway: 'highway',
  Arterial: 'arterial',
  Local: 'local',
} as const;

export type RoadType = (typeof RoadType)[keyof typeof RoadType];

// Vehicles
export interface Vehicle {
  id: VehicleId;
  driverName: string;
  seatCount: number;
  wheelchairCapacity: number; // each uses 1.5 seat equivalents
  startTime: number; // minutes from midnight
  endTime: number;
  startNodeId: NodeId;
  endNodeId: NodeId;
}

// Riders
export interface Rider {
  id: RiderId;
  name: string;
  pickupNodeId: NodeId;
  dropoffNodeId: NodeId;
  pickupWindow?: TimeWindow;
  dropoffWindow?: TimeWindow;
  maxTimeInVehicle?: number; // optional, minutes
  timePreference: 'asap' | 'arrive-by';
  accessibility: {
    needsWheelchair: boolean;
    seatEquivalent: number; // 1.0 normal, 1.5 wheelchair
    boardingTime: number; // extra minutes for boarding/deboarding
  };
}

export interface TimeWindow {
  earliest: number; // minutes from midnight
  latest: number;
}
