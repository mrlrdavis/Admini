export type RedactionToken = {
  token: string;
  label: string;
};

export type RedactionResult = {
  redactedText: string;
  tokens: RedactionToken[];
};

const piiPatterns: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b\d{6,9}\b/g, label: 'STUDENT_ID' },
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, label: 'SSN' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: 'EMAIL' },
  { pattern: /\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, label: 'PHONE' },
  { pattern: /\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\/(19|20)\d{2}\b/g, label: 'DOB' },
  { pattern: /\b(scored?|grade[ds]?|earned?)\s+\d+\s*(\/\s*\d+|%|points?)/gi, label: 'SCORE' }
];

export function stripActiveContent(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

export function redactText(input: string): RedactionResult {
  let redactedText = stripActiveContent(input);
  const tokens: RedactionToken[] = [];
  let counter = 0;

  for (const { pattern, label } of piiPatterns) {
    redactedText = redactedText.replace(pattern, () => {
      counter += 1;
      const token = `[${label}_${counter}]`;
      tokens.push({ token, label });
      return token;
    });
  }

  return { redactedText, tokens };
}

export function prepareAiPrompt(input: { prompt: string; context?: string; role?: string }) {
  const prompt = redactText(input.prompt);
  const context = redactText(input.context ?? '');

  return {
    role: stripActiveContent(input.role ?? 'assistant'),
    prompt: prompt.redactedText,
    context: context.redactedText,
    tokenCount: prompt.tokens.length + context.tokens.length
  };
}

export function scrubSentryText(value: string): string {
  return redactText(value).redactedText;
}
