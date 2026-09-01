import { describe, expect, it } from 'vitest';
import {
  gatherResumableSessions,
  sortResumableSessions,
  type ResumableSession,
} from './persistence';

describe('sortResumableSessions', () => {
  it('orders open tabs by updatedAt descending', () => {
    const sessions: ResumableSession[] = [
      {
        kind: 'open',
        tabId: 1,
        title: 'Older',
        url: 'https://a.test',
        messageCount: 2,
        updatedAt: 100,
      },
      {
        kind: 'open',
        tabId: 2,
        title: 'Newer',
        url: 'https://b.test',
        messageCount: 3,
        updatedAt: 500,
      },
    ];

    const sorted = sortResumableSessions(sessions);
    expect(sorted[0]?.tabId).toBe(2);
    expect(sorted[1]?.tabId).toBe(1);
  });

  it('orders archives by closedAt mixed with open tabs', () => {
    const sessions: ResumableSession[] = [
      {
        kind: 'open',
        tabId: 1,
        title: 'Tab',
        url: null,
        messageCount: 1,
        updatedAt: 200,
      },
      {
        kind: 'archive',
        id: 'arch-1',
        tabId: 9,
        title: 'Closed',
        url: null,
        messageCount: 4,
        closedAt: 900,
      },
    ];

    const sorted = sortResumableSessions(sessions);
    expect(sorted[0]?.kind).toBe('archive');
  });
});

describe('listResumableSessions', () => {
  it('gatherResumableSessions excludes active tab and sorts results', () => {
    const sessions = gatherResumableSessions(
      1,
      [
        { id: 1, title: 'Active', url: 'https://a.test' },
        { id: 2, title: 'Tab B', url: 'https://b.test' },
      ],
      {
        2: {
          messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
          title: 'Tab B',
          url: 'https://b.test',
          updatedAt: 300,
        },
      },
      () => undefined,
      [
        {
          id: 'arch-1',
          tabId: 99,
          url: 'https://old.test',
          title: 'Old tab',
          messages: [{ id: 'm2', role: 'user', parts: [{ type: 'text', text: 'bye' }] }],
          closedAt: 1000,
        },
      ],
    );

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.kind).toBe('archive');
    expect(sessions.some((s) => s.kind === 'open' && s.tabId === 2)).toBe(true);
  });
});
