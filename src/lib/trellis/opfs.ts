// OPFS-backed byte storage for the embedded Trellis kernel's SQLite image.
// Origin Private File System is scoped per-extension-origin, survives reloads,
// and (unlike chrome.storage.local) doesn't need the `unlimitedStorage`
// permission or base64/structured-clone overhead for a binary blob.

function sanitizeName(name: string): string {
  const cleaned = name.replace(/[^\w.-]/g, '_');
  return cleaned || 'trellis.sqlite';
}

export async function readOpfsSnapshot(name: string): Promise<Uint8Array | null> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(sanitizeName(name), { create: false });
    const file = await handle.getFile();
    if (file.size === 0) return null;
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    // No snapshot yet, or OPFS unavailable in this context.
    return null;
  }
}

export async function writeOpfsSnapshot(name: string, data: Uint8Array): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(sanitizeName(name), { create: true });
    const writable = await handle.createWritable();
    await writable.write(data as BufferSource);
    await writable.close();
  } catch (error) {
    console.warn('[trellis] Failed to persist OPFS snapshot', error);
  }
}

export function isOpfsAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';
}
