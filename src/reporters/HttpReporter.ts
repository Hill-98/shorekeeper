import type { Reporter } from '../index.ts'

export function createHttpReporter(
  endpoint: string,
  init?: RequestInit,
  fetch?: typeof globalThis.fetch,
): Reporter<Promise<Response>> {
  const $fetch = fetch ?? globalThis.fetch

  if (typeof $fetch !== 'function') {
    throw new TypeError(
      'CreateHttpReporter: fetch is not a function or global fetch cannot be found.',
    )
  }

  return function HttpReporter(data) {
    return $fetch(endpoint, {
      method: 'POST',
      ...(init ?? {}),
      body: data,
    })
  }
}
