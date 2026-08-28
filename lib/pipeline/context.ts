import { AsyncLocalStorage } from "node:async_hooks";

type PipelineContext = {
  userId: string;
  generationId: string;
};

const storage = new AsyncLocalStorage<PipelineContext>();

export function runWithPipelineContext<T>(
  context: PipelineContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, fn);
}

export function getPipelineContext(): PipelineContext | null {
  return storage.getStore() ?? null;
}

export function requirePipelineContext(): PipelineContext {
  const context = storage.getStore();
  if (!context) {
    throw new Error("Pipeline storage context is missing.");
  }
  return context;
}
