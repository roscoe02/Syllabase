/**
 * Haiku 5.5 bills 5x for every token of a request whose prompt passes 100K tokens. Usage is scaled the same
 * way before it counts toward the daily budgets, so the budgets track real cost.
 */
const LONG_CONTEXT_TOKENS = 100_000;
const LONG_CONTEXT_MULTIPLIER = 5;

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export function billableUsage(u: TokenUsage): TokenUsage {
  const k = u.input + u.cacheRead + u.cacheWrite > LONG_CONTEXT_TOKENS ? LONG_CONTEXT_MULTIPLIER : 1;
  return { input: u.input * k, output: u.output * k, cacheRead: u.cacheRead * k, cacheWrite: u.cacheWrite * k };
}
