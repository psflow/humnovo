import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { powSolver } from '../src/widget/humnovo.js';
import { buildWidget } from '../src/build.js';
import { createChallenge, normalizeSite, generateKeys } from '../src/server/core.js';

const nodeSha = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('SHA-256 em JS puro bate com node:crypto', () => {
  const { sha256 } = powSolver();
  const inputs = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'b'.repeat(119), 'x'.repeat(300)];
  for (let i = 0; i < 200; i++) inputs.push(crypto.randomBytes(12).toString('hex') + '.' + Date.now() + i);
  for (const s of inputs) assert.equal(sha256(s), nodeSha(s), `falhou para tamanho ${s.length}`);
});

test('solver resolve um desafio real do servidor', () => {
  const site = normalizeSite({ ...generateKeys(), maxNumber: 5000 });
  const ch = createChallenge(site);
  const sol = powSolver().solve(ch);
  assert.ok(sol);
  assert.equal(nodeSha(ch.salt + sol.number), ch.challenge);
});

test('solver é autocontido (serializável para Web Worker)', () => {
  const fn = vm.runInNewContext(`(${powSolver.toString()})`);
  assert.equal(fn().sha256('abc'), nodeSha('abc'));
});

test('build do widget é JavaScript válido sem exports', () => {
  const code = buildWidget();
  assert.doesNotMatch(code, /^export /m);
  assert.doesNotThrow(() => new vm.Script(code));
});
