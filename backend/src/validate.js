'use strict';

/**
 * The Gatekeeper: "Never trust the client."
 *
 * Layer 1 - Syntactic validation: is the format correct?
 *   (types, required fields, lengths, email format, date format, allowed stages)
 * Layer 2 - Semantic validation: is the logic valid?
 *   (e.g. an interview cannot happen before the application date)
 *
 * Returns { value, errors }. `value` is a cleaned copy that is safe to store;
 * `errors` is an array of { field, message } (empty when the input is valid).
 */

// Same stage keys the HireTrail frontend uses.
const STAGES = ['to-contact', 'contacted', 'interview-pending', 'offer-contract', 'closed'];

const FIELD_RULES = {
  company:       { required: true,  max: 100 },
  jobTitle:      { required: true,  max: 100 },
  stage:         { required: true },
  contactPerson: { required: false, max: 100 },
  contactEmail:  { required: false, max: 254 },
  dateApplied:   { required: false },
  interviewDate: { required: false },
  notes:         { required: false, max: 1000 },
};

const ALLOWED_FIELDS = Object.keys(FIELD_RULES);

// Pragmatic email check: something@something.tld, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True only for real calendar dates written as YYYY-MM-DD (rejects 2026-02-30). */
function isValidIsoDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function validateApplication(body) {
  const errors = [];

  if (!isPlainObject(body)) {
    return {
      value: null,
      errors: [{ field: 'body', message: 'Request body must be a JSON object.' }],
    };
  }

  // Reject anything we do not recognise rather than silently storing it.
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.includes(key)) {
      errors.push({ field: key, message: 'Unknown field.' });
    }
  }

  const value = {};

  for (const field of ALLOWED_FIELDS) {
    const rule = FIELD_RULES[field];
    const raw = body[field];

    // Missing / null
    if (raw === undefined || raw === null) {
      if (rule.required) errors.push({ field, message: 'This field is required.' });
      value[field] = '';
      continue;
    }

    // Layer 1a: type
    if (typeof raw !== 'string') {
      errors.push({ field, message: 'Must be a string.' });
      value[field] = '';
      continue;
    }

    const text = raw.trim();
    value[field] = text;

    // Layer 1b: required + length
    if (text === '') {
      if (rule.required) errors.push({ field, message: 'This field is required.' });
      continue;
    }
    if (rule.max && text.length > rule.max) {
      errors.push({ field, message: `Must be ${rule.max} characters or fewer.` });
      continue;
    }

    // Layer 1c: format
    if (field === 'stage' && !STAGES.includes(text)) {
      errors.push({ field, message: `Must be one of: ${STAGES.join(', ')}.` });
    }
    if (field === 'contactEmail' && !EMAIL_RE.test(text)) {
      errors.push({ field, message: 'Must be a valid email address.' });
    }
    if ((field === 'dateApplied' || field === 'interviewDate') && !isValidIsoDate(text)) {
      errors.push({ field, message: 'Must be a real date in YYYY-MM-DD format.' });
    }
  }

  // Layer 2: semantic rules (only meaningful once the formats are valid)
  const { dateApplied, interviewDate } = value;
  if (
    dateApplied && interviewDate &&
    isValidIsoDate(dateApplied) && isValidIsoDate(interviewDate) &&
    interviewDate < dateApplied // ISO dates compare correctly as strings
  ) {
    errors.push({
      field: 'interviewDate',
      message: 'Interview date cannot be before the date applied.',
    });
  }

  return { value: errors.length ? null : value, errors };
}

/** Validates the ?stage= query parameter on GET /applications. */
function validateStageQuery(stage) {
  if (stage === undefined) return null;
  if (typeof stage !== 'string' || !STAGES.includes(stage)) {
    return { field: 'stage', message: `Must be one of: ${STAGES.join(', ')}.` };
  }
  return null;
}

module.exports = { STAGES, validateApplication, validateStageQuery, isValidIsoDate };
