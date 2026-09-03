import { describe, expect, it } from 'vitest';
import { extractToolResultError } from './toolResult';

describe('extractToolResultError', () => {
  it('returns null for non-object results', () => {
    expect(extractToolResultError('Filters updated.')).toBeNull();
    expect(extractToolResultError(42)).toBeNull();
    expect(extractToolResultError(null)).toBeNull();
    expect(extractToolResultError(undefined)).toBeNull();
    expect(extractToolResultError([{ isError: true }])).toBeNull();
  });

  it('returns null for a healthy result with no isError flag', () => {
    expect(extractToolResultError({ content: [{ type: 'text', text: 'ok' }] })).toBeNull();
    const value = { content: [{ type: 'text', text: 'Filters updated.' }], isError: false };
    expect(extractToolResultError(value)).toBeNull();
  });

  it('surfaces an error from content[].isError using its text', () => {
    const result = {
      content: [
        {
          type: 'text',
          text: 'Timed out waiting for UI to update (requestId: abc123)',
          isError: true,
        },
      ],
    };
    expect(extractToolResultError(result)).toBe(
      'Timed out waiting for UI to update (requestId: abc123)',
    );
  });

  it('surfaces a top-level isError result', () => {
    const result = {
      isError: true,
      content: [{ type: 'text', text: 'Something went wrong.' }],
    };
    expect(extractToolResultError(result)).toBe('Something went wrong.');
  });

  it('prefers an explicit error/message field over content', () => {
    const result = {
      content: [{ type: 'text', text: 'fallback', isError: true }],
      error: 'explicit error',
      isError: true,
    };
    expect(extractToolResultError(result)).toBe('explicit error');
  });

  it('falls back to a generic message when isError has no text', () => {
    expect(extractToolResultError({ isError: true })).toBe('Tool returned an error result.');
    expect(extractToolResultError({ content: [{ type: 'text', text: '', isError: true }] })).toBe(
      'Tool returned an error result.',
    );
  });
});
