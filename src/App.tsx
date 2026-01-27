import { useState, useMemo, useCallback } from 'react';
import type { RiderId } from './types/problem';
import type { Solution } from './types/solution';
import { createEmptySolution } from './types/solution';
import { generateProblem } from './generation/generateProblem';
import { useSimulation } from './hooks/useSimulation';
import { usePlayback } from './hooks/usePlayback';
import { MapCanvas } from './rendering/MapCanvas';
import { VehiclePanel } from './components/VehiclePanel';
import { RiderPanel } from './components/RiderPanel';
import { ScoreDisplay } from './components/ScoreDisplay';
import { TimeSlider } from './components/TimeSlider';
import { ControlBar } from './components/ControlBar';

function App() {
  const [seed, setSeed] = useState(12345);
  const [seedInput, setSeedInput] = useState('12345');

  // Generate problem from seed
  const problem = useMemo(() => {
    return generateProblem({
      seed,
      gridSize: 8,
      vehicleCount: 3,
      riderCount: 8,
    });
  }, [seed]);

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
    const map = new Map<RiderId, typeof problem.riders[0]>();
    problem.riders.forEach((r) => map.set(r.id, r));
    return map;
  }, [problem.riders]);

  // Drag handler (just for visual feedback, actual drop handled in panels)
  const handleRiderDragStart = useCallback((_riderId: RiderId) => {
    // Could add visual feedback here
  }, []);

  const handleNewPuzzle = () => {
    const newSeed = parseInt(seedInput, 10) || Date.now();
    setSeed(newSeed);
    setSeedInput(String(newSeed));
    setSolution(createEmptySolution());
  };

  const handleRandomPuzzle = () => {
    const newSeed = Date.now();
    setSeed(newSeed);
    setSeedInput(String(newSeed));
    setSolution(createEmptySolution());
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Left sidebar - Vehicles and Riders */}
      <div style={{
        width: '320px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e5e7eb',
      }}>
        <ScoreDisplay result={simulationResult} />

        <VehiclePanel
          vehicles={problem.vehicles}
          solution={solution}
          vehicleResults={simulationResult.vehicleResults}
          riders={riderMap}
          onSolutionChange={setSolution}
        />

        <RiderPanel
          riders={problem.riders}
          unassignedRiderIds={simulationResult.unassignedRiders}
          onDragStart={handleRiderDragStart}
        />
      </div>

      {/* Main content - Map and Controls */}
      <div style={{
        flex: 1,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Top controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
        }}>
          <span style={{ fontWeight: 600 }}>Puzzle Seed:</span>
          <input
            type="text"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            style={{
              width: '120px',
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
          <button
            onClick={handleNewPuzzle}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#374151',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Load
          </button>
          <button
            onClick={handleRandomPuzzle}
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Random Puzzle
          </button>
        </div>

        {/* Map */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <MapCanvas
            problem={problem}
            solution={solution}
            simulationResult={simulationResult}
            currentTime={playbackState.currentTime}
            pathCache={pathCache}
          />
        </div>

        {/* Playback controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}>
            <TimeSlider
              currentTime={playbackState.currentTime}
              startTime={problem.serviceWindow.earliest}
              endTime={problem.serviceWindow.latest}
              onTimeChange={playbackControls.setTime}
            />
          </div>

          <ControlBar
            isPlaying={playbackState.isPlaying}
            playbackSpeed={playbackState.playbackSpeed}
            onTogglePlay={playbackControls.toggle}
            onSpeedChange={playbackControls.setSpeed}
            onReset={() => playbackControls.setTime(problem.serviceWindow.earliest)}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
