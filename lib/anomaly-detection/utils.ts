
export const parseTimestamp = (timestamp: string | null): Date | null => {
  if (!timestamp) return null;
  return new Date(timestamp);
};

export const getMinutesDifference = (start: Date, end: Date): number => {
  return Math.abs(end.getTime() - start.getTime()) / (1000 * 60);
};

export const getHoursDifference = (start: Date, end: Date): number => {
  return getMinutesDifference(start, end) / 60;
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

export const getWeekStart = (date: Date): Date => {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day;
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const isTimeBetween = (time: Date, startHour: number, endHour: number): boolean => {
  const hour = time.getHours();
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour;
  } else {
    // Overnight period (e.g., 22:00 to 05:00)
    return hour >= startHour || hour < endHour;
  }
};

export const parseTimeString = (timeStr: string): { hours: number; minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

export const getTimeDifferenceInMinutes = (scheduled: string, actual: string): number => {
  const scheduledTime = parseTimestamp(scheduled);
  const actualTime = parseTimestamp(actual);
  
  if (!scheduledTime || !actualTime) return 0;
  
  return (actualTime.getTime() - scheduledTime.getTime()) / (1000 * 60);
};
