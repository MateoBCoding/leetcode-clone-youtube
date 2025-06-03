export function calculatePoints(attempts: number, timeInSeconds: number): number {
  const MAX_POINTS = 100;
  const MIN_POINTS = 10;

  const penaltyPerExtraAttempt = 5;  
  const penaltyPerSecond = 0.5;   

  const extraAttempts = Math.max(0, attempts - 1);
  let score = MAX_POINTS
            - extraAttempts * penaltyPerExtraAttempt
            - timeInSeconds * penaltyPerSecond;

  if (score < MIN_POINTS) score = MIN_POINTS;
  if (score > MAX_POINTS) score = MAX_POINTS;

  return Math.round(score);
}
