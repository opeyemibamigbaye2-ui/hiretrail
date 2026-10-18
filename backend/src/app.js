'use strict';

const express = require('express');
const {
  httpError,
  asyncHandler,
  securityHeaders,
  responseTime,
  apiKeyAuth,
  cors,
  rateLimit,
  requireJson,
  notFound,
  errorHandler,
} = require('./middleware');
const { validateApplication, validateStageQuery } = require('./validate');

/**
 * Builds the Express app. The store and options are injected so the same code
 * runs in production and in tests (stateless: all state lives in the store).
 *
 * RESTful naming: resources are nouns, methods are verbs.
 *   GET    /api/applications        list (optional ?stage= & ?search=)
 *   POST   /api/applications        create
 *   GET    /api/applications/:id    read one
 *   PUT    /api/applications/:id    replace/update
 *   DELETE /api/applications/:id    remove
 *   GET    /api/health              liveness check
 */
function createApp({
  store,
  allowedOrigins = '*',
  rateLimitOptions = { windowMs: 60_000, max: 100 },
  apiKey = process.env.API_KEY,
}) {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(responseTime);
  app.use(cors(allowedOrigins));
  app.use(rateLimit(rateLimitOptions));
  if (apiKey) {
    app.use(apiKeyAuth(apiKey));
  }
  app.use(requireJson);
  app.use(express.json({ limit: '10kb' }));

  // ---- Health (high availability: lets a host/monitor check the service) ----
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  // ---- Collection: /api/applications ----
  app
    .route('/api/applications')
    .get(
      asyncHandler(async (req, res) => {
        const { stage, search } = req.query;

        const stageError = validateStageQuery(stage);
        if (stageError) throw httpError(400, 'Invalid query parameter.', [stageError]);
        if (search !== undefined && typeof search !== 'string') {
          throw httpError(400, 'Invalid query parameter.', [
            { field: 'search', message: 'Must be a single text value.' },
          ]);
        }

        let items = await store.list();
        if (stage) items = items.filter((a) => a.stage === stage);
        if (search && search.trim()) {
          const needle = search.trim().toLowerCase();
          items = items.filter((a) => a.company.toLowerCase().includes(needle));
        }
        res.status(200).json(items);
      })
    )
    .post(
      asyncHandler(async (req, res) => {
        const { value, errors } = validateApplication(req.body);
        if (errors.length) throw httpError(400, 'Validation failed.', errors);

        const created = await store.create(value);
        res.status(201).location(`/api/applications/${created.id}`).json(created);
      })
    )
    .all((req, res, next) => {
      res.set('Allow', 'GET, POST, OPTIONS');
      next(httpError(405, `Method ${req.method} not allowed on this resource.`));
    });

  // ---- Single item: /api/applications/:id ----
  app
    .route('/api/applications/:id')
    .get(
      asyncHandler(async (req, res) => {
        const item = await store.get(req.params.id);
        if (!item) throw httpError(404, 'Application not found.');
        res.status(200).json(item);
      })
    )
    .put(
      asyncHandler(async (req, res) => {
        const { value, errors } = validateApplication(req.body);
        if (errors.length) throw httpError(400, 'Validation failed.', errors);

        const updated = await store.replace(req.params.id, value);
        if (!updated) throw httpError(404, 'Application not found.');
        res.status(200).json(updated);
      })
    )
    .delete(
      asyncHandler(async (req, res) => {
        const removed = await store.remove(req.params.id);
        if (!removed) throw httpError(404, 'Application not found.');
        res.status(204).end();
      })
    )
    .all((req, res, next) => {
      res.set('Allow', 'GET, PUT, DELETE, OPTIONS');
      next(httpError(405, `Method ${req.method} not allowed on this resource.`));
    });

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
