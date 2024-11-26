import { createServer } from 'node:http'
import { type TestContext, test } from 'node:test'
import { createHttpReporter } from '../../src/reporters/HttpReporter.ts'

test(
  'HttpReporter test',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const server = createServer((req, res) => {
        t.assert.strictEqual(req.method, 'POST')
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          res.end(() => {
            server.close()
          })
          t.assert.strictEqual(body, 'HttpReporter')
          resolve()
        })
      }).listen(23571)
      t.after(() => {
        server.close()
      })
      server.once('listening', () => {
        const reporter = createHttpReporter('http://127.0.0.1:23571')
        reporter('HttpReporter')
      })
    }),
)

test(
  'HttpReporter test with custom request',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const server = createServer((req, res) => {
        t.assert.strictEqual(req.method, 'POST')
        t.assert.strictEqual(req.headers['x-node-test'], 'true')
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk) => {
          body += chunk
        })
        req.on('end', () => {
          res.end(() => {
            server.close()
          })
          t.assert.strictEqual(body, 'HttpReporter')
          resolve()
        })
      }).listen(23572)
      t.after(() => {
        server.close()
      })
      server.once('listening', () => {
        const reporter = createHttpReporter('http://127.0.0.1:23572', {
          headers: {
            'X-Node-Test': 'true',
          },
        })
        reporter('HttpReporter')
      })
    }),
)

test(
  'HttpReporter test with custom fetch',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const reporter = createHttpReporter(
        'http://localhost',
        {
          headers: {
            'X-Node-Test': 'true',
          },
        },
        (input, init) => {
          t.assert.strictEqual(input, 'http://localhost')
          t.assert.deepStrictEqual(init, {
            body: 'HttpReporter',
            method: 'POST',
            headers: {
              'X-Node-Test': 'true',
            },
          })
          resolve()
          return Promise.resolve(new Response())
        },
      )
      reporter('HttpReporter')
    }),
)

test('HttpReporter test with no fetch', (t: TestContext) => {
  const p = Object.getOwnPropertyDescriptor(globalThis, 'fetch')
  if (p) {
    Reflect.deleteProperty(globalThis, 'fetch')
    t.after(() => {
      Object.defineProperty(globalThis, 'fetch', p)
    })
  }
  try {
    createHttpReporter('http://localhost')
  } catch (err: any) {
    t.assert.strictEqual(
      err.message,
      'CreateHttpReporter: fetch is not a function or global fetch cannot be found.',
    )
  }
})
