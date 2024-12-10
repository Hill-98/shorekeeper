import { deepStrictEqual } from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import callsites from 'callsites'
import { DefaultFormatter } from '../src/index.ts'

const data = {
  level: 'info' as any,
  method: 'info' as any,
  time: '2024-11-13T09:42:44.022-08:00',
  stacks: callsites().splice(0, 1),
}

const result = {
  level: 'info',
  time: '2024-11-13T09:42:44.022-08:00',
  stacks: [
    {
      method: null,
      source: `${pathToFileURL(import.meta.filename)}:11:11`,
    },
  ],
}

test('DefaultFormatter test', (t: TestContext) => {
  const stacks = callsites()

  // Top level stack test
  const result1 = DefaultFormatter(data, ['test'])
  deepStrictEqual(JSON.parse(result1), {
    ...result,
    message: 'test',
  })

  // result level lower case test
  const result2 = DefaultFormatter(
    { ...data, level: 'iNFo' as any, stacks: stacks.slice(0, 1) },
    ['test'],
  )
  t.assert.deepStrictEqual(JSON.parse(result2), {
    ...result,
    message: 'test',
    stacks: [
      {
        method: 'TestContext.<anonymous>',
        source: `${pathToFileURL(import.meta.filename)}:26:18`,
      },
    ],
  })

  // no stacks and messages test
  const result3 = DefaultFormatter(
    {
      level: 'info',
      method: 'info',
      time: '2024-11-13T09:42:44.022-08:00',
    },
    [],
  )
  t.assert.deepStrictEqual(JSON.parse(result3), {
    level: 'info',
    time: '2024-11-13T09:42:44.022-08:00',
  })

  // multiple messages test
  const result4 = DefaultFormatter(data, ['test1', 'test2'])
  t.assert.deepStrictEqual(JSON.parse(result4), {
    ...result,
    message: ['test1', 'test2'],
  })

  // have toJSON() method object test
  const result5 = DefaultFormatter(data, [
    {
      toJSON() {
        return true
      },
    },
  ])
  t.assert.deepStrictEqual(JSON.parse(result5), {
    ...result,
    message: true,
  })

  // error object test
  const err = new SyntaxError('test')
  const result6 = DefaultFormatter(data, [err])
  t.assert.deepStrictEqual(JSON.parse(result6), {
    ...result,
    message: {
      message: err.message,
      name: 'SyntaxError',
      stack: err.stack,
    },
  })
})
