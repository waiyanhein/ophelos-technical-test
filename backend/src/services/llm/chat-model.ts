import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { loadConfig } from '../../config/env';

// Centralised factory so swapping providers is a one-line config change.
// Adding a new provider means: install its `@langchain/<provider>` package,
// extend `LlmProvider` in env.ts, and add a case below.
export const createChatModel = (): BaseChatModel => {
  const { llm } = loadConfig();

  switch (llm.provider) {
    case 'openai':
      return new ChatOpenAI({
        apiKey: llm.apiKey,
        model: llm.model,
        temperature: llm.temperature,
      });
    default: {
      const exhaustive: never = llm.provider;
      throw new Error(`Unsupported LLM provider: ${String(exhaustive)}`);
    }
  }
};
