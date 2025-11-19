export interface ProviderFormState {
  sort: string;
  order: string[];
  only: string[];
  ignore: string[];
  quantizations: string[];
  allowFallbacks: boolean;
  requireParameters: boolean;
  dataCollection: 'allow' | 'deny';
  zdr: boolean;
  enforceDistillableText: boolean;
  maxPrompt: string;
  maxCompletion: string;
  maxRequest: string;
  maxImage: string;
}

export type ProviderSelectionField = 'order' | 'only' | 'ignore';
