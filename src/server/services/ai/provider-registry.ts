
import { geminiProvider } from './providers/gemini.provider';
import type { AIProvider } from '@/types/ai.types';

const providers: Record<string, AIProvider> = {
  gemini: geminiProvider,
};

export const getProvider = (name: string = 'gemini'): AIProvider => {
  const provider = providers[name];
  if (!provider) {
    throw new Error(`Provider ${name} not registered`);
  }
  return provider;
};

export const listProviders = (): string[] => Object.keys(providers);