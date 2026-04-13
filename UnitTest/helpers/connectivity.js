/**
 * connectivity.js
 *
 * Extracted BookStack connectivity check logic — mirrors the implementation
 * in chatbot/server.js so it can be imported and unit-tested independently.
 *
 * Uses dependency injection: accepts an `apiClient` (axios instance or mock)
 * so no real HTTP calls are made during tests.
 */

/**
 * @param {object} apiClient - axios instance (or jest mock with a .get() method)
 * @returns {Promise<{ok: boolean, reason?: 'auth'|'connection'}>}
 */
async function checkBookStackConnectivity(apiClient) {
  try {
    await apiClient.get('/books', { params: { count: 1 } });
    return { ok: true };
  } catch (err) {
    const status = err.response?.status;

    // 401 = API token expired or invalid
    if (status === 401) {
      return { ok: false, reason: 'auth' };
    }

    // 403 = server reachable but VPN/access blocked
    // Network error codes = server unreachable
    // 5xx = server-side failure
    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ENOTFOUND'    ||
      err.code === 'ETIMEDOUT'    ||
      err.code === 'ECONNRESET'   ||
      err.code === 'ECONNABORTED' ||
      status === 403              ||
      (status && status >= 500)
    ) {
      return { ok: false, reason: 'connection' };
    }

    // Unknown / transient error — assume reachable to avoid false positives
    return { ok: true };
  }
}

/**
 * Classifies a caught error into one of the SSE error event types
 * sent by chatbot/server.js in the /api/chat catch block.
 *
 * @param {object} err - The caught error object
 * @returns {'bookstack_error'|'quota_error'|'auth_error'|'error'}
 */
function classifyServerError(err) {
  if (err.type === 'bookstack_error') return 'bookstack_error';

  const status = err?.status ?? err?.response?.status;

  if (
    status === 429 ||
    err?.error?.type === 'insufficient_quota' ||
    (err.message && (
      err.message.includes('quota') ||
      err.message.includes('rate limit') ||
      err.message.includes('insufficient_quota') ||
      err.message.includes('429')
    ))
  ) {
    return 'quota_error';
  }

  if (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND'    ||
    err.code === 'ETIMEDOUT'
  ) {
    return 'bookstack_error';
  }

  return 'error';
}

module.exports = { checkBookStackConnectivity, classifyServerError };
