import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomFrequency, scoreRound } from '../lib/game.ts';

test('exact pitch earns full points; one semitone earns 368', () => {
  assert.equal(scoreRound(440, 440, 1000, 999).points, 1000);
  assert.equal(scoreRound(440, 440 * 2 ** (1/12), 1000, 999).points, 368);
});
test('equal pitch distances above and below score equally', () => {
  const sharp = scoreRound(440, 440 * 2 ** (1/24), 1000, 500);
  const flat = scoreRound(440, 440 / 2 ** (1/24), 1000, 500);
  assert.equal(sharp.points, flat.points);
  assert.ok(sharp.cents! > 0 && flat.cents! < 0);
});
test('deadline is enforced even if timer callback has not run', () => {
  for (const now of [1000, 1001, 30000]) {
    assert.deepEqual(scoreRound(440, 440, 1000, now), {target:440,guess:null,cents:null,points:0});
  }
});
test('missing and invalid guesses earn zero', () => {
  for (const answer of [null, 0, -440, NaN, Infinity]) assert.equal(scoreRound(440, answer, 1000, 500).points, 0);
});
test('random tones are whole hertz within the advertised range', () => {
  assert.equal(randomFrequency(0), 100);
  assert.equal(randomFrequency(1), 1000);
  for(let i=0;i<=1000;i++) {
    const value = randomFrequency(i/1000);
    assert.ok(Number.isInteger(value) && value >= 100 && value <= 1000);
  }
});
