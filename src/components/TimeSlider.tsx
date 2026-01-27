import { formatTime } from '../utils/time';

interface TimeSliderProps {
  currentTime: number;
  startTime: number;
  endTime: number;
  onTimeChange: (time: number) => void;
}

export function TimeSlider({
  currentTime,
  startTime,
  endTime,
  onTimeChange,
}: TimeSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTimeChange(parseFloat(e.target.value));
  };

  const progress = ((currentTime - startTime) / (endTime - startTime)) * 100;

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        fontSize: '14px',
        color: '#6b7280',
      }}>
        <span>{formatTime(startTime)}</span>
        <span style={{ fontWeight: 600, color: '#1f2937' }}>
          {formatTime(currentTime)}
        </span>
        <span>{formatTime(endTime)}</span>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          height: '8px',
          width: '100%',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          transform: 'translateY(-50%)',
          height: '8px',
          width: `${progress}%`,
          backgroundColor: '#3b82f6',
          borderRadius: '4px',
        }} />
        <input
          type="range"
          min={startTime}
          max={endTime}
          step={1}
          value={currentTime}
          onChange={handleChange}
          style={{
            position: 'relative',
            width: '100%',
            height: '24px',
            background: 'transparent',
            cursor: 'pointer',
            WebkitAppearance: 'none',
          }}
        />
      </div>
    </div>
  );
}
