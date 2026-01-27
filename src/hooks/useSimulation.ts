import { useMemo, useRef } from 'react';
import type { Problem } from '../types/problem';
import type { Solution } from '../types/solution';
import type { SimulationResult } from '../types/simulation';
import { SimulationCache } from '../simulation/cache';
import { PathCache } from '../pathfinding/pathCache';

export function useSimulation(problem: Problem, solution: Solution) {
  // Keep a stable reference to the simulation cache
  const cacheRef = useRef<SimulationCache | null>(null);
  const problemRef = useRef<Problem | null>(null);

  // Recreate cache if problem changes
  if (problemRef.current !== problem) {
    cacheRef.current = new SimulationCache(problem);
    problemRef.current = problem;
  }

  const cache = cacheRef.current!;

  // Run simulation (with memoization inside the cache)
  const result: SimulationResult = useMemo(() => {
    return cache.simulate(solution);
  }, [cache, solution]);

  // Expose path cache for the map
  const pathCache: PathCache = useMemo(() => {
    return cache.getPathCache();
  }, [cache]);

  return { result, pathCache };
}
