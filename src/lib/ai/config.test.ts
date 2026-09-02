import { describe, expect, it } from 'vitest';
import { buildChatSystemPrompt, CHAT_SYSTEM_PROMPT, isChatLanguage } from './config';

describe('buildChatSystemPrompt', () => {
  it('returns the base prompt for English', () => {
    expect(buildChatSystemPrompt('en')).toBe(CHAT_SYSTEM_PROMPT);
  });

  it('appends a language instruction for non-English locales', () => {
    expect(buildChatSystemPrompt('es')).toContain('Respond in Spanish');
    expect(buildChatSystemPrompt('fr')).toContain('Respond in French');
    expect(buildChatSystemPrompt('de')).toContain('Respond in German');
  });
});

describe('isChatLanguage', () => {
  it('accepts supported locale codes', () => {
    expect(isChatLanguage('en')).toBe(true);
    expect(isChatLanguage('es')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(isChatLanguage('jp')).toBe(false);
    expect(isChatLanguage(null)).toBe(false);
  });
});
