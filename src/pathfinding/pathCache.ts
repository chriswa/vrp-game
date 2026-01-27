import type { City, NodeId } from '../types/problem';
import { findPath, type PathResult } from './astar';

// Memoized path cache - paths are immutable for a given city
export class PathCache {
  private cache = new Map<string, PathResult | null>();
  private city: City;

  constructor(city: City) {
    this.city = city;
  }

  private getKey(from: NodeId, to: NodeId): string {
    return `${from}:${to}`;
  }

  getPath(from: NodeId, to: NodeId): PathResult | null {
    const key = this.getKey(from, to);
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }
    const result = findPath(this.city, from, to);
    this.cache.set(key, result);
    return result;
  }

  // Get just the travel time (most common use case)
  getTravelTime(from: NodeId, to: NodeId): number {
    const result = this.getPath(from, to);
    return result?.cost ?? Infinity;
  }

  // Clear the cache (if city changes)
  clear(): void {
    this.cache.clear();
  }
}
