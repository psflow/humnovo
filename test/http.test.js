import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHumnovo, generateKeys, verify } from '../src/server/index.js';
import { powSolver } from '../src/widget/humnovo.js';

const keys = generateKeys();
const restricted = generateKeys();
const humnovo = createHumnovo({
  sites: [
    { ...keys, maxNumber: 3000 },
    { ...restricted, maxNumber: 3000, hostnames: ['exemplo.com'] },
  ],
});
const server = http.createServer(humnovo);
let base;

before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  humnovo.close();
});

const human = { it: true, el: 900, pm: 8, kb: false, tc: false, wd: false };

async function getToken(siteKey, headers = {}) {
  const ch = await (await fetch(`${base}/v1/challenge?sitekey=${siteKey}`, { headers })).json();
  const sol = powSolver().solve(ch);
  const res = await fetch(`${base}/v1/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', ...headers },
    body: JSON.stringify({ siteKey, ...ch, number: sol.number, signals: human }),
  });
  return { status: res.status, body: await res.json() };
}

test('fluxo HTTP completo e uso único do token', async () => {
  const { status, body } = await getToken(keys.siteKey, { Origin: 'https://meusite.com' });
  assert.equal(status, 200);
  assert.equal(body.success, true);
  const r1 = await verify({ apiUrl: base, secret: keys.secret, token: body.token });
  assert.equal(r1.success, true);
  assert.equal(r1.hostname, 'meusite.com');
  const r2 = await verify({ apiUrl: base, secret: keys.secret, token: body.token });
  assert.equal(r2.error, 'token-reused');
});

test('secret incorreto é rejeitado', async () => {
  const { body } = await getToken(keys.siteKey);
  const r = await verify({ apiUrl: base, secret: restricted.secret, token: body.token });
  assert.equal(r.error, 'invalid-secret');
});

test('restrição de hostname', async () => {
  const bad = await fetch(`${base}/v1/challenge?sitekey=${restricted.siteKey}`, { headers: { Origin: 'https://evil.com' } });
  assert.equal(bad.status, 403);
  const ok = await getToken(restricted.siteKey, { Origin: 'https://exemplo.com' });
  assert.equal(ok.body.success, true);
  const noOrigin = await getToken(restricted.siteKey);
  assert.equal(noOrigin.status, 403);
});

test('sitekey inválida, CORS e widget', async () => {
  const r = await fetch(`${base}/v1/challenge?sitekey=nao-existe`);
  assert.equal(r.status, 400);
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  const pre = await fetch(`${base}/v1/solve`, { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  const w = await fetch(`${base}/widget.js`);
  assert.match(w.headers.get('content-type'), /javascript/);
  assert.match(await w.text(), /window\.Humnovo/);
  assert.equal((await fetch(`${base}/nada`)).status, 404);
});

test('corpo inválido retorna 400', async () => {
  const r = await fetch(`${base}/v1/solve`, { method: 'POST', body: '{quebrado' });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'invalid-body');
});

test('verificação local sem HTTP', async () => {
  const { body } = await getToken(keys.siteKey);
  assert.equal((await humnovo.verify(body.token)).success, true);
});
