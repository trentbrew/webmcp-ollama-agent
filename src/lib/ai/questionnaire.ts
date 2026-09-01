export type QuestionnaireChoice = {
  value: string;
  label: string;
  description?: string;
  shortcut?: string;
};

export type QuestionnaireItem = {
  name: string;
  prompt: string;
  description?: string;
  required?: boolean;
  multiple?: boolean;
  choices?: QuestionnaireChoice[];
  input?: { label: string; placeholder?: string; inputType?: 'text' | 'number' | 'date' };
};

export type QuestionnaireAnswers = Record<string, string | string[]>;

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

  const choices: QuestionnaireChoice[] | undefined = hasChoices
    ? []
    : undefined;

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
      multiple: item.multiple === true,
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

export function isQuestionVisible(
  item: QuestionnaireItem,
  answers: QuestionnaireAnswers,
): boolean {
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
