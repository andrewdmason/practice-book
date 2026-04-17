import { createTask } from "@/app/(app)/timer/task-actions";
import type { PieceKind, SectionStatus, TaskWithDetails } from "@/lib/types";

export type OptimisticTaskDetail = {
  tempId: string;
  pieceId: string | null;
  sectionId: string | null;
  date: string;
  text?: string;
  metronomeSpeed: number | null;
  timerSeconds?: number;
  pieceName: string | null;
  pieceComposer: string | null;
  pieceKind: PieceKind | null;
  sectionLabel: string | null;
  sectionStatus: SectionStatus | null;
};

export type OptimisticTaskRollback = { tempId: string };

export function emitOptimisticTask(
  input: Omit<OptimisticTaskDetail, "tempId">
): string {
  const tempId = `temp-${crypto.randomUUID()}`;
  window.dispatchEvent(
    new CustomEvent<OptimisticTaskDetail>("task-created-optimistic", {
      detail: { ...input, tempId },
    })
  );
  return tempId;
}

export function rollbackOptimisticTask(tempId: string): void {
  window.dispatchEvent(
    new CustomEvent<OptimisticTaskRollback>("task-created-rollback", {
      detail: { tempId },
    })
  );
}

export async function createTaskOptimistic(
  input: Omit<OptimisticTaskDetail, "tempId">
): Promise<void> {
  const tempId = emitOptimisticTask(input);
  try {
    await createTask(
      input.pieceId,
      input.sectionId,
      input.metronomeSpeed,
      input.date
    );
  } catch (err) {
    rollbackOptimisticTask(tempId);
    throw err;
  }
}

export type OptimisticTaskUpdate = {
  taskId: string;
  updates: Partial<TaskWithDetails>;
};

export function emitOptimisticTaskUpdate(
  taskId: string,
  updates: Partial<TaskWithDetails>
): void {
  window.dispatchEvent(
    new CustomEvent<OptimisticTaskUpdate>("task-updated-optimistic", {
      detail: { taskId, updates },
    })
  );
}

export type OptimisticTaskDelete = { taskId: string };

export function emitOptimisticTaskDelete(taskId: string): void {
  window.dispatchEvent(
    new CustomEvent<OptimisticTaskDelete>("task-deleted-optimistic", {
      detail: { taskId },
    })
  );
}
