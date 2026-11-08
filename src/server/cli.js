#!/usr/bin/env node
/**
 * Servidor Humnovo independente.
 *
 *   npx humnovo            inicia o servidor (modo demo se não houver configuração)
 *   npx humnovo keys       gera um par de chaves
 *   npx humnovo --config humnovo.config.json
 *
 * Variáveis de ambiente: PORT, HOST, HUMNOVO_SITE_KEY, HUMNOVO_SECRET_KEY,
 * HUMNOVO_HOSTNAMES (separados por vírgula), HUMNOVO_LEVEL, HUMNOVO_DEMO=1.
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHumnovo, generateKeys, readBody } from './index.js';

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('-') ? args[0] : 'start';

if (cmd === 'help' || args.includes('--help') || args.includes('-h')) {
  console.log(`Humnovo — verificação humana open source

Uso:
  humnovo [start] [--config arquivo.json] [--port 8787]
  humnovo keys

Variáveis: PORT, HOST, HUMNOVO_SITE_KEY, HUMNOVO_SECRET_KEY, HUMNOVO_HOSTNAMES, HUMNOVO_LEVEL, HUMNOVO_DEMO`);
  process.exit(0);
}

if (cmd === 'keys') {
  const k = generateKeys();
  console.log(`HUMNOVO_SITE_KEY=${k.siteKey}\nHUMNOVO_SECRET_KEY=${k.secret}`);
  process.exit(0);
}

function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function loadConfig() {
  const path = argValue('--config') || (existsSync('humnovo.config.json') ? 'humnovo.config.json' : null);
  let config = {};
  if (path) config = JSON.parse(readFileSync(resolve(path), 'utf8'));
  const env = process.env;
  if (env.HUMNOVO_SITE_KEY && env.HUMNOVO_SECRET_KEY) {
    config.sites = [
      ...(config.sites || []),
      {
        siteKey: env.HUMNOVO_SITE_KEY,
        secret: env.HUMNOVO_SECRET_KEY,
        hostnames: env.HUMNOVO_HOSTNAMES || '',
        level: env.HUMNOVO_LEVEL || 'medium',
      },
    ];
  }
  if (env.HUMNOVO_DEMO === '1') config.demo = true;
  if (!config.sites || config.sites.length === 0) {
    config.sites = [{ ...generateKeys(), level: 'medium' }];
    config.demo = true;
    config.generated = true;
  }
  return config;
}

const config = loadConfig();
const humnovo = createHumnovo(config);
const port = Number(argValue('--port') || process.env.PORT || config.port || 8787);
const host = process.env.HOST || config.host || '0.0.0.0';
const demoSite = config.sites[0];

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif}body{max-width:520px;margin:48px auto;padding:0 16px;line-height:1.5}
input,button{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid #9ca3af;box-sizing:border-box}
input{width:100%}button{background:#2563eb;color:#fff;border:0;cursor:pointer}form{display:grid;gap:14px}
pre{background:rgba(127,127,127,.12);padding:12px;border-radius:8px;overflow:auto}code{font-size:.9em}
</style></head><body>${body}</body></html>`;
}

async function demo(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && (path === '/' || path === '/demo')) {
    const html = page(
      'Humnovo — demo',
      `<h1>Humnovo</h1><p>Clique em <strong>Sou humano</strong> e depois em <strong>Enviar</strong> para ver a validação do token no backend.</p>
<form action="/demo/submit" method="POST">
  <div class="humnovo" data-sitekey="${escapeHtml(demoSite.siteKey)}"></div>
  <button type="submit">Enviar</button>
</form>
<script src="/widget.js" async defer></script>`,
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html), true;
  }
  if (req.method === 'POST' && path === '/demo/submit') {
    const body = await readBody(req).catch(() => ({}));
    const result = await humnovo.verify(body['humnovo-token']);
    const html = page(
      'Humnovo — resultado',
      `<h1>${result.success ? '✅ Humano verificado' : '❌ Verificação falhou'}</h1>
<p>Resposta de <code>verify()</code>:</p><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre><p><a href="/">Voltar</a></p>`,
    );
    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html), true;
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  if (config.demo && (await demo(req, res))) return;
  humnovo(req, res);
});

server.listen(port, host, () => {
  console.log(`Humnovo rodando em http://localhost:${port}`);
  console.log(`  widget:  http://localhost:${port}/widget.js`);
  if (config.demo) console.log(`  demo:    http://localhost:${port}/`);
  if (config.generated) {
    console.log('\nNenhum site configurado: chaves temporárias geradas (somente para teste).');
    console.log(`  siteKey: ${demoSite.siteKey}`);
    console.log(`  secret:  ${demoSite.secret}`);
    console.log('Use `npx humnovo keys` e HUMNOVO_SITE_KEY/HUMNOVO_SECRET_KEY em produção.');
  }
});

const shutdown = () => {
  server.close(() => process.exit(0));
  humnovo.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
