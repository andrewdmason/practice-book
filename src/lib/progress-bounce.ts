// Tracks bounce direction per task for right-click progress cycling.
// Sequence: 0 → 1 → 2 → 3 → 2 → 1 → 0 → 1 → ... (never reaches 4)
const bounceDirections = new Map<string, "up" | "down">();

export function getNextBounceProgress(
  taskId: string,
  currentProgress: number
): number {
  if (currentProgress >= 4) {
    bounceDirections.set(taskId, "down");
    return 3;
  }

  let direction = bounceDirections.get(taskId) ?? "up";

  if (currentProgress === 0) direction = "up";
  if (currentProgress >= 3) direction = "down";

  const next = direction === "up" ? currentProgress + 1 : currentProgress - 1;

  if (next >= 3) bounceDirections.set(taskId, "down");
  else if (next <= 0) bounceDirections.set(taskId, "up");
  else bounceDirections.set(taskId, direction);

  return next;
}
