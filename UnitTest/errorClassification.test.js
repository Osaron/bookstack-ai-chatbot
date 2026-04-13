/**
 * errorClassification.test.js
 *
 * Unit tests for classifyServerError() — the logic that maps caught server
 * errors to the correct SSE event type sent to the frontend.
 *
 * The frontend uses these types to render the right error card:
 *   'quota_error'     → ⚠️  Amber card  — OpenAI token quota exhausted
 *   'auth_error'      → 🔑  Blue card   — BookStack API token expired/invalid
 *   'bookstack_error' → 🔌  Red card    — Cannot reach BookStack / check VPN
 *   'error'           → ❌  Red card    — Generic unexpected error
 *
 * These tests ensure that errors are never silently mis-classified
 * (e.g., a quota error accidentally showing as a VPN message).
 */

const { classifyServerError } = require('./helpers/connectivity');

describe('classifyServerError()', () => {

  // ── Quota / OpenAI token limit ──────────────────────────────────────────

  test('⚠️  classifies HTTP 429 status as quota_error', () => {
    expect(classifyServerError({ status: 429 })).toBe('quota_error');
  });

  test('⚠️  classifies "insufficient_quota" message as quota_error', () => {
    expect(classifyServerError({ message: 'Error: insufficient_quota exceeded' })).toBe('quota_error');
  });

  test('⚠️  classifies "rate limit" message as quota_error', () => {
    expect(classifyServerError({ message: 'You exceeded your current rate limit' })).toBe('quota_error');
  });

  test('⚠️  classifies OpenAI error object with insufficient_quota type as quota_error', () => {
    expect(classifyServerError({ error: { type: 'insufficient_quota' } })).toBe('quota_error');
  });

  // ── BookStack connectivity ───────────────────────────────────────────────

  test('🔌 classifies pre-tagged bookstack_error type correctly', () => {
    expect(classifyServerError({ type: 'bookstack_error', message: 'Cannot reach BookStack server' })).toBe('bookstack_error');
  });

  test('🔌 classifies ECONNREFUSED as bookstack_error', () => {
    expect(classifyServerError({ code: 'ECONNREFUSED' })).toBe('bookstack_error');
  });

  test('🔌 classifies ENOTFOUND as bookstack_error', () => {
    expect(classifyServerError({ code: 'ENOTFOUND' })).toBe('bookstack_error');
  });

  test('🔌 classifies ETIMEDOUT as bookstack_error', () => {
    expect(classifyServerError({ code: 'ETIMEDOUT' })).toBe('bookstack_error');
  });

  // ── Generic / unknown errors ─────────────────────────────────────────────

  test('❌ classifies an unrecognized error as generic error', () => {
    expect(classifyServerError({ message: 'Something random happened' })).toBe('error');
  });

  test('❌ classifies empty error object as generic error', () => {
    expect(classifyServerError({})).toBe('error');
  });

});
