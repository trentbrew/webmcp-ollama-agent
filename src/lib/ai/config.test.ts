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

  it('appends tool-first guidance when tools are exposed', () => {
    const prompt = buildChatSystemPrompt('en', { toolNames: ['webmcp_console', 'list_entities'] });
    expect(prompt).toContain('Prefer calling tools over guessing');
    expect(prompt).toContain('webmcp_console');
    expect(prompt).toContain('list_entities');
  });

  it('includes clarify-then-act policy in the base prompt', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('Clarify-then-act for page WebMCP tools');
    expect(CHAT_SYSTEM_PROMPT).toContain('Read-only tools (readOnlyHint): call immediately');
    expect(CHAT_SYSTEM_PROMPT).toContain('call ask_user with inferred defaults before the page tool');
  });

  it('appends custom instructions after language and tool sections', () => {
    const prompt = buildChatSystemPrompt('es', {
      toolNames: ['list_entities'],
      customInstructions: 'Focus on game mechanics.',
    });
    expect(prompt).toContain('Respond in Spanish');
    expect(prompt).toContain('list_entities');
    expect(prompt.endsWith('Focus on game mechanics.')).toBe(true);
  });

  it('omits whitespace-only custom instructions', () => {
    const prompt = buildChatSystemPrompt('en', { customInstructions: '   \n\t  ' });
    expect(prompt).toBe(CHAT_SYSTEM_PROMPT);
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
