// Shims SqlJsKernelBackend's storage I/O and WASM asset resolution for the
// extension environment, WITHOUT modifying trellis-node.
//
// This works because `SqlJsKernelBackend`'s `private` members are TypeScript-
// only annotations -- they compile to ordinary instance/prototype methods, so
// they're reachable (and monkeypatchable) at runtime. That's real, but it's
// coupled to trellis-node's current internal method names and control flow
// (`bootstrap()`, `flushToDisk()`) rather than a published extension point.
// If those change upstream, this shim silently stops working -- see the
// conversation notes for the small, additive upstream fix (an injectable
// storage-adapter + locateFile option) that would remove this coupling.
//
// Revisit: once trellis-node exposes that option, delete this file and pass
// the adapter through `createKernelBackend`/`SqlJsKernelBackend.create`
// options directly instead of patching the prototype.
import { readOpfsSnapshot, writeOpfsSnapshot } from './opfs';

let patched = false;

export function patchSqlJsKernelBackendForExtension(SqlJsKernelBackendClass: unknown): void {
  if (patched) return;
  patched = true;

  const proto = (SqlJsKernelBackendClass as { prototype: Record<string, unknown> }).prototype;

  // Replaces the private `bootstrap()`: same shape (init sql.js WASM, load an
  // existing image into `this.db`), but resolves the wasm binary via
  // chrome.runtime.getURL and loads any prior snapshot from OPFS instead of
  // `require('fs')` (which doesn't exist in this context anyway).
  proto.bootstrap = async function bootstrapForExtension(this: {
    opts: { dbPath: string };
    db: unknown;
  }): Promise<void> {
    const mod = (await import('sql.js')) as { default?: (cfg?: unknown) => Promise<{ Database: new (data?: Uint8Array) => unknown }> };
    const initSqlJs = mod.default ?? (mod as unknown as (cfg?: unknown) => Promise<{ Database: new (data?: Uint8Array) => unknown }>);

    const SQL = await initSqlJs({
      locateFile: (file: string) => chrome.runtime.getURL(`assets/${file}`),
    });

    const existing = this.opts.dbPath === ':memory:' ? null : await readOpfsSnapshot(this.opts.dbPath);
    this.db = existing ? new SQL.Database(existing) : new SQL.Database();
  };

  // Replaces the private `flushToDisk()`: exports the in-memory image and
  // writes it to OPFS. Fire-and-forget, matching the original's calling
  // convention (never awaited by `append`/`saveSnapshot`/`close`).
  proto.flushToDisk = function flushToDiskForExtension(this: {
    opts: { dbPath: string };
    db: { export(): Uint8Array };
  }): void {
    if (this.opts.dbPath === ':memory:') return;
    const data = this.db.export();
    void writeOpfsSnapshot(this.opts.dbPath, data);
  };
}
