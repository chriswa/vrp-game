import { useState, useMemo, useCallback } from 'react';
import type { RiderId, VehicleId, Rider } from './types/problem';
import type { Solution, ItineraryStop } from './types/solution';
import { createEmptySolution } from './types/solution';
import { generateProblem, type Difficulty } from './generation/generateProblem';
import { generateTestSolution } from './generation/testSolver';
import { useSimulation } from './hooks/useSimulation';
import { usePlayback } from './hooks/usePlayback';
import { MapCanvas } from './rendering/MapCanvas';
import { VEHICLE_COLORS } from './rendering/drawVehicles';
import { formatTime } from './utils/time';

function App() {
  const [seed, setSeed] = useState(12345);
  const [seedInput, setSeedInput] = useState('12345');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [selectedVehicleId, setSelectedVehicleId] = useState<VehicleId | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<RiderId | null>(null);
  const [hoveredRiderId, setHoveredRiderId] = useState<RiderId | null>(null);

  // Generate problem from seed and difficulty
  const problem = useMemo(() => {
    return generateProblem({
      seed,
      gridSize: 8,
      vehicleCount: 3,
      riderCount: 8,
      difficulty,
    });
  }, [seed, difficulty]);

  // Player's solution
  const [solution, setSolution] = useState<Solution>(() => createEmptySolution());

  // Run simulation
  const { result: simulationResult, pathCache } = useSimulation(problem, solution);

  // Playback controls
  const [playbackState, playbackControls] = usePlayback(
    problem.serviceWindow.earliest,
    problem.serviceWindow.latest
  );

  // Build rider map for quick lookup
  const riderMap = useMemo(() => {
    const map = new Map<RiderId, Rider>();
    problem.riders.forEach((r) => map.set(r.id, r));
    return map;
  }, [problem.riders]);

  // Sort riders by pickup window start time, then by name
  const sortedRiders = useMemo(() => {
    return [...problem.riders].sort((a, b) => {
      const aTime = a.pickupWindow?.earliest ?? 0;
      const bTime = b.pickupWindow?.earliest ?? 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.name.localeCompare(b.name);
    });
  }, [problem.riders]);

  // Assign rider numbers (1-indexed)
  const riderNumbers = useMemo(() => {
    const map = new Map<RiderId, number>();
    sortedRiders.forEach((r, i) => map.set(r.id, i + 1));
    return map;
  }, [sortedRiders]);

  // Build rider-to-vehicle assignment map
  const riderAssignments = useMemo(() => {
    const map = new Map<RiderId, VehicleId>();
    for (const [vehicleId, itinerary] of solution) {
      for (const stop of itinerary) {
        if (stop.type === 'pickup') {
          map.set(stop.riderId, vehicleId);
        }
      }
    }
    return map;
  }, [solution]);

  // Vehicle index for colors
  const vehicleIndex = useMemo(() => {
    const map = new Map<VehicleId, number>();
    problem.vehicles.forEach((v, i) => map.set(v.id, i));
    return map;
  }, [problem.vehicles]);

  const handleNewPuzzle = () => {
    const newSeed = parseInt(seedInput, 10) || Date.now();
    setSeed(newSeed);
    setSeedInput(String(newSeed));
    setSolution(createEmptySolution());
    setSelectedVehicleId(null);
    setSelectedRiderId(null);
  };

  const handleRandomPuzzle = () => {
    const newSeed = Date.now();
    setSeed(newSeed);
    setSeedInput(String(newSeed));
    setSolution(createEmptySolution());
    setSelectedVehicleId(null);
    setSelectedRiderId(null);
  };

  const handleTestSolve = () => {
    const testSolution = generateTestSolution(problem, pathCache);
    setSolution(testSolution);
  };

  const handleClearSolution = () => {
    setSolution(createEmptySolution());
  };

  const handleReset = () => {
    playbackControls.pause();
    playbackControls.setTime(problem.serviceWindow.earliest);
  };

  // Select rider (clicking on rider list or map)
  // If rider is already assigned to a vehicle, also select that vehicle
  const handleSelectRider = useCallback((riderId: RiderId) => {
    if (selectedRiderId === riderId) {
      setSelectedRiderId(null);
    } else {
      setSelectedRiderId(riderId);
      const assignedVehicle = riderAssignments.get(riderId);
      if (assignedVehicle) {
        setSelectedVehicleId(assignedVehicle);
      }
    }
  }, [selectedRiderId, riderAssignments]);

  // Assign selected rider to a vehicle
  const handleAssignToVehicle = useCallback((vehicleId: VehicleId) => {
    if (!selectedRiderId) return;

    // Remove from any existing vehicle
    const newSolution = new Map(solution);
    for (const [vId, itinerary] of newSolution) {
      const filtered = itinerary.filter(s => s.riderId !== selectedRiderId);
      if (filtered.length !== itinerary.length) {
        newSolution.set(vId, filtered);
      }
    }

    // Add to selected vehicle
    const currentItinerary = newSolution.get(vehicleId) || [];
    const newItinerary = [
      ...currentItinerary,
      { riderId: selectedRiderId, type: 'pickup' as const },
      { riderId: selectedRiderId, type: 'dropoff' as const },
    ];
    newSolution.set(vehicleId, newItinerary);
    setSolution(newSolution);
    setSelectedRiderId(null);
  }, [selectedRiderId, solution]);

  // Remove rider from vehicle
  const handleRemoveRider = useCallback((riderId: RiderId) => {
    const newSolution = new Map(solution);
    for (const [vId, itinerary] of newSolution) {
      const filtered = itinerary.filter(s => s.riderId !== riderId);
      if (filtered.length !== itinerary.length) {
        newSolution.set(vId, filtered);
      }
    }
    setSolution(newSolution);
  }, [solution]);

  // Move stop up/down in itinerary
  const handleMoveStop = useCallback((vehicleId: VehicleId, index: number, direction: 'up' | 'down') => {
    const itinerary = solution.get(vehicleId);
    if (!itinerary) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= itinerary.length) return;

    const newItinerary = [...itinerary];
    [newItinerary[index], newItinerary[newIndex]] = [newItinerary[newIndex], newItinerary[index]];

    // Validate pickup-before-dropoff
    const pickupSeen = new Set<RiderId>();
    for (const stop of newItinerary) {
      if (stop.type === 'pickup') {
        pickupSeen.add(stop.riderId);
      } else if (!pickupSeen.has(stop.riderId)) {
        return; // Invalid
      }
    }

    const newSolution = new Map(solution);
    newSolution.set(vehicleId, newItinerary);
    setSolution(newSolution);
  }, [solution]);

  const selectedVehicle = selectedVehicleId
    ? problem.vehicles.find(v => v.id === selectedVehicleId)
    : null;
  const selectedItinerary = selectedVehicleId
    ? (solution.get(selectedVehicleId) || [])
    : [];
  const selectedVehicleResult = selectedVehicleId
    ? simulationResult.vehicleResults.get(selectedVehicleId)
    : null;
  const selectedRider = selectedRiderId ? riderMap.get(selectedRiderId) : null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 12px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Seed:</span>
        <input
          type="text"
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          style={{
            width: '80px',
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '13px',
          }}
        />
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          style={{
            padding: '4px 8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '13px',
            backgroundColor: '#fff',
          }}
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <button onClick={handleNewPuzzle} style={btnStyle}>Load</button>
        <button onClick={handleRandomPuzzle} style={{ ...btnStyle, backgroundColor: '#3b82f6', color: '#fff', border: 'none' }}>
          Random
        </button>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }} />

        <button onClick={handleTestSolve} style={{ ...btnStyle, backgroundColor: '#8b5cf6', color: '#fff', border: 'none' }}>
          Test Solve
        </button>
        <button onClick={handleClearSolution} style={btnStyle}>Clear</button>

        <div style={{ flex: 1 }} />

        {/* Score */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '13px',
        }}>
          <span>
            Lateness: <strong style={{ color: simulationResult.totalLateness > 0 ? '#ef4444' : '#22c55e' }}>
              {simulationResult.totalLateness.toFixed(0)}
            </strong>
          </span>
          <span>
            Unassigned: <strong style={{ color: simulationResult.unassignedRiders.length > 0 ? '#ef4444' : '#22c55e' }}>
              {simulationResult.unassignedRiders.length}
            </strong>
          </span>
          <div style={{
            padding: '4px 12px',
            backgroundColor: simulationResult.totalScore === 0 ? '#dcfce7' : '#fef2f2',
            borderRadius: '4px',
            fontWeight: 700,
            color: simulationResult.totalScore === 0 ? '#166534' : '#991b1b',
          }}>
            Score: {simulationResult.totalScore.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      }}>
        {/* Left panel - Vehicles and Riders list */}
        <div style={{
          width: '280px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          flexShrink: 0,
        }}>
          {/* Vehicles */}
          <div style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              VEHICLES
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {problem.vehicles.map((vehicle, idx) => {
                const isSelected = selectedVehicleId === vehicle.id;
                const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
                const itinerary = solution.get(vehicle.id) || [];
                const riderCount = itinerary.filter(s => s.type === 'pickup').length;

                return (
                  <div
                    key={vehicle.id}
                    onClick={() => setSelectedVehicleId(vehicle.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: isSelected ? `2px solid ${color}` : '2px solid transparent',
                    }}
                  >
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: color,
                    }} />
                    <span style={{ fontSize: '13px', fontWeight: isSelected ? 600 : 400, flex: 1 }}>
                      {vehicle.driverName}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {riderCount}/{vehicle.seatCount}
                    </span>
                    {vehicle.wheelchairCapacity > 0 && (
                      <span style={{ fontSize: '10px', color: '#1e40af' }}>WC</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Riders */}
          <div style={{ flex: 1, padding: '8px', overflow: 'auto' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>
              RIDERS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {sortedRiders.map((rider) => {
                const assignedTo = riderAssignments.get(rider.id);
                const assignedIdx = assignedTo ? vehicleIndex.get(assignedTo) ?? -1 : -1;
                const assignedColor = assignedIdx >= 0 ? VEHICLE_COLORS[assignedIdx % VEHICLE_COLORS.length] : null;
                const isSelected = selectedRiderId === rider.id;
                const riderNum = riderNumbers.get(rider.id) ?? 0;

                return (
                  <div
                    key={rider.id}
                    onClick={() => handleSelectRider(rider.id)}
                    onMouseEnter={() => setHoveredRiderId(rider.id)}
                    onMouseLeave={() => setHoveredRiderId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#dbeafe' : hoveredRiderId === rider.id ? '#f1f5f9' : !assignedTo ? '#fef2f2' : 'transparent',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
                    }}
                  >
                    <span style={{
                      width: '16px',
                      fontWeight: 600,
                      color: assignedColor || '#6b7280',
                    }}>
                      {riderNum}
                    </span>
                    {assignedColor ? (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: assignedColor,
                      }} />
                    ) : (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        border: '1px solid #94a3b8',
                      }} />
                    )}
                    <span style={{ color: assignedTo ? '#374151' : '#991b1b', minWidth: '50px' }}>
                      {rider.name}
                    </span>
                    {rider.accessibility.needsWheelchair && (
                      <span style={{ color: '#1e40af' }}>WC</span>
                    )}
                    {rider.pickupWindow && (
                      <span style={{ color: '#64748b' }}>
                        P:{formatTime(rider.pickupWindow.earliest)}
                      </span>
                    )}
                    {rider.dropoffWindow && (
                      <span style={{ color: '#64748b' }}>
                        D:{formatTime(rider.dropoffWindow.earliest)}
                      </span>
                    )}
                    {rider.maxTimeInVehicle && (
                      <span style={{ color: '#64748b' }}>
                        &lt;{rider.maxTimeInVehicle}m
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected rider detail */}
          {selectedRider && (
            <div style={{
              padding: '10px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                Rider #{riderNumbers.get(selectedRider.id)}: {selectedRider.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {selectedRider.accessibility.needsWheelchair && (
                  <div style={{ color: '#1e40af' }}>Requires wheelchair access</div>
                )}
                {selectedRider.pickupWindow ? (
                  <div>Pickup: {formatTime(selectedRider.pickupWindow.earliest)} - {formatTime(selectedRider.pickupWindow.latest)}</div>
                ) : (
                  <div>Pickup: anytime</div>
                )}
                {selectedRider.dropoffWindow ? (
                  <div>Dropoff: {formatTime(selectedRider.dropoffWindow.earliest)} - {formatTime(selectedRider.dropoffWindow.latest)}</div>
                ) : (
                  <div>Dropoff: anytime</div>
                )}
                {selectedRider.maxTimeInVehicle && (
                  <div>Max time in vehicle: {selectedRider.maxTimeInVehicle} min</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Center - Map */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '12px',
        }}>
          <MapCanvas
            problem={problem}
            solution={solution}
            simulationResult={simulationResult}
            currentTime={playbackState.currentTime}
            pathCache={pathCache}
            riderNumbers={riderNumbers}
            selectedRiderId={selectedRiderId}
            hoveredRiderId={hoveredRiderId}
            onRiderClick={handleSelectRider}
            onRiderHover={setHoveredRiderId}
            onVehicleClick={setSelectedVehicleId}
            width={500}
            height={500}
          />
        </div>

        {/* Right panel - Selected vehicle itinerary */}
        <div style={{
          width: '260px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e2e8f0',
          flexShrink: 0,
        }}>
          {selectedVehicle ? (
            <>
              <div style={{
                padding: '10px 12px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    backgroundColor: VEHICLE_COLORS[vehicleIndex.get(selectedVehicleId!)! % VEHICLE_COLORS.length],
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{selectedVehicle.driverName}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {formatTime(selectedVehicle.startTime)} - {formatTime(selectedVehicle.endTime)}
                  {' • '}{selectedVehicle.seatCount} seats
                  {selectedVehicle.wheelchairCapacity > 0 && ` • ${selectedVehicle.wheelchairCapacity} WC`}
                </div>
                {selectedVehicleResult?.vehicleEnd.minutesLate && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>
                    Ends {selectedVehicleResult.vehicleEnd.minutesLate.toFixed(0)} min late
                  </div>
                )}
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
                {selectedItinerary.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '13px',
                  }}>
                    No stops assigned.<br />
                    Select a rider to assign.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {selectedItinerary.map((stop, idx) => (
                      <StopRow
                        key={`${stop.riderId}-${stop.type}`}
                        stop={stop}
                        index={idx}
                        simStop={selectedVehicleResult?.stops[idx]}
                        riderName={riderMap.get(stop.riderId)?.name || stop.riderId}
                        riderNum={riderNumbers.get(stop.riderId) ?? 0}
                        isHighlighted={stop.riderId === hoveredRiderId || stop.riderId === selectedRiderId}
                        onMoveUp={() => handleMoveStop(selectedVehicleId!, idx, 'up')}
                        onMoveDown={() => handleMoveStop(selectedVehicleId!, idx, 'down')}
                        onRemove={() => handleRemoveRider(stop.riderId)}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < selectedItinerary.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Add rider button - show when rider selected and not already on this vehicle */}
              {selectedRiderId && riderAssignments.get(selectedRiderId) !== selectedVehicleId && (
                <div style={{
                  padding: '10px',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f0fdf4',
                }}>
                  <button
                    onClick={() => handleAssignToVehicle(selectedVehicleId!)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: '#22c55e',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    + Add Rider #{riderNumbers.get(selectedRiderId)} ({riderMap.get(selectedRiderId)?.name})
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: '13px',
              padding: '20px',
              textAlign: 'center',
            }}>
              Select a vehicle to view and edit its itinerary
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar - Playback controls */}
      <div style={{
        padding: '8px 12px',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <button
          onClick={playbackControls.toggle}
          style={{
            ...btnStyle,
            backgroundColor: playbackState.isPlaying ? '#f59e0b' : '#3b82f6',
            color: '#fff',
            border: 'none',
            minWidth: '70px',
          }}
        >
          {playbackState.isPlaying ? 'Pause' : 'Play'}
        </button>
        <button onClick={handleReset} style={btnStyle}>
          Reset
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Speed:</span>
          {[1, 2, 5, 10].map(speed => (
            <button
              key={speed}
              onClick={() => playbackControls.setSpeed(speed)}
              style={{
                ...btnStyle,
                padding: '2px 6px',
                fontSize: '11px',
                backgroundColor: playbackState.playbackSpeed === speed ? '#3b82f6' : '#f3f4f6',
                color: playbackState.playbackSpeed === speed ? '#fff' : '#374151',
                border: playbackState.playbackSpeed === speed ? 'none' : '1px solid #d1d5db',
              }}
            >
              {speed}x
            </button>
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#64748b', width: '45px' }}>
            {formatTime(problem.serviceWindow.earliest)}
          </span>
          <input
            type="range"
            min={problem.serviceWindow.earliest}
            max={problem.serviceWindow.latest}
            step={1}
            value={playbackState.currentTime}
            onChange={(e) => playbackControls.setTime(parseFloat(e.target.value))}
            style={{ flex: 1, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: '#64748b', width: '45px' }}>
            {formatTime(problem.serviceWindow.latest)}
          </span>
        </div>

        <div style={{
          padding: '4px 10px',
          backgroundColor: '#f1f5f9',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600,
          minWidth: '55px',
          textAlign: 'center',
        }}>
          {formatTime(playbackState.currentTime)}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  backgroundColor: '#f3f4f6',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  cursor: 'pointer',
};

interface StopRowProps {
  stop: ItineraryStop;
  index: number;
  simStop?: { arrivalTime: number; minutesEarly?: number; minutesLate?: number; minutesOverMaxTime?: number };
  riderName: string;
  riderNum: number;
  isHighlighted?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function StopRow({ stop, simStop, riderName, riderNum, isHighlighted, onMoveUp, onMoveDown, onRemove, canMoveUp, canMoveDown }: StopRowProps) {
  const isPickup = stop.type === 'pickup';
  const hasIssue = simStop?.minutesLate || simStop?.minutesOverMaxTime;

  let bgColor = '#f9fafb';
  if (isHighlighted) {
    bgColor = '#dbeafe';
  } else if (hasIssue) {
    bgColor = '#fef2f2';
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 8px',
      backgroundColor: bgColor,
      borderRadius: '4px',
      fontSize: '12px',
      border: isHighlighted ? '1px solid #3b82f6' : '1px solid transparent',
    }}>
      <span style={{
        width: '20px',
        fontWeight: 600,
        color: '#374151',
      }}>
        {riderNum}{isPickup ? '↑' : '↓'}
      </span>

      <span style={{ flex: 1 }}>{riderName}</span>

      {simStop && (
        <span style={{ color: '#64748b', fontSize: '11px' }}>
          {formatTime(simStop.arrivalTime)}
          {simStop.minutesLate && (
            <span style={{ color: '#ef4444', marginLeft: '2px' }}>
              +{simStop.minutesLate.toFixed(0)}
            </span>
          )}
        </span>
      )}

      <div style={{ display: 'flex', gap: '2px' }}>
        <button
          onClick={onMoveUp}
          disabled={!canMoveUp}
          style={{
            ...smallBtnStyle,
            opacity: canMoveUp ? 1 : 0.3,
          }}
        >
          ↑
        </button>
        <button
          onClick={onMoveDown}
          disabled={!canMoveDown}
          style={{
            ...smallBtnStyle,
            opacity: canMoveDown ? 1 : 0.3,
          }}
        >
          ↓
        </button>
        {isPickup && (
          <button onClick={onRemove} style={{ ...smallBtnStyle, color: '#ef4444' }}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  color: '#64748b',
  backgroundColor: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: '3px',
  cursor: 'pointer',
  padding: 0,
};

export default App;
