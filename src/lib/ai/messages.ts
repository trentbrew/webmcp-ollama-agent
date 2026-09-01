import type { ChatStatus, UIMessage } from './protocol';

export type { ChatMessageMetadata } from './protocol';

export function getMessageTimestamp(message: UIMessage): number | null {
  const createdAt = message.metadata?.createdAt;
  return typeof createdAt === 'number' ? createdAt : null;
}

export function getMessageCompletionTime(message: UIMessage): number | null {
  const completedAt = message.metadata?.completedAt;
  if (typeof completedAt === 'number') return completedAt;
  return getMessageTimestamp(message);
}

export function getLastAssistantMessage(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') return messages[i];
  }
  return null;
}

export function isActiveAssistantMessage(
  message: UIMessage,
  messages: UIMessage[],
  status: ChatStatus,
): boolean {
  if (status !== 'streaming' && status !== 'submitted') return false;
  if (message.role !== 'assistant') return false;
  const lastAssistant = getLastAssistantMessage(messages);
  return lastAssistant?.id === message.id;
}

export function getActiveAssistantStatusLabel(
  message: UIMessage,
  messages: UIMessage[],
  status: ChatStatus,
): 'Thinking…' | 'Working…' | null {
  if (!isActiveAssistantMessage(message, messages, status)) return null;

  const text = getMessageText(message).trim();
  return text ? 'Working…' : 'Thinking…';
}

export function formatMessageTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function createMessageMetadata(
  metadata: UIMessage['metadata'] = {},
): UIMessage['metadata'] {
  return {
    ...metadata,
    createdAt: metadata.createdAt ?? Date.now(),
  };
}

export function backfillMessageTimestamps(messages: UIMessage[]): UIMessage[] {
  const base = Date.now() - messages.length * 60_000;
  return messages.map((message, index) => {
    const metadata = message.metadata ?? {};
    if (typeof metadata.createdAt === 'number') return message;
    return {
      ...message,
      metadata: { ...metadata, createdAt: base + index * 60_000 },
    };
  });
}

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function getMessageReasoning(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('');
}

export function getReasoningDurationSeconds(message: UIMessage): number | null {
  const start = message.metadata?.reasoningStartedAt;
  if (typeof start !== 'number') return null;
  const end = message.metadata?.reasoningEndedAt;
  const finish = typeof end === 'number' ? end : Date.now();
  return Math.max(0, (finish - start) / 1000);
}

export function formatThoughtDuration(seconds: number): string {
  const rounded = Math.max(1, Math.round(seconds));
  return rounded === 1 ? 'Thought for 1 second' : `Thought for ${rounded} seconds`;
}

export function getChatStatusLabel(
  status: ChatStatus,
  messages: UIMessage[],
  busy: boolean,
): string | null {
  if (!busy) return null;

  const last = messages.at(-1);
  if (status === 'submitted' || last?.role === 'user') return 'Thinking…';

  if (status === 'streaming' && last?.role === 'assistant') {
    const text = getMessageText(last).trim();
    const reasoning = getMessageReasoning(last).trim();
    if (reasoning && !text) return null;
    return text ? 'Working…' : 'Thinking…';
  }

  if (status === 'awaiting-input') return 'Waiting for your answer…';

  return 'Working…';
}

export function getMessageFiles(message: UIMessage) {
  return message.parts.filter((part) => part.type === 'file');
}

export function isMessageStreaming(
  message: UIMessage,
  status: ChatStatus,
  messages: UIMessage[],
): boolean {
  return isActiveAssistantMessage(message, messages, status);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isTextUIPart(
  part: UIMessage['parts'][number],
): part is Extract<UIMessage['parts'][number], { type: 'text' }> {
  return part.type === 'text';
}

export function isFileUIPart(
  part: UIMessage['parts'][number],
): part is Extract<UIMessage['parts'][number], { type: 'file' }> {
  return part.type === 'file';
}
