import { describe, expect, it, vi } from 'vitest';
import {
  extractAskUserPayloadFromText,
  formatAnswersSummary,
  isItemAnswered,
  isQuestionVisible,
  normalizeAskUserPayload,
  parseAskUserArgs,
  seedAnswersFromDefaults,
  stripAskUserPseudoCode,
  todayIsoDate,
  validateItemValue,
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

  it('accepts default and validation on items', () => {
    const result = parseAskUserArgs({
      items: [
        {
          name: 'outboundDate',
          prompt: 'Confirm departure',
          default: '2027-06-01',
          input: { label: 'Date', inputType: 'date' },
          validation: { minDate: 'today', message: 'Too early.' },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0].default).toBe('2027-06-01');
      expect(result.items[0].validation?.minDate).toBe('today');
    }
  });

  it('rejects empty items', () => {
    const result = parseAskUserArgs({ items: [] });
    expect(result.ok).toBe(false);
  });

  it('rejects items without choices or input', () => {
    const result = parseAskUserArgs({ items: [{ name: 'x', prompt: 'X?' }] });
    expect(result.ok).toBe(false);
  });

  it('accepts title/choices shorthand at top level', () => {
    const result = parseAskUserArgs({
      type: 'choice',
      title: 'Start New Maze Game?',
      description: 'Are you sure?',
      choices: ['Yes', 'No'],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0].prompt).toBe('Start New Maze Game?');
      expect(result.items[0].choices?.map((c) => c.value)).toEqual(['Yes', 'No']);
    }
  });
});

describe('extractAskUserPayloadFromText', () => {
  it('parses ask_user pseudo-code from reasoning text', () => {
    const text = `I'll confirm first:\n\`\`\`js\n(await ask_user({
      "type": "choice",
      "title": "Start game?",
      "choices": ["Yes", "No"]
    })).choice === "Yes"\n\`\`\``;
    const payload = extractAskUserPayloadFromText(text);
    expect(payload).toMatchObject({ title: 'Start game?', choices: ['Yes', 'No'] });
    const parsed = parseAskUserArgs(payload);
    expect(parsed.ok).toBe(true);
  });
});

describe('stripAskUserPseudoCode', () => {
  it('removes fenced ask_user blocks', () => {
    const text = 'Before\n```js\nask_user({ "title": "Go?", "choices": ["Yes"] })\n```\nAfter';
    expect(stripAskUserPseudoCode(text)).toBe('Before\n\nAfter');
  });
});

describe('normalizeAskUserPayload', () => {
  it('returns null for empty payloads', () => {
    expect(normalizeAskUserPayload({})).toBeNull();
  });
});

describe('seedAnswersFromDefaults', () => {
  it('seeds empty answers from item defaults', () => {
    const items: QuestionnaireItem[] = [
      {
        name: 'outboundDate',
        prompt: 'Date?',
        default: '2027-06-01',
        input: { label: 'Date', inputType: 'date' },
      },
    ];
    expect(seedAnswersFromDefaults(items, {})).toEqual({ outboundDate: '2027-06-01' });
  });

  it('does not overwrite existing answers', () => {
    const items: QuestionnaireItem[] = [
      {
        name: 'outboundDate',
        prompt: 'Date?',
        default: '2027-06-01',
        input: { label: 'Date', inputType: 'date' },
      },
    ];
    expect(seedAnswersFromDefaults(items, { outboundDate: '2027-07-01' })).toEqual({
      outboundDate: '2027-07-01',
    });
  });
});

describe('isQuestionVisible', () => {
  it('respects when gates', () => {
    const item: QuestionnaireItem = {
      name: 'inboundDate',
      prompt: 'Return?',
      when: { tripType: 'round-trip' },
      input: { label: 'Date', inputType: 'date' },
    };
    expect(isQuestionVisible(item, { tripType: 'one-way' })).toBe(false);
    expect(isQuestionVisible(item, { tripType: 'round-trip' })).toBe(true);
  });
});

describe('validateItemValue', () => {
  it('rejects date before minDate baseline for date inputs', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));

    const item: QuestionnaireItem = {
      name: 'outboundDate',
      prompt: 'Date?',
      input: { label: 'Date', inputType: 'date' },
    };

    expect(validateItemValue(item, '1997-06-01').ok).toBe(false);
    expect(validateItemValue(item, todayIsoDate()).ok).toBe(true);

    vi.useRealTimers();
  });

  it('uses custom validation message', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));

    const item: QuestionnaireItem = {
      name: 'outboundDate',
      prompt: 'Date?',
      input: { label: 'Date', inputType: 'date' },
      validation: { message: 'Departure must be today or later.' },
    };

    const result = validateItemValue(item, '1997-06-01');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Departure must be today or later.');

    vi.useRealTimers();
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

  it('rejects invalid values on submit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T12:00:00Z'));

    const item: QuestionnaireItem = {
      name: 'outboundDate',
      prompt: 'Date?',
      required: true,
      input: { label: 'Date', inputType: 'date' },
    };

    const result = validateQuestionnaire([item], { outboundDate: '1997-06-01' });
    expect(result.ok).toBe(false);

    vi.useRealTimers();
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
