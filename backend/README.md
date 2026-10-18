# HireTrail API

The backend for **HireTrail**, the job application tracker. Built for **Project 2 (Backend API Development)** of the DecodeLabs Full Stack Development internship.

It is a small REST API (Node.js + Express) that accepts JSON, validates it, stores it, and answers with meaningful HTTP status codes. Project 1 was the skin; this is the nervous system.

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm start          # http://localhost:3000
npm test           # 35 automated tests
```

Check it is alive:

```bash
curl http://localhost:3000/api/health
```

## Endpoints

Resources are nouns, methods are verbs. Everything is JSON in and JSON out.

| Method | Path | Purpose | Success |
|--------|------|---------|---------|
| `GET` | `/api/health` | Liveness check | `200` |
| `GET` | `/api/applications` | List applications. Optional `?stage=` and `?search=` | `200` |
| `POST` | `/api/applications` | Create an application | `201` + `Location` header |
| `GET` | `/api/applications/:id` | Read one application | `200` |
| `PUT` | `/api/applications/:id` | Replace/update an application | `200` |
| `DELETE` | `/api/applications/:id` | Remove an application | `204` (no body) |

### The application object

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `company` | string | yes | 1-100 characters |
| `jobTitle` | string | yes | 1-100 characters |
| `stage` | string | yes | one of `to-contact`, `contacted`, `interview-pending`, `offer-contract`, `closed` |
| `contactPerson` | string | no | up to 100 characters |
| `contactEmail` | string | no | valid email, up to 254 characters |
| `dateApplied` | string | no | real calendar date, `YYYY-MM-DD` |
| `interviewDate` | string | no | real calendar date, `YYYY-MM-DD`, not before `dateApplied` |
| `notes` | string | no | up to 1000 characters |

The server adds `id` (UUID), `createdAt` and `updatedAt`. Whitespace around text is trimmed. Unknown fields are rejected, not silently stored.

`PUT` replaces the whole record, so send every field you want to keep. `id` and `createdAt` are never changed.

## Examples

Every example below can be pasted into a terminal while the server is running.

**Create (201 Created)**

```bash
curl -i -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Arcane Group",
    "jobTitle": "Backend Developer",
    "stage": "to-contact",
    "contactPerson": "Jake Paul",
    "contactEmail": "jake@arcane.com",
    "dateApplied": "2026-10-07",
    "interviewDate": "2026-10-17",
    "notes": "Backend complexities"
  }'
```

```
HTTP/1.1 201 Created
Location: /api/applications/9c2f750e-5e9f-4864-9249-23748ac2cb14

{"id":"9c2f750e-5e9f-4864-9249-23748ac2cb14","company":"Arcane Group", ... }
```

**List, filtered and searched (200 OK)**

```bash
curl "http://localhost:3000/api/applications"
curl "http://localhost:3000/api/applications?stage=to-contact"
curl "http://localhost:3000/api/applications?search=arc"
curl "http://localhost:3000/api/applications?stage=contacted&search=zoom"
```

**Read one (200 OK, or 404 Not Found)**

```bash
curl http://localhost:3000/api/applications/<id>
```

**Update (200 OK)**

```bash
curl -X PUT http://localhost:3000/api/applications/<id> \
  -H "Content-Type: application/json" \
  -d '{"company":"Arcane Group","jobTitle":"Backend Developer","stage":"interview-pending"}'
```

**Delete (204 No Content)**

```bash
curl -i -X DELETE http://localhost:3000/api/applications/<id>
```

**Invalid input (400 Bad Request)**

```bash
curl -i -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"company":"","stage":"hired","contactEmail":"jane@"}'
```

```json
{
  "error": {
    "status": 400,
    "message": "Validation failed.",
    "details": [
      { "field": "company", "message": "This field is required." },
      { "field": "jobTitle", "message": "This field is required." },
      { "field": "stage", "message": "Must be one of: to-contact, contacted, interview-pending, offer-contract, closed." },
      { "field": "contactEmail", "message": "Must be a valid email address." }
    ]
  }
}
```

## Status codes

| Code | Meaning | When you get it |
|------|---------|-----------------|
| `200` | OK | Successful `GET` or `PUT` |
| `201` | Created | Successful `POST` (with a `Location` header) |
| `204` | No Content | Successful `DELETE` |
| `400` | Bad Request | Malformed JSON, failed validation, or an invalid query parameter |
| `404` | Not Found | Unknown id or unknown route |
| `405` | Method Not Allowed | e.g. `PATCH` on a resource (an `Allow` header lists what works) |
| `413` | Payload Too Large | Body over 10 KB |
| `415` | Unsupported Media Type | `POST`/`PUT` without `Content-Type: application/json` |
| `429` | Too Many Requests | More than 100 requests per minute from one IP (see `Retry-After`) |
| `500` | Internal Server Error | Something unexpected. The response never leaks internals |

Every error has the same shape: `{ "error": { "status", "message", "details"? } }`.

## How it follows the brief

**Never trust the client.** Validation lives in `src/validate.js` and runs on every write, in two layers. *Syntactic*: is the format correct (types, required fields, lengths, email, real dates, allowed stages)? *Semantic*: is the logic valid (an interview cannot be before the application date)? The frontend's checks are a convenience; these are the real gate.

**RESTful naming.** `GET /api/applications`, not `/getApplications`. Plural nouns, ids in the path, no verbs, no file extensions.

**Statelessness.** No sessions and no per-client memory in the request path. Each request carries everything it needs, and all data lives in the store.

**Resilience.**
- File writes are atomic (temp file, then rename) and queued, so a crash or concurrent requests cannot corrupt data.
- If a write fails, in-memory state rolls back so it never drifts from the file.
- A corrupt data file is backed up (`.corrupt-<timestamp>`) and the API starts clean instead of crashing.
- A single error handler turns every failure into a consistent JSON response. Stack traces are logged, never sent.
- Rate limiting, a body size limit, graceful shutdown on `SIGTERM`/`SIGINT`, and a `/api/health` endpoint for monitors.

**Simple storage on purpose.** The brief says to master endpoints before scaling into complex databases, so data is a JSON file (`data/applications.json`). The store is isolated in `src/store.js`; swapping in SQLite or PostgreSQL later would not touch the routes.

## Project structure

```
hiretrail-api/
├── server.js          Entry point: config, listen, graceful shutdown
├── src/
│   ├── app.js         Routes and middleware wiring
│   ├── validate.js    Syntactic and semantic validation
│   ├── store.js       JSON-file persistence (atomic writes)
│   └── middleware.js  CORS, rate limit, content-type check, error handling
├── test/
│   └── api.test.js    35 tests (node:test, no extra libraries)
├── data/              Created at runtime (git-ignored)
└── package.json
```

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Port to listen on |
| `DATA_FILE` | `data/applications.json` | Where data is stored |
| `ALLOWED_ORIGINS` | `*` | Comma-separated origins allowed by CORS, e.g. `https://yourname.github.io` |

## Connecting the HireTrail frontend

Your frontend is on GitHub Pages, which only hosts static files, so this API has to be deployed separately (see below) and the frontend pointed at it. Start by swapping the `localStorage` calls in `js/app.js` for `fetch`:

```js
const API = 'http://localhost:3000/api/applications'; // use your deployed URL in production

async function request(path, options) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const body = await res.json();
  if (!res.ok) throw body.error;         // { status, message, details }
  return body;
}

const listApplications  = (q = '')   => request(q);                   // e.g. '?stage=closed'
const createApplication = (data)     => request('', { method: 'POST', body: JSON.stringify(data) });
const updateApplication = (id, data) => request(`/${id}`, { method: 'PUT', body: JSON.stringify(data) });
const deleteApplication = (id)       => request(`/${id}`, { method: 'DELETE' });
```

On a `400`, `error.details` holds `{ field, message }` pairs that can be shown under the matching form fields. Stage keys match the frontend (`to-contact`, `interview-pending`, and so on), and dates use `YYYY-MM-DD`, which is what `<input type="date">` produces.

## Deploying (optional)

Any Node host works. On Render or Railway: create a Web Service from this folder, build command `npm install`, start command `npm start`, and set `ALLOWED_ORIGINS` to your GitHub Pages origin (`https://<username>.github.io`). Free tiers have ephemeral disks, so data may reset on redeploy. That is fine for a demo, and a hosted database is the next step when it matters.

## Known limitations

- No authentication or authorization yet, so anyone who can reach the API can read and change the data. Adding AuthN (who are you?) and AuthZ (what can you do?) is the natural next milestone.
- The JSON file store suits one server instance, not several.
- The rate limiter is in-memory and per process.

## Author

[Your full name], Full Stack Development Intern at [DecodeLabs](https://www.decodelabs.tech).
