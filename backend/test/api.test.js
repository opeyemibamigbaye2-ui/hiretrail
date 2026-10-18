'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { JsonStore } = require('../src/store');

const valid = {
  company: 'Arcane Group',
  jobTitle: 'Backend Developer',
  stage: 'to-contact',
  contactPerson: 'Jake Paul',
  contactEmail: 'jake@arcane.com',
  dateApplied: '2026-10-07',
  interviewDate: '2026-10-17',
  notes: 'Backend complexities',
};

let server, base, dataFile;

function startServer(app) {
  return new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
}

const call = (method, url, body, headers = {}) =>
  fetch(base + url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

before(async () => {
  dataFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hiretrail-')), 'applications.json');
  server = await startServer(createApp({ store: new JsonStore(dataFile), rateLimitOptions: { windowMs: 60_000, max: 10_000 } }));
  base = `http://localhost:${server.address().port}`;
});

after(() => server.close());

describe('health', () => {
  test('GET /api/health -> 200', async () => {
    const res = await call('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
  });
});

describe('POST /api/applications', () => {
  test('creates a resource -> 201 + Location + body', async () => {
    const res = await call('POST', '/api/applications', valid);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.id, /^[0-9a-f-]{36}$/);
    assert.equal(res.headers.get('location'), `/api/applications/${body.id}`);
    assert.equal(body.company, 'Arcane Group');
    assert.ok(body.createdAt && body.updatedAt);
  });

  test('trims whitespace in text fields', async () => {
    const res = await call('POST', '/api/applications', { ...valid, company: '  Zoom  ' });
    assert.equal((await res.json()).company, 'Zoom');
  });

  test('optional fields may be omitted', async () => {
    const res = await call('POST', '/api/applications', { company: 'Minimal Co', jobTitle: 'Dev', stage: 'closed' });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).contactEmail, '');
  });
});

describe('validation (400 Bad Request)', () => {
  const bad = async (payload) => {
    const res = await call('POST', '/api/applications', payload);
    assert.equal(res.status, 400);
    return (await res.json()).error;
  };
  const fieldsOf = (error) => error.details.map((d) => d.field);

  test('empty object reports every required field', async () => {
    const err = await bad({});
    assert.deepEqual(fieldsOf(err).sort(), ['company', 'jobTitle', 'stage']);
  });

  test('blank (whitespace-only) required field', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, company: '   ' })).includes('company'));
  });

  test('wrong type', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, company: 123 })).includes('company'));
  });

  test('too long', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, company: 'x'.repeat(101) })).includes('company'));
  });

  test('invalid email', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, contactEmail: 'jane@' })).includes('contactEmail'));
  });

  test('invalid stage', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, stage: 'hired' })).includes('stage'));
  });

  test('malformed date', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, dateApplied: '07/10/2026' })).includes('dateApplied'));
  });

  test('impossible calendar date (Feb 30)', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, dateApplied: '2026-02-30' })).includes('dateApplied'));
  });

  test('semantic: interview before application date', async () => {
    const err = await bad({ ...valid, dateApplied: '2026-10-20', interviewDate: '2026-10-10' });
    assert.ok(fieldsOf(err).includes('interviewDate'));
  });

  test('unknown field is rejected', async () => {
    assert.ok(fieldsOf(await bad({ ...valid, isAdmin: true })).includes('isAdmin'));
  });

  test('body that is not an object (array)', async () => {
    const err = await bad([1, 2, 3]);
    assert.equal(err.details[0].field, 'body');
  });

  test('malformed JSON -> 400', async () => {
    const res = await call('POST', '/api/applications', '{"company": ');
    assert.equal(res.status, 400);
    assert.match((await res.json()).error.message, /not valid JSON/i);
  });

  test('error responses use the standard shape', async () => {
    const err = await bad({});
    assert.equal(err.status, 400);
    assert.equal(typeof err.message, 'string');
    assert.ok(Array.isArray(err.details));
  });

  test('invalid ?stage= query -> 400', async () => {
    const res = await call('GET', '/api/applications?stage=nope');
    assert.equal(res.status, 400);
  });
});

describe('other client errors', () => {
  test('wrong Content-Type -> 415', async () => {
    const res = await fetch(base + '/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(valid),
    });
    assert.equal(res.status, 415);
  });

  test('payload too large -> 413', async () => {
    const res = await call('POST', '/api/applications', { ...valid, notes: 'x'.repeat(20_000) });
    assert.equal(res.status, 413);
  });

  test('unknown route -> 404 JSON', async () => {
    const res = await call('GET', '/api/getApplications');
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.status, 404);
  });

  test('unsupported method -> 405 + Allow header', async () => {
    const res = await call('PATCH', '/api/applications', { a: 1 });
    assert.equal(res.status, 405);
    assert.match(res.headers.get('allow'), /GET/);
  });
});

describe('GET /api/applications', () => {
  test('lists, filters by stage, and searches by company', async () => {
    const all = await (await call('GET', '/api/applications')).json();
    assert.ok(all.length >= 3);

    const closed = await (await call('GET', '/api/applications?stage=closed')).json();
    assert.ok(closed.length >= 1 && closed.every((a) => a.stage === 'closed'));

    const search = await (await call('GET', '/api/applications?search=ARCANE')).json();
    assert.ok(search.length >= 1 && search.every((a) => /arcane/i.test(a.company)));

    const none = await (await call('GET', '/api/applications?search=zzzzzz')).json();
    assert.deepEqual(none, []);
  });
});

describe('item routes', () => {
  let id;
  before(async () => {
    id = (await (await call('POST', '/api/applications', { ...valid, company: 'Item Test' })).json()).id;
  });

  test('GET one -> 200', async () => {
    const res = await call('GET', `/api/applications/${id}`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).company, 'Item Test');
  });

  test('GET unknown id -> 404', async () => {
    assert.equal((await call('GET', '/api/applications/does-not-exist')).status, 404);
  });

  test('PUT updates and keeps id/createdAt -> 200', async () => {
    const before = await (await call('GET', `/api/applications/${id}`)).json();
    const res = await call('PUT', `/api/applications/${id}`, { ...valid, company: 'Item Test', stage: 'contacted' });
    assert.equal(res.status, 200);
    const after = await res.json();
    assert.equal(after.stage, 'contacted');
    assert.equal(after.id, before.id);
    assert.equal(after.createdAt, before.createdAt);
  });

  test('PUT with invalid data -> 400 and nothing changes', async () => {
    const res = await call('PUT', `/api/applications/${id}`, { ...valid, stage: 'bogus' });
    assert.equal(res.status, 400);
    assert.equal((await (await call('GET', `/api/applications/${id}`)).json()).stage, 'contacted');
  });

  test('PUT unknown id -> 404', async () => {
    assert.equal((await call('PUT', '/api/applications/nope', valid)).status, 404);
  });

  test('DELETE -> 204, then 404', async () => {
    const res = await call('DELETE', `/api/applications/${id}`);
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');
    assert.equal((await call('GET', `/api/applications/${id}`)).status, 404);
    assert.equal((await call('DELETE', `/api/applications/${id}`)).status, 404);
  });
});

describe('persistence', () => {
  test('data survives a restart (new store reading the same file)', async () => {
    const created = await (await call('POST', '/api/applications', { ...valid, company: 'Persist Co' })).json();
    const fresh = new JsonStore(dataFile);
    const found = await fresh.get(created.id);
    assert.equal(found.company, 'Persist Co');
  });

  test('a corrupt data file is backed up and the API starts clean', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiretrail-corrupt-'));
    const file = path.join(dir, 'applications.json');
    fs.writeFileSync(file, '{ this is not json');
    const origError = console.error;
    console.error = () => {}; // silence the expected log line
    try {
      const store = new JsonStore(file);
      assert.deepEqual(await store.list(), []);
    } finally {
      console.error = origError;
    }
    assert.ok(fs.readdirSync(dir).some((f) => f.includes('.corrupt-')));
  });
});

describe('resilience', () => {
  test('rate limit -> 429 with Retry-After', async () => {
    const s = await startServer(
      createApp({ store: new JsonStore(dataFile), rateLimitOptions: { windowMs: 60_000, max: 3 } })
    );
    const url = `http://localhost:${s.address().port}/api/health`;
    const statuses = [];
    let last;
    for (let i = 0; i < 5; i++) {
      last = await fetch(url);
      statuses.push(last.status);
    }
    s.close();
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
    assert.ok(Number(last.headers.get('retry-after')) > 0);
  });

  test('unexpected failure -> 500 with a generic message (no leaked internals)', async () => {
    const broken = { list: async () => { throw new Error('secret db password in stack'); } };
    const s = await startServer(createApp({ store: broken }));
    const origError = console.error;
    console.error = () => {};
    try {
      const res = await fetch(`http://localhost:${s.address().port}/api/applications`);
      const body = await res.json();
      assert.equal(res.status, 500);
      assert.equal(body.error.message, 'Internal server error.');
      assert.ok(!JSON.stringify(body).includes('secret'));
    } finally {
      console.error = origError;
      s.close();
    }
  });

  test('a failed disk write rolls back memory (no drift from the file)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hiretrail-fail-'));
    const store = new JsonStore(path.join(dir, 'applications.json'));
    await store.load();
    store.persist = () => Promise.reject(new Error('disk full'));
    await assert.rejects(store.create({ ...valid }), /disk full/);
    assert.deepEqual(await store.list(), []);
  });

  test('CORS headers and preflight', async () => {
    const res = await fetch(base + '/api/applications', { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });
});
