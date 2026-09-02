import { z } from 'zod';

export type QuestionnaireChoice = {
  value: string;
  label: string;
  description?: string;
  shortcut?: string;
};

export type QuestionnaireValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
  message?: string;
};

export type QuestionnaireItem = {
  name: string;
  prompt: string;
  description?: string;
  required?: boolean;
  multiple?: boolean;
  default?: string | string[];
  validation?: QuestionnaireValidation;
  when?: Record<string, string | string[]>;
  choices?: QuestionnaireChoice[];
  input?: { label: string; placeholder?: string; inputType?: 'text' | 'number' | 'date' };
};

export type QuestionnaireAnswers = Record<string, string | string[]>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveDateBound(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === 'today') return todayIsoDate();
  return ISO_DATE.test(value) ? value : undefined;
}

function effectiveValidation(item: QuestionnaireItem): QuestionnaireValidation | undefined {
  const base = item.validation ? { ...item.validation } : {};
  if (item.input?.inputType === 'date' && base.minDate === undefined) {
    base.minDate = 'today';
  }
  return Object.keys(base).length > 0 ? base : undefined;
}

function parseValidation(raw: unknown): QuestionnaireValidation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const v = raw as QuestionnaireValidation;
  const validation: QuestionnaireValidation = {};
  if (typeof v.min === 'number') validation.min = v.min;
  if (typeof v.max === 'number') validation.max = v.max;
  if (typeof v.minLength === 'number') validation.minLength = v.minLength;
  if (typeof v.maxLength === 'number') validation.maxLength = v.maxLength;
  if (typeof v.pattern === 'string' && v.pattern.trim()) validation.pattern = v.pattern;
  if (typeof v.minDate === 'string') validation.minDate = v.minDate;
  if (typeof v.maxDate === 'string') validation.maxDate = v.maxDate;
  if (typeof v.message === 'string' && v.message.trim()) validation.message = v.message.trim();
  return Object.keys(validation).length > 0 ? validation : undefined;
}

function parseWhen(raw: unknown): Record<string, string | string[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const when: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') when[key] = value;
    else if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
      when[key] = value;
    }
  }
  return Object.keys(when).length > 0 ? when : undefined;
}

function parseDefault(
  raw: unknown,
  multiple: boolean,
): string | string[] | undefined {
  if (multiple) {
    if (!Array.isArray(raw)) return undefined;
    if (!raw.every((entry) => typeof entry === 'string')) return undefined;
    return raw;
  }
  return typeof raw === 'string' ? raw : undefined;
}

export function buildItemValueSchema(item: QuestionnaireItem): z.ZodType<string> {
  const validation = effectiveValidation(item);
  const customMessage = validation?.message;
  const inputType = item.input?.inputType ?? 'text';

  let schema: z.ZodType<string> = z.string().trim().min(1, customMessage ?? 'Answer required.');

  if (inputType === 'number') {
    schema = schema.refine((value) => !Number.isNaN(Number(value)), {
      message: customMessage ?? 'Enter a valid number.',
    });
    if (validation?.min !== undefined) {
      schema = schema.refine((value) => Number(value) >= validation.min!, {
        message: customMessage ?? `Must be at least ${validation.min}.`,
      });
    }
    if (validation?.max !== undefined) {
      schema = schema.refine((value) => Number(value) <= validation.max!, {
        message: customMessage ?? `Must be at most ${validation.max}.`,
      });
    }
    return schema;
  }

  if (inputType === 'date') {
    schema = schema.refine((value) => ISO_DATE.test(value), {
      message: customMessage ?? 'Use YYYY-MM-DD format.',
    });
    const minDate = resolveDateBound(validation?.minDate);
    const maxDate = resolveDateBound(validation?.maxDate);
    if (minDate) {
      schema = schema.refine((value) => value >= minDate, {
        message: customMessage ?? `Date must be on or after ${minDate}.`,
      });
    }
    if (maxDate) {
      schema = schema.refine((value) => value <= maxDate, {
        message: customMessage ?? `Date must be on or before ${maxDate}.`,
      });
    }
    return schema;
  }

  if (validation?.minLength !== undefined) {
    let stringSchema = schema as z.ZodString;
    stringSchema = stringSchema.min(validation.minLength, {
      message: customMessage ?? `Must be at least ${validation.minLength} characters.`,
    });
    schema = stringSchema;
  }
  if (validation?.maxLength !== undefined) {
    let stringSchema = schema as z.ZodString;
    stringSchema = stringSchema.max(validation.maxLength, {
      message: customMessage ?? `Must be at most ${validation.maxLength} characters.`,
    });
    schema = stringSchema;
  }
  if (validation?.pattern) {
    try {
      const regex = new RegExp(validation.pattern);
      schema = schema.refine((value) => regex.test(value), {
        message: customMessage ?? 'Invalid format.',
      });
    } catch {
      // ignore invalid regex from agent
    }
  }

  return schema;
}

export function validateItemValue(
  item: QuestionnaireItem,
  value: string | string[] | undefined,
): { ok: true } | { ok: false; error: string } {
  if (item.choices?.length) {
    if (item.multiple) {
      if (!Array.isArray(value) || value.length === 0) {
        return { ok: false, error: 'Choose at least one option.' };
      }
      const allowed = new Set(item.choices.map((choice) => choice.value));
      if (!value.every((entry) => allowed.has(entry))) {
        return { ok: false, error: 'Invalid selection.' };
      }
      return { ok: true };
    }
    if (typeof value !== 'string' || !value) {
      return { ok: false, error: 'Choose an answer to continue.' };
    }
    if (!item.choices.some((choice) => choice.value === value)) {
      return { ok: false, error: 'Invalid selection.' };
    }
    return { ok: true };
  }

  if (!item.input) return { ok: true };
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, error: item.validation?.message ?? 'Answer required.' };
  }

  const result = buildItemValueSchema(item).safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: issue?.message ?? 'Invalid value.' };
  }
  return { ok: true };
}

export function seedAnswersFromDefaults(
  items: QuestionnaireItem[],
  existing: QuestionnaireAnswers = {},
): QuestionnaireAnswers {
  const seeded = { ...existing };
  for (const item of items) {
    if (item.default === undefined) continue;
    const current = seeded[item.name];
    if (item.multiple) {
      if (Array.isArray(current) && current.length > 0) continue;
      if (Array.isArray(item.default)) seeded[item.name] = [...item.default];
    } else if (typeof item.default === 'string') {
      if (typeof current === 'string' && current.trim()) continue;
      seeded[item.name] = item.default;
    }
  }
  return seeded;
}

export type QuestionnaireInputAttrs = {
  min?: string | number;
  max?: string | number;
  minlength?: number;
  maxlength?: number;
  pattern?: string;
};

export function inputHtmlAttrs(item: QuestionnaireItem): QuestionnaireInputAttrs {
  const validation = effectiveValidation(item);
  const inputType = item.input?.inputType ?? 'text';
  const attrs: QuestionnaireInputAttrs = {};

  if (inputType === 'number') {
    if (validation?.min !== undefined) attrs.min = validation.min;
    if (validation?.max !== undefined) attrs.max = validation.max;
    return attrs;
  }

  if (inputType === 'date') {
    const minDate = resolveDateBound(validation?.minDate);
    const maxDate = resolveDateBound(validation?.maxDate);
    if (minDate) attrs.min = minDate;
    if (maxDate) attrs.max = maxDate;
    return attrs;
  }

  if (validation?.minLength !== undefined) attrs.minlength = validation.minLength;
  if (validation?.maxLength !== undefined) attrs.maxlength = validation.maxLength;
  if (validation?.pattern) attrs.pattern = validation.pattern;
  return attrs;
}

export function parseAskUserArgs(args: unknown):
  | { ok: true; items: QuestionnaireItem[] }
  | { ok: false; error: string } {
  const record = args as { items?: unknown };
  if (!Array.isArray(record?.items) || record.items.length === 0) {
    return { ok: false, error: 'ask_user requires a non-empty "items" array.' };
  }

  const items: QuestionnaireItem[] = [];
  for (const raw of record.items) {
    const parsed = parseQuestionnaireItem(raw);
    if (!parsed.ok) return parsed;
    items.push(parsed.item);
  }

  return { ok: true, items };
}

function parseQuestionnaireItem(raw: unknown):
  | { ok: true; item: QuestionnaireItem }
  | { ok: false; error: string } {
  const item = raw as Partial<QuestionnaireItem>;
  if (typeof item?.name !== 'string' || !item.name.trim()) {
    return { ok: false, error: 'Each questionnaire item needs a non-empty "name".' };
  }
  if (typeof item?.prompt !== 'string' || !item.prompt.trim()) {
    return { ok: false, error: `Item "${item.name}" needs a "prompt".` };
  }

  const hasChoices = Array.isArray(item.choices) && item.choices.length > 0;
  const hasInput = Boolean(item.input?.label);
  if (!hasChoices && !hasInput) {
    return {
      ok: false,
      error: `Item "${item.name}" needs at least one choice or an input field.`,
    };
  }

  const multiple = item.multiple === true;
  const defaultValue = parseDefault(item.default, multiple);
  const validation = parseValidation(item.validation);
  const when = parseWhen(item.when);

  const choices: QuestionnaireChoice[] | undefined = hasChoices ? [] : undefined;

  if (hasChoices) {
    for (const [index, choice] of item.choices!.entries()) {
      if (typeof choice?.value !== 'string' || typeof choice?.label !== 'string') {
        return {
          ok: false,
          error: `Item "${item.name}" choice ${index + 1} needs value and label.`,
        };
      }
      choices!.push({
        value: choice.value,
        label: choice.label,
        description: typeof choice.description === 'string' ? choice.description : undefined,
        shortcut: typeof choice.shortcut === 'string' ? choice.shortcut : undefined,
      });
    }
  }

  return {
    ok: true,
    item: {
      name: item.name.trim(),
      prompt: item.prompt.trim(),
      description: typeof item.description === 'string' ? item.description : undefined,
      required: item.required !== false,
      multiple,
      default: defaultValue,
      validation,
      when,
      choices,
      input: hasInput
        ? {
            label: item.input!.label,
            placeholder: item.input!.placeholder,
            inputType:
              item.input!.inputType === 'date' || item.input!.inputType === 'number'
                ? item.input!.inputType
                : 'text',
          }
        : undefined,
    },
  };
}

export function isItemAnswered(item: QuestionnaireItem, answers: QuestionnaireAnswers): boolean {
  const value = answers[item.name];
  if (item.multiple) {
    return Array.isArray(value) && value.length > 0;
  }
  if (typeof value === 'string' && value.trim()) return true;
  return false;
}

function matchesWhenValue(actual: string | string[] | undefined, expected: string | string[]): boolean {
  if (Array.isArray(expected)) {
    if (Array.isArray(actual)) return actual.some((entry) => expected.includes(entry));
    return typeof actual === 'string' && expected.includes(actual);
  }
  if (Array.isArray(actual)) return actual.includes(expected);
  return actual === expected;
}

export function isQuestionVisible(
  item: QuestionnaireItem,
  answers: QuestionnaireAnswers,
): boolean {
  if (item.when) {
    for (const [key, expected] of Object.entries(item.when)) {
      if (!matchesWhenValue(answers[key], expected)) return false;
    }
    return true;
  }

  // Legacy travel-demo fallback when agent omits `when`.
  if (item.name === 'inboundDate' || item.name === 'returnDate') {
    const tripType = answers.tripType;
    if (typeof tripType === 'string' && tripType === 'one-way') return false;
  }
  return true;
}

export function getVisibleItems(
  items: QuestionnaireItem[],
  answers: QuestionnaireAnswers,
): QuestionnaireItem[] {
  return items.filter((item) => isQuestionVisible(item, answers));
}

export function filterAnswersForSubmit(
  items: QuestionnaireItem[],
  answers: QuestionnaireAnswers,
): QuestionnaireAnswers {
  const visible = new Set(getVisibleItems(items, answers).map((item) => item.name));
  return Object.fromEntries(Object.entries(answers).filter(([name]) => visible.has(name)));
}

export function validateQuestionnaire(
  items: QuestionnaireItem[],
  answers: QuestionnaireAnswers,
): { ok: true } | { ok: false; error: string; itemName?: string } {
  for (const item of getVisibleItems(items, answers)) {
    if (!item.required) continue;
    if (!isItemAnswered(item, answers)) {
      return { ok: false, error: `Answer required: ${item.prompt}`, itemName: item.name };
    }
    const valueCheck = validateItemValue(item, answers[item.name]);
    if (!valueCheck.ok) {
      return { ok: false, error: valueCheck.error, itemName: item.name };
    }
  }
  return { ok: true };
}

export function formatAnswersSummary(answers: QuestionnaireAnswers): string {
  const entries = Object.entries(answers).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value?.trim());
  });
  if (entries.length === 0) return 'Skipped';
  return entries
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
    .join(' · ');
}
