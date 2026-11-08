import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  createChallenge,
  verifySolution,
  issueToken,
  verifyToken,
  normalizeSite,
  hostnameAllowed,
  checkSignals,
  generateKeys,
} from '../src/server/core.js';
import { MemoryStore } from '../src/server/store.js';

const site = normalizeSite({ ...generateKeys(), level: 'medium', maxNumber: 2000 });
const humanSignals = { it: true, el: 1200, pm: 12, kb: false, tc: false, wd: false };

function solve(ch) {
  for (let n = 0; n <= ch.maxNumber; n++) {
    if (crypto.createHash('sha256').update(ch.salt + n).digest('hex') === ch.challenge) return n;
  }
  throw new Error('sem solução');
}

const solutionFor = (ch, signals = humanSignals) => ({ ...ch, number: solve(ch), signals });

test('fluxo completo: desafio -> solução -> token -> verificação', async () => {
  const store = new MemoryStore();
  const ch = createChallenge(site);
  assert.equal((await verifySolution(site, solutionFor(ch), { store })).success, true);
  const { token } = issueToken(site, { hostname: 'exemplo.com' });
  const result = await verifyToken(site, token, { store });
  assert.equal(result.success, true);
  assert.equal(result.hostname, 'exemplo.com');
  store.close();
});

test('rejeita assinatura adulterada', async () => {
  const ch = createChallenge(site);
  const sol = solutionFor(ch);
  assert.equal((await verifySolution(site, { ...sol, maxNumber: 1 })).error, 'invalid-signature');
  assert.equal((await verifySolution(site, { ...sol, signature: 'x' })).error, 'invalid-signature');
});

test('rejeita solução errada', async () => {
  const ch = createChallenge(site);
  const n = solve(ch);
  const res = await verifySolution(site, { ...ch, number: n === 0 ? 1 : n - 1, signals: humanSignals });
  assert.equal(res.error, 'invalid-solution');
});

test('rejeita desafio expirado', async () => {
  const ch = createChallenge(site, { now: Date.now() - 10 * 60_000 });
  assert.equal((await verifySolution(site, solutionFor(ch))).error, 'challenge-expired');
});

test('desafio e token são de uso único', async () => {
  const store = new MemoryStore();
  const sol = solutionFor(createChallenge(site));
  assert.equal((await verifySolution(site, sol, { store })).success, true);
  assert.equal((await verifySolution(site, sol, { store })).error, 'challenge-reused');
  const { token } = issueToken(site);
  assert.equal((await verifyToken(site, token, { store })).success, true);
  assert.equal((await verifyToken(site, token, { store })).error, 'token-reused');
  store.close();
});

test('token expirado, adulterado ou de outro site é rejeitado', async () => {
  const { token } = issueToken(site, { now: Date.now() - 3_600_000 });
  assert.equal((await verifyToken(site, token)).error, 'token-expired');
  const { token: ok } = issueToken(site);
  assert.equal((await verifyToken(site, ok.slice(0, -2) + 'aa')).error, 'invalid-token');
  const other = normalizeSite(generateKeys());
  assert.equal((await verifyToken(other, ok)).error, 'invalid-token');
  assert.equal((await verifyToken(site, 'lixo')).error, 'invalid-token');
});

test('sinais de interação por nível', () => {
  assert.equal(checkSignals(site, { ...humanSignals, wd: true }).error, 'automation-detected');
  assert.equal(checkSignals(site, { ...humanSignals, it: false }).error, 'untrusted-event');
  assert.equal(checkSignals(site, { ...humanSignals, el: 10 }).error, 'too-fast');
  assert.equal(checkSignals(site, { ...humanSignals, pm: 0 }).error, 'no-interaction');
  assert.equal(checkSignals(site, { ...humanSignals, pm: 0, kb: true }).success, true);
  assert.equal(checkSignals(site, { ...humanSignals, pm: 0, tc: true }).success, true);
  const low = normalizeSite({ ...generateKeys(), level: 'low' });
  assert.equal(checkSignals(low, {}).success, true);
  assert.equal(checkSignals(low, { wd: true }).error, 'automation-detected');
});

test('hostnames permitidos e curingas', () => {
  const s = normalizeSite({ ...generateKeys(), hostnames: 'exemplo.com, *.meusite.com.br' });
  assert.equal(hostnameAllowed(s, 'exemplo.com'), true);
  assert.equal(hostnameAllowed(s, 'loja.meusite.com.br'), true);
  assert.equal(hostnameAllowed(s, 'meusite.com.br.evil.com'), false);
  assert.equal(hostnameAllowed(s, 'outro.com'), false);
  assert.equal(hostnameAllowed(s, ''), false);
  assert.equal(hostnameAllowed(normalizeSite(generateKeys()), 'qualquer.com'), true);
});

test('normalizeSite valida configuração', () => {
  assert.throws(() => normalizeSite({ siteKey: 'a', secret: 'curto' }));
  assert.throws(() => normalizeSite({ secret: 'x'.repeat(32) }));
  assert.throws(() => normalizeSite({ siteKey: 'a', secret: 'x'.repeat(32), level: 'ultra' }));
});
