export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type ChatTextPart = {
  type: 'text';
  text: string;
};

export type ChatReasoningPart = {
  type: 'reasoning';
  text: string;
};

export type ChatFilePart = {
  type: 'file';
  url: string;
  filename?: string;
  mediaType: string;
};

export type ChatToolCallPart = {
  type: 'tool-call';
  id: string;
  toolName: string;
  args: unknown;
};

export type ChatToolResultPart = {
  type: 'tool-result';
  id: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  error?: string;
};

export type ChatQuestionnairePart = {
  type: 'questionnaire';
  id: string;
  items: import('./questionnaire').QuestionnaireItem[];
  answers?: import('./questionnaire').QuestionnaireAnswers;
  status: 'pending' | 'answered' | 'skipped';
};

export type ChatMessagePart =
  | ChatTextPart
  | ChatReasoningPart
  | ChatFilePart
  | ChatToolCallPart
  | ChatToolResultPart
  | ChatQuestionnairePart;

export type ChatMessageMetadata = {
  createdAt?: number;
  completedAt?: number;
  reasoningStartedAt?: number;
  reasoningEndedAt?: number;
};

export type UIMessage = {
  id: string;
  role: ChatRole;
  parts: ChatMessagePart[];
  metadata?: ChatMessageMetadata;
};

export type ChatStatus = 'submitted' | 'streaming' | 'awaiting-input' | 'ready' | 'error';

export type OllamaToolCall = {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
};

export type OllamaTool = {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: object;
  };
};

export type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  tool_calls?: OllamaToolCall[];
};

export type OllamaChatRequest = {
  type: 'chat';
  requestId: string;
  baseUrl: string;
  model: string;
  messages: OllamaChatMessage[];
  think?: boolean;
  tools?: OllamaTool[];
  options?: Record<string, number>;
};

export type OllamaAbortRequest = {
  type: 'abort';
  requestId: string;
};

export type OllamaPortInbound = OllamaChatRequest | OllamaAbortRequest;

export type OllamaPortOutbound =
  | { type: 'delta'; requestId: string; text: string }
  | { type: 'reasoning'; requestId: string; text: string }
  | { type: 'done'; requestId: string; toolCalls?: OllamaToolCall[]; truncated?: boolean }
  | { type: 'error'; requestId: string; error: string };

export type ListModelsResponse = {
  models: string[];
  unavailable?: boolean;
  error?: string;
};
