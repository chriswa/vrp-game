import { useMemo } from 'react';
import type { Problem } from '../types/problem';
import type { Solution } from '../types/solution';
import type { SimulationResult } from '../types/simulation';
import { SimulationCache } from '../simulation/cache';
import { PathCache } from '../pathfinding/pathCache';

export function useSimulation(problem: Problem, solution: Solution) {
  const cache = useMemo(() => new SimulationCache(problem), [problem]);

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
