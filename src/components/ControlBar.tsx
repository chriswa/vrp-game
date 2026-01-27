interface ControlBarProps {
  isPlaying: boolean;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
}

const SPEED_OPTIONS = [0.5, 1, 2, 5, 10];

export function ControlBar({
  isPlaying,
  playbackSpeed,
  onTogglePlay,
  onSpeedChange,
  onReset,
}: ControlBarProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      border: '1px solid #e5e7eb',
    }}>
      <button
        onClick={onTogglePlay}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 500,
          color: '#ffffff',
          backgroundColor: isPlaying ? '#f59e0b' : '#3b82f6',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          minWidth: '80px',
        }}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>

      <button
        onClick={onReset}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          fontWeight: 500,
          color: '#374151',
          backgroundColor: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Reset
      </button>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginLeft: '12px',
      }}>
        <span style={{ fontSize: '14px', color: '#6b7280' }}>Speed:</span>
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: playbackSpeed === speed ? 600 : 400,
              color: playbackSpeed === speed ? '#ffffff' : '#374151',
              backgroundColor: playbackSpeed === speed ? '#3b82f6' : '#f3f4f6',
              border: '1px solid',
              borderColor: playbackSpeed === speed ? '#3b82f6' : '#d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
