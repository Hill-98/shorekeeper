import { Console } from 'node:console'
import { type TestContext, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import type { ConsoleMethods, DefaultFormatterResult } from '../src/index.ts'
import { ConsoleSymbol, init } from '../src/index.ts'

const $console = Object.getOwnPropertyDescriptors(globalThis.console)

function hookGlobalConsole<T extends ConsoleMethods>(
  method: T,
  func: Console[T],
) {
  Object.defineProperty(globalThis.console, method, {
    ...$console[method],
    value: func,
  })
}

function resetGlobalConsole() {
  Object.defineProperties(globalThis.console, $console)
  Reflect.deleteProperty(globalThis.console, ConsoleSymbol)
}

test(
  'console test',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const TZ = process.env.TZ
      t.after(() => {
        process.env.TZ = TZ
      })
      process.env.TZ = 'Asia/Shanghai'

      t.after(resetGlobalConsole)
      t.mock.timers.enable({ apis: ['Date'] })

      hookGlobalConsole('log', (...args: any[]) => {
        t.assert.deepStrictEqual(args, [
          '[1970-01-01T08:00:00.000+08:00]',
          '[NOTICE]',
          'hello1',
        ])
      })

      init()
      t.assert.ok(Reflect.has(globalThis.console, ConsoleSymbol))
      console.log('hello1')

      resetGlobalConsole()

      const _console = new Console(process.stdout, process.stderr)

      Object.defineProperty(_console, 'log', {
        ...Object.getOwnPropertyDescriptor(_console, 'log'),
        value(...args: any[]) {
          t.assert.deepStrictEqual(args, [
            '[1970-01-01T08:00:00.000+08:00]',
            '[NOTICE]',
            'hello2',
          ])
          resolve()
        },
      })

      init({ console: _console })
      t.assert.ok(Reflect.has(_console, ConsoleSymbol))
      _console.log('hello2')
    }),
)

test(
  'console test with multiple init',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const TZ = process.env.TZ
      t.after(() => {
        process.env.TZ = TZ
      })
      process.env.TZ = 'Asia/Shanghai'

      t.after(resetGlobalConsole)
      t.mock.timers.enable({ apis: ['Date'] })

      let count = 0

      hookGlobalConsole('log', (...args: any[]) => {
        t.assert.deepStrictEqual(args, [
          '[1970-01-01T08:00:00.000+08:00]',
          '[NOTICE]',
          'hello',
        ])
        count++
      })

      hookGlobalConsole('info', (...args: any[]) => {
        t.assert.deepStrictEqual(args, [
          '[1970-01-01T08:00:00.000+08:00]',
          '[INFO]',
          'world',
        ])
        count++
        if (count > 1) {
          resolve()
        }
      })

      init()
      t.assert.ok(Reflect.has(globalThis.console, ConsoleSymbol))
      console.log('hello')

      init()
      t.assert.ok(Reflect.has(globalThis.console, ConsoleSymbol))
      console.info('world')
    }),
)

test(
  'console test with consoleModifier option',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      t.after(resetGlobalConsole)

      hookGlobalConsole('log', (...args: any[]) => {
        t.assert.deepStrictEqual(args, ['hello'])
      })

      hookGlobalConsole('info', (...args: any[]) => {
        t.assert.deepStrictEqual(args, ['hello', 'world'])
        resolve()
      })

      init({ consoleModifier: false })
      console.log('hello')

      init({
        consoleModifier: (data, messages) => {
          t.assert.strictEqual(data.method, 'info')
          return ['hello', ...messages]
        },
      })
      console.info('world')
    }),
)

test(
  'console test with filter option',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve, reject) => {
      t.after(resetGlobalConsole)

      hookGlobalConsole('error', (...args: any[]) => {
        t.assert.deepStrictEqual(args, ['[ERROR]', 'hello'])
        resolve()
      })

      hookGlobalConsole('info', () => {
        reject()
      })

      hookGlobalConsole('log', () => {
        reject()
      })

      init({
        filter(data) {
          if (data.method === 'error') {
            return true
          }
          if (data.method === 'log') {
            return false
          }
          return {
            report: true,
          }
        },
        reporters: [
          function testReporter(data) {
            const json: DefaultFormatterResult = JSON.parse(data as string)
            if (json.level === 'error') {
              t.assert.deepStrictEqual(json.message, 'hello')
            }
            if (json.level === 'notice') {
              t.assert.deepStrictEqual(json.message, 'test')
              resolve()
            }
          },
        ],
        time: false,
      })
      console.error('hello')
      console.log('world')
      console.info('test')
    }),
)

test(
  'console test with formatter option',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      const TZ = process.env.TZ
      t.after(() => {
        process.env.TZ = TZ
      })
      process.env.TZ = 'Asia/Shanghai'

      t.after(resetGlobalConsole)
      t.mock.timers.enable({ apis: ['Date'] })

      let count = 0

      init({
        formatter(data, messages) {
          t.assert.deepStrictEqual(data.level, 'error')
          t.assert.deepStrictEqual(data.time, '1970-01-01T08:00:00.000+08:00')
          t.assert.notDeepStrictEqual(data.stacks, undefined)
          return messages.includes('hello') ? 'hello' : Promise.resolve('world')
        },
        reporters: [
          function testReporter(data) {
            if (count === 0) {
              t.assert.deepStrictEqual(data, 'hello')
              count++
            } else {
              t.assert.deepStrictEqual(data, 'world')
              resolve()
            }
          },
        ],
        time: true,
        source: true,
      })
      console.error('hello')
      console.error('world')
    }),
)

test(
  'console test with methods option',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      t.after(resetGlobalConsole)

      hookGlobalConsole('log', (...args: any[]) => {
        t.assert.deepStrictEqual(args, ['world'])
        resolve()
      })

      hookGlobalConsole('error', (...args: any[]) => {
        t.assert.deepStrictEqual(args, ['[ERROR]', 'hello'])
      })

      init({ methods: ['error'], time: false })
      console.error('hello')
      console.log('world')
    }),
)

test(
  'console test with reports option',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      t.after(resetGlobalConsole)

      init({
        reporters: [
          function testReporter(data) {
            const json: DefaultFormatterResult = JSON.parse(data as string)
            if (json.level === 'error') {
              t.assert.deepStrictEqual(json.message, 'hello')
            }
            if (json.level === 'notice') {
              t.assert.deepStrictEqual(json.message, 'world')
              resolve()
            }
          },
        ],
        time: false,
      })
      console.error('hello')
      console.log('world')
    }),
)

test(
  'console test with source option',
  { timeout: 1000 },
  (t: TestContext) =>
    new Promise((resolve) => {
      t.after(resetGlobalConsole)

      hookGlobalConsole('error', (...args: any[]) => {
        t.assert.deepStrictEqual(args, [
          '[ERROR]',
          `[${pathToFileURL(import.meta.filename)}:319:15]`,
          'hello',
        ])
      })

      hookGlobalConsole('log', (...args: any[]) => {
        t.assert.deepStrictEqual(args, [
          '[NOTICE]',
          '[index.test.ts:325:15]',
          'world',
        ])
        resolve()
      })

      init({
        time: false,
        source: true,
      })
      console.error('hello')

      init({
        time: false,
        source: import.meta.dirname,
      })
      console.log('world')
    }),
)

test('console test with time option', (t: TestContext) =>
  new Promise((resolve) => {
    t.after(() => {
      Object.defineProperties(globalThis.console, $console)
      Reflect.deleteProperty(globalThis.console, ConsoleSymbol)
    })
    t.mock.timers.enable({ apis: ['Date'] })

    hookGlobalConsole('log', (...args: any[]) => {
      t.assert.deepStrictEqual(args, ['[NOTICE]', 'hello'])
      resolve()
    })

    init({ time: false })
    console.log('hello')
  }))
