
/**
 * Calcula una puntuación (entre 10 y 100) según la cantidad de intentos
 * y el tiempo (en segundos) que el usuario tardó en resolver el ejercicio.
 *
 * - Si es el primer intento (attempts = 1) y el tiempo es bajo, retorna cerca de 100.
 * - Cada intento adicional penaliza con X puntos.
 * - Cada segundo adicional penaliza con Y puntos.
 */
export function calculatePoints(attempts: number, timeInSeconds: number): number {
  const MAX_POINTS = 100;
  const MIN_POINTS = 10;

  // Configura aquí cuánto penalizas por intento extra y por segundo:
  const penaltyPerExtraAttempt = 5;   // −5 puntos por cada intento adicional (más allá del primero)
  const penaltyPerSecond = 0.5;       // −0.5 puntos por cada segundo empleado

  const extraAttempts = Math.max(0, attempts - 1);
  let score = MAX_POINTS
            - extraAttempts * penaltyPerExtraAttempt
            - timeInSeconds * penaltyPerSecond;

  if (score < MIN_POINTS) score = MIN_POINTS;
  if (score > MAX_POINTS) score = MAX_POINTS;

  return Math.round(score);
}
