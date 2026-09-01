import { SqlJsKernelBackend, TrellisKernel } from 'trellis/browser-core';
import { patchSqlJsKernelBackendForExtension } from './kernelShim';
import { isOpfsAvailable } from './opfs';

export const trellisState = $state({
  status: 'idle' as 'idle' | 'booting' | 'ready' | 'error',
  error: null as string | null,
  opsReplayed: 0,
  opCount: 0,
});

let kernelPromise: Promise<TrellisKernel> | null = null;

export function getTrellisKernel(): Promise<TrellisKernel> {
  if (!kernelPromise) kernelPromise = boot();
  return kernelPromise;
}

async function boot(): Promise<TrellisKernel> {
  trellisState.status = 'booting';
  trellisState.error = null;

  if (!isOpfsAvailable()) {
    trellisState.status = 'error';
    trellisState.error = 'OPFS is not available in this context.';
    throw new Error(trellisState.error);
  }

  try {
    patchSqlJsKernelBackendForExtension(SqlJsKernelBackend);

    const backend = await SqlJsKernelBackend.create({ dbPath: 'webmcp-trellis-graph.sqlite', autoFlushEvery: 20 });
    backend.init();

    const kernel = new TrellisKernel({ backend, agentId: 'webmcp-extension', autoReplay: true });
    const { opsReplayed } = kernel.boot();

    trellisState.opsReplayed = opsReplayed;
    trellisState.opCount = backend.getOpCount();
    trellisState.status = 'ready';

    return kernel;
  } catch (error) {
    trellisState.status = 'error';
    trellisState.error = error instanceof Error ? error.message : String(error);
    kernelPromise = null;
    throw error;
  }
}

export async function refreshTrellisOpCount(): Promise<void> {
  const kernel = await getTrellisKernel();
  trellisState.opCount = kernel.getBackend().getOpCount();
}
