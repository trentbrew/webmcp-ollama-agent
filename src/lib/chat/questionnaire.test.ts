import { describe, expect, it } from 'vitest';
import {
  formatAnswersSummary,
  isItemAnswered,
  parseAskUserArgs,
  validateQuestionnaire,
  type QuestionnaireItem,
} from '../ai/questionnaire';

const sizeItem: QuestionnaireItem = {
  name: 'size',
  prompt: 'Pizza size?',
  required: true,
  choices: [
    { value: 'Small', label: 'Small' },
    { value: 'Large', label: 'Large' },
  ],
};

describe('parseAskUserArgs', () => {
  it('accepts a valid items array', () => {
    const result = parseAskUserArgs({
      items: [sizeItem, { name: 'people', prompt: 'How many?', input: { label: 'Guests' } }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.items).toHaveLength(2);
  });

  it('rejects empty items', () => {
    const result = parseAskUserArgs({ items: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects items without choices or input', () => {
    const result = parseAskUserArgs({ items: [{ name: 'x', prompt: 'X?' }] });
    expect(result.ok).toBe(false);
  });
});

describe('validateQuestionnaire', () => {
  it('requires answers for required items', () => {
    const result = validateQuestionnaire([sizeItem], {});
    expect(result.ok).toBe(false);
  });

  it('passes when required items are answered', () => {
    const result = validateQuestionnaire([sizeItem], { size: 'Large' });
    expect(result.ok).toBe(true);
  });
});

describe('isItemAnswered', () => {
  it('handles single and multiple choice', () => {
    expect(isItemAnswered(sizeItem, { size: 'Large' })).toBe(true);
    expect(
      isItemAnswered(
        { ...sizeItem, multiple: true },
        { size: ['Small', 'Large'] },
      ),
    ).toBe(true);
  });
});

describe('formatAnswersSummary', () => {
  it('summarizes answers for the transcript', () => {
    expect(formatAnswersSummary({ size: 'Large', people: '4' })).toBe('size: Large · people: 4');
  });
});
