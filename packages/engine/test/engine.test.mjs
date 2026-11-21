import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_LYRICS, DEMO_TRACK, createLyricState, getDemoState, parseLrc, splitPhrases, wordState } from '../dist/index.js';

test('demo timeline produces the same active line/word from a shared playhead', () => {
  const state = getDemoState(2_700);
  assert.equal(state.activeLineIndex, 0);
  assert.equal(state.activeWordIndex, 5);
  assert.equal(state.track.title, 'Paper Lanterns');
  assert.equal(state.playState, 'playing');
});

test('nudge is applied once to the playhead', () => {
  const state = createLyricState(DEMO_TRACK, DEMO_LYRICS, 2_000, 'paused', 500);
  assert.equal(state.positionMs, 2_500);
  assert.equal(state.playState, 'paused');
});

test('word states are derived from the timeline, including ghost and hold', () => {
  const previous = { text: 'a', startMs: 0, endMs: 200 };
  const word = { text: 'word', startMs: 300, endMs: 450 };
  assert.equal(wordState(199, word, previous), 'hidden');
  assert.equal(wordState(220, word, previous), 'ghost');
  assert.equal(wordState(320, word, previous), 'active');
  assert.equal(wordState(470, word, previous), 'active');
  assert.equal(wordState(500, word, previous), 'settled');
});

test('LRC parser supports BOM, offset, CRLF, repeated stamps and stable ordering', () => {
  const lines = parseLrc('\uFEFF[ar:Artist]\r\n[offset:100]\r\n[00:02.50][00:04.000]hello there\r\n[00:03.25]next');
  assert.deepEqual(lines.map((line) => line.startMs), [2_600, 3_350, 4_100]);
  assert.equal(lines[0].text, 'hello there');
  assert.equal(lines[0].words.length, 2);
  assert.ok(lines.every((line) => line.endMs > line.startMs));
});

test('phrase splitter respects bounds without leaving a one-word orphan', () => {
  const phrases = splitPhrases('Every clock in the city slows down tonight', 24, 4);
  assert.ok(phrases.every((phrase) => phrase.length <= 30));
  assert.ok(phrases.every((phrase) => phrase.split(/\s+/).length > 1));
});
