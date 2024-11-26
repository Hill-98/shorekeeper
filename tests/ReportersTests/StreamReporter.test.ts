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
          callback(null)
          resolve()
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream, false)
      reporter('StreamReporter')
    }),
)

test(
  'StreamReporter Test with append lf',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const stream = new Writable({
        decodeStrings: false,
        defaultEncoding: 'utf8',
        write(chunk, _, callback) {
          t.assert.strictEqual(chunk, 'StreamReporter\n')
          callback(null)
          resolve()
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream, true)
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
          callback(null)
          clearTimeout(timer)
          t.assert.deepStrictEqual(Array.from(chunk), [1, 2, 3, 4, 5])
          resolve()
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream, false)
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
          callback(null)
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
      const reporter = createStreamReporter(stream, false)
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
              callback(null)
            }, 200)
          } else if (chunk === str) {
            callback(null)
            resolve()
          }
        },
      })
      t.after(() => {
        stream.destroy()
      })
      const reporter = createStreamReporter(stream, false)
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
      const reporter = createStreamReporter(stream, false)
      reporter('StreamReporter').catch((err: Error) => {
        t.assert.strictEqual(err, error)
      })
      reporter('drain').catch((err: Error) => {
        t.assert.strictEqual(err.message, 'StreamReporter: stream closed')
        resolve()
      })
    }),
)
