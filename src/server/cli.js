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
import { createHumnovo, generateKeys } from './index.js';
import { createDemo } from './demo.js';

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

const demo = createDemo({ humnovo, siteKey: demoSite.siteKey });

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
