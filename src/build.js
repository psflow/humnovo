import { readFileSync } from 'node:fs';

const WIDGET_SRC = new URL('./widget/humnovo.js', import.meta.url);
const PKG = new URL('../package.json', import.meta.url);

/**
 * Gera a versão <script> do widget: remove os `export` do módulo ESM e o
 * envolve em uma IIFE que expõe `window.Humnovo` e auto-renderiza `.humnovo`.
 */
export function buildWidget() {
  const { version } = JSON.parse(readFileSync(PKG, 'utf8'));
  const source = readFileSync(WIDGET_SRC, 'utf8')
    .replace(/^export default .*$/m, '')
    .replace(/^export\s+/gm, '');
  return (
    `/*! Humnovo v${version} | MIT License | https://github.com/psflow/humnovo */\n` +
    `(function () {\n'use strict';\n` +
    `if (typeof window === 'undefined' || window.Humnovo) return;\n` +
    `var currentScript = document.currentScript;\n` +
    `${source}\n` +
    `Humnovo.HumnovoError = HumnovoError;\n` +
    `window.Humnovo = Humnovo;\n` +
    `autoInit(currentScript);\n` +
    `})();\n`
  );
}
