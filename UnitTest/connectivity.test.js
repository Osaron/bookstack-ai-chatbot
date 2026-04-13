/**
 * connectivity.test.js
 *
 * Unit tests for checkBookStackConnectivity().
 *
 * These tests verify that the pre-flight BookStack health check correctly
 * distinguishes between three scenarios:
 *   ✅ Connected   → { ok: true }
 *   🔑 Token issue → { ok: false, reason: 'auth' }     (HTTP 401)
 *   🔌 No access   → { ok: false, reason: 'connection' } (HTTP 403, network errors)
 *
 * A mock apiClient is injected so no real network calls are made.
 */

const { checkBookStackConnectivity } = require('./helpers/connectivity');

// ─── Helper: build a mock apiClient ───────────────────────────────────────────

function mockSuccess() {
  return { get: jest.fn().mockResolvedValue({ data: { data: [] } }) };
}

function mockHttpError(status) {
  const err = { response: { status } };
  return { get: jest.fn().mockRejectedValue(err) };
}

function mockNetworkError(code) {
  const err = { code };
  return { get: jest.fn().mockRejectedValue(err) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkBookStackConnectivity()', () => {

  test('✅ returns { ok: true } when BookStack responds with 200', async () => {
    const result = await checkBookStackConnectivity(mockSuccess());
    expect(result).toEqual({ ok: true });
  });

  test('🔑 returns { ok: false, reason: "auth" } on HTTP 401 (expired/invalid token)', async () => {
    const result = await checkBookStackConnectivity(mockHttpError(401));
    expect(result).toEqual({ ok: false, reason: 'auth' });
  });

  test('🔌 returns { ok: false, reason: "connection" } on HTTP 403 (VPN not connected)', async () => {
    const result = await checkBookStackConnectivity(mockHttpError(403));
    expect(result).toEqual({ ok: false, reason: 'connection' });
  });

  test('🔌 returns { ok: false, reason: "connection" } on HTTP 500 (server error)', async () => {
    const result = await checkBookStackConnectivity(mockHttpError(500));
    expect(result).toEqual({ ok: false, reason: 'connection' });
  });

  test('🔌 returns { ok: false, reason: "connection" } on ECONNREFUSED (server unreachable)', async () => {
    const result = await checkBookStackConnectivity(mockNetworkError('ECONNREFUSED'));
    expect(result).toEqual({ ok: false, reason: 'connection' });
  });

  test('🔌 returns { ok: false, reason: "connection" } on ETIMEDOUT (request timed out)', async () => {
    const result = await checkBookStackConnectivity(mockNetworkError('ETIMEDOUT'));
    expect(result).toEqual({ ok: false, reason: 'connection' });
  });

  test('🔌 returns { ok: false, reason: "connection" } on ENOTFOUND (DNS resolution failure)', async () => {
    const result = await checkBookStackConnectivity(mockNetworkError('ENOTFOUND'));
    expect(result).toEqual({ ok: false, reason: 'connection' });
  });

  test('✅ returns { ok: true } for unknown/transient errors (avoid false positives)', async () => {
    const unknownErr = { response: { status: 418 } }; // I'm a Teapot — unexpected
    const client = { get: jest.fn().mockRejectedValue(unknownErr) };
    const result = await checkBookStackConnectivity(client);
    expect(result).toEqual({ ok: true });
  });

});
