/**
 * Lightweight chat sound effects.
 *
 * Resolves the packaged asset via the extension runtime so it works both in a
 * bundled Chrome extension (chrome-extension://…) and in the Vite dev server.
 */

function assetUrl(path: string): string {
  const runtime = (globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } } }).chrome;
  if (runtime?.runtime?.getURL) {
    try {
      return runtime.runtime.getURL(path);
    } catch {
      // Fall through to a relative URL.
    }
  }
  return `/${path}`;
}

let responseCompleteAudio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!responseCompleteAudio) {
    responseCompleteAudio = new Audio(assetUrl('sounds/response-complete.wav'));
    responseCompleteAudio.volume = 0.5;
  }
  return responseCompleteAudio;
}

/** Play the "response complete" chime. Best-effort; silently ignores failures. */
export function playResponseComplete(): void {
  const audio = getAudio();
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay may be blocked before the first user gesture; ignore.
    });
  } catch {
    // Ignore playback errors.
  }
}
