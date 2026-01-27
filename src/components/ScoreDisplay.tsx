import type { SimulationResult } from '../types/simulation';

interface ScoreDisplayProps {
  result: SimulationResult;
}

export function ScoreDisplay({ result }: ScoreDisplayProps) {
  const hasViolations = result.totalLateness > 0;
  const hasUnassigned = result.unassignedRiders.length > 0;

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
    }}>
      <h2 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 600 }}>
        Score
      </h2>

      <div style={{
        fontSize: '32px',
        fontWeight: 700,
        color: result.totalScore === 0 ? '#22c55e' : '#ef4444',
        marginBottom: '16px',
      }}>
        {result.totalScore.toLocaleString()}
      </div>

      <div style={{ fontSize: '14px', color: '#6b7280' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}>
          <span>Lateness penalty:</span>
          <span style={{ color: hasViolations ? '#ef4444' : '#22c55e' }}>
            {result.totalLateness.toFixed(1)} min
          </span>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Unassigned riders:</span>
          <span style={{ color: hasUnassigned ? '#ef4444' : '#22c55e' }}>
            {result.unassignedRiders.length} ({result.unassignedPenalty.toLocaleString()})
          </span>
        </div>
      </div>

      {result.totalScore === 0 && (
        <div style={{
          marginTop: '12px',
          padding: '8px',
          backgroundColor: '#dcfce7',
          borderRadius: '4px',
          color: '#166534',
          fontSize: '14px',
          textAlign: 'center',
        }}>
          Perfect score!
        </div>
      )}
    </div>
  );
}
