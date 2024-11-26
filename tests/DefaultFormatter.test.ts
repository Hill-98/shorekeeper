import { deepStrictEqual } from 'node:assert/strict'
import { type TestContext, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import callsites from 'callsites'
import DefaultFormatter from '../src/DefaultFormatter.ts'

const defaultObj = {
  level: 'info' as any,
  time: '2024-11-13T09:42:44-08:00',
}
const stacks = callsites()
const result = DefaultFormatter(
  { ...defaultObj, stacks: stacks.slice(0, 1) },
  'test',
)

deepStrictEqual(JSON.parse(result), {
  ...defaultObj,
  message: 'test',
  stacks: [
    {
      method: null,
      source: pathToFileURL(import.meta.filename)
        .toString()
        .concat(':11:16'),
    },
  ],
})

test('DefaultFormatter test', (t: TestContext) => {
  const stacks = callsites()

  const result1 = DefaultFormatter(
    { ...defaultObj, level: 'iNFo' as any, stacks: stacks.slice(0, 1) },
    'test',
  )
  t.assert.deepStrictEqual(JSON.parse(result1), {
    ...defaultObj,
    message: 'test',
    stacks: [
      {
        method: 'TestContext.<anonymous>',
        source: pathToFileURL(import.meta.filename)
          .toString()
          .concat(':31:18'),
      },
    ],
  })

  const result2 = DefaultFormatter(defaultObj)
  t.assert.deepStrictEqual(JSON.parse(result2), defaultObj)

  const result3 = DefaultFormatter(defaultObj, 'test1', 'test2')
  t.assert.deepStrictEqual(JSON.parse(result3), {
    ...defaultObj,
    message: ['test1', 'test2'],
  })

  const result4 = DefaultFormatter(defaultObj, {
    toJSON() {
      return true
    },
  })
  t.assert.deepStrictEqual(JSON.parse(result4), {
    ...defaultObj,
    message: true,
  })

  const err = new SyntaxError('test')
  const result5 = DefaultFormatter(defaultObj, err)
  t.assert.deepStrictEqual(JSON.parse(result5), {
    ...defaultObj,
    message: {
      message: err.message,
      name: 'SyntaxError',
      stack: err.stack,
    },
  })
})
