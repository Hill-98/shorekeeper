import { Writable } from 'node:stream'
import { type TestContext, test } from 'node:test'
import { createStreamReporter } from '../../src/reporters/StreamReporter.ts'

test(
  'StreamReporter Test',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const stream = new Writable({
        decodeStrings: false,
        defaultEncoding: 'utf8',
        write(chunk, _, callback) {
          t.assert.strictEqual(chunk, 'StreamReporter')
          callback()
          resolve()
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream)
      reporter('StreamReporter')
    }),
)

test(
  'StreamReporter Test with custom options',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const stream = new Writable({
        decodeStrings: false,
        defaultEncoding: 'utf8',
        write(chunk, encoding, callback) {
          t.assert.strictEqual(chunk, 'StreamReporter\n')
          t.assert.strictEqual(encoding, 'base64')
          callback()
          resolve()
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream, {
        appendLf: true,
        encoding: 'base64',
      })
      reporter('StreamReporter')
    }),
)

test(
  'StreamReporter Test with buffer',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(reject, 10)
      const stream = new Writable({
        write(chunk: Uint8Array, _, callback) {
          t.assert.deepStrictEqual(Array.from(chunk), [1, 2, 3, 4, 5])
          clearTimeout(timer)
          callback()
          resolve()
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream)
      reporter(new Uint8Array([1, 2, 3, 4, 5]))
    }),
)

test(
  'StreamReporter Test with stream closed',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, 10)
      const stream = new Writable({
        decodeStrings: false,
        defaultEncoding: 'utf8',
        write(chunk, _, callback) {
          t.assert.strictEqual(chunk, 'StreamReporter')
          callback()
          stream.end(() => {
            reporter('closed').catch((err: Error) => {
              t.assert.strictEqual(
                err.message,
                'StreamReporter: stream not writable',
              )
            })
          })
        },
      })
      t.after(() => {
        clearTimeout(timer)
        stream.destroy()
      })
      const reporter = createStreamReporter(stream)
      reporter('StreamReporter')
    }),
)

test(
  'StreamReporter Test with drain event',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve, reject) => {
      let str = 'x'
      const stream = new Writable({
        decodeStrings: false,
        defaultEncoding: 'utf8',
        highWaterMark: 8,
        write(chunk, _, callback) {
          if (chunk === 'StreamReporter') {
            setTimeout(() => {
              str = 'drain'
              callback()
            }, 200)
          } else if (chunk === str) {
            callback()
            resolve()
          }
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream)
      reporter('StreamReporter').catch(reject)
      reporter('drain').catch(reject)
    }),
)

test(
  'StreamReporter Test with write error',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const error = new Error('stream write error')
      const stream = new Writable({
        decodeStrings: false,
        defaultEncoding: 'utf8',
        highWaterMark: 8,
        write(_, __, callback) {
          setImmediate(callback.bind(this, error))
        },
      })
      stream.once('error', (err) => {
        t.assert.strictEqual(err, error)
      })
      const reporter = createStreamReporter(stream)
      reporter('StreamReporter').catch((err: Error) => {
        t.assert.strictEqual(err, error)
      })
      reporter('drain').catch((err: Error) => {
        t.assert.strictEqual(err.message, 'StreamReporter: stream closed')
        resolve()
      })
    }),
)
