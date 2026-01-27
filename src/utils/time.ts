// Format minutes from midnight as HH:MM
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Format minutes from midnight as 12-hour time with AM/PM
export function formatTime12h(minutes: number): string {
  const hours24 = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const hours12 = hours24 % 12 || 12;
  const ampm = hours24 < 12 ? 'AM' : 'PM';
  return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

// Parse HH:MM to minutes from midnight
export function parseTime(timeStr: string): number {
  const [hours, mins] = timeStr.split(':').map(Number);
  return hours * 60 + mins;
}

// Format duration in minutes as a human-readable string
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return 'less than a minute';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
