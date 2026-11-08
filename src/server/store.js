/**
 * Armazenamento de uso único em memória.
 *
 * Qualquer objeto com `consume(key, expiresAt, now) => boolean | Promise<boolean>`
 * pode substituí-lo (ex.: Redis com `SET key 1 PXAT expiresAt NX`), o que permite
 * rodar várias instâncias do servidor.
 *
 * O consumo só ocorre depois de uma prova de trabalho válida e assinada, então
 * encher a memória custa CPU proporcional ao atacante.
 */
export class MemoryStore {
  constructor({ sweepInterval = 60_000 } = {}) {
    this.entries = new Map();
    this.timer = setInterval(() => this.sweep(), sweepInterval);
    this.timer.unref?.();
  }

  /** Retorna true na primeira vez que a chave é vista (enquanto não expirar). */
  consume(key, expiresAt, now = Date.now()) {
    const current = this.entries.get(key);
    if (current !== undefined && current > now) return false;
    this.entries.set(key, expiresAt);
    return true;
  }

  sweep(now = Date.now()) {
    for (const [key, expiresAt] of this.entries) if (expiresAt <= now) this.entries.delete(key);
  }

  get size() {
    return this.entries.size;
  }

  close() {
    clearInterval(this.timer);
  }
}
