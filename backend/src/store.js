'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

/**
 * A deliberately simple JSON-file store (the brief says to master endpoints
 * before scaling into complex databases).
 *
 * Resilience features:
 *  - Writes go to a temp file and are renamed into place (atomic), so a crash
 *    mid-write cannot leave a half-written data file.
 *  - Writes are queued one at a time, so concurrent requests cannot interleave.
 *  - A corrupt data file is backed up and the API starts clean instead of
 *    crashing on every request.
 */
class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.items = null;           // lazy-loaded cache
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.items) return;
    try {
      const text = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Data file must contain a JSON array.');
      this.items = parsed;
    } catch (err) {
      if (err.code === 'ENOENT') {
        this.items = [];
      } else {
        const backup = `${this.filePath}.corrupt-${Date.now()}`;
        console.error(`[store] Could not read ${this.filePath} (${err.message}). Backing up to ${backup}.`);
        await fs.rename(this.filePath, backup).catch(() => {});
        this.items = [];
      }
    }
  }

  persist() {
    const snapshot = JSON.stringify(this.items, null, 2);
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    this.writeQueue = this.writeQueue
      .catch(() => {}) // a previous failed write must not block later ones
      .then(async () => {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        await fs.writeFile(tmp, snapshot, 'utf8');
        await fs.rename(tmp, this.filePath);
      });
    return this.writeQueue;
  }

  /** Persist the new state; if the disk write fails, roll memory back so it never drifts from the file. */
  async commit(previousItems) {
    try {
      await this.persist();
    } catch (err) {
      this.items = previousItems;
      throw err;
    }
  }

  async list() {
    await this.load();
    // Newest first
    return [...this.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id) {
    await this.load();
    return this.items.find((item) => item.id === id) || null;
  }

  async create(data) {
    await this.load();
    const now = new Date().toISOString();
    const item = { id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now };
    const before = this.items;
    this.items = [...before, item];
    await this.commit(before);
    return item;
  }

  async replace(id, data) {
    await this.load();
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const existing = this.items[index];
    const updated = {
      id: existing.id,
      ...data,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const before = this.items;
    this.items = before.map((it, i) => (i === index ? updated : it));
    await this.commit(before);
    return updated;
  }

  async remove(id) {
    await this.load();
    const index = this.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    const before = this.items;
    this.items = before.filter((_, i) => i !== index);
    await this.commit(before);
    return true;
  }
}

module.exports = { JsonStore };
