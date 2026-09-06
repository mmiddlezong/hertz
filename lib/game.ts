export type Result = { target: number; guess: number | null; cents: number | null; points: number };

export function randomFrequency(random = Math.random()): number {
  return Math.round(100 * Math.pow(10, Math.max(0, Math.min(1, random))));
}

export function scoreRound(target: number, answer: number | null, deadline: number, now: number): Result {
  const guess = now >= deadline || answer === null || !Number.isFinite(answer) || answer <= 0 ? null : answer;
  const cents = guess === null ? null : 1200 * Math.log2(guess / target);
  const points = cents === null ? 0 : Math.round(1000 * Math.exp(-Math.abs(cents) / 100));
  return { target, guess, cents, points };
}
