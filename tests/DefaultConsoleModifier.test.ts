import { type TestContext, test } from 'node:test'
import { pathToFileURL } from 'node:url'
import callsites from 'callsites'
import { DefaultConsoleModifier } from '../src/index.ts'

const defaultObj = {
  method: 'info' as any,
  level: 'info' as any,
  stacks: callsites(),
  time: '2024-11-13T09:42:44.022-08:00',
}

test('DefaultConsoleModifier test', (t: TestContext) => {
  t.assert.deepStrictEqual(
    DefaultConsoleModifier(
      {
        source: true,
        time: true,
      },
      defaultObj,
      ['test'],
    ),
    [
      '[2024-11-13T09:42:44.022-08:00]',
      '[INFO]',
      `[${pathToFileURL(import.meta.filename)}:9:11]`,
      'test',
    ],
  )

  t.assert.deepStrictEqual(
    DefaultConsoleModifier(
      {
        source: true,
        time: false,
      },
      defaultObj,
      ['test'],
    ),
    ['[INFO]', `[${pathToFileURL(import.meta.filename)}:9:11]`, 'test'],
  )

  t.assert.deepStrictEqual(
    DefaultConsoleModifier(
      {
        source: false,
        time: false,
      },
      defaultObj,
      ['test'],
    ),
    ['[INFO]', 'test'],
  )

  t.assert.deepStrictEqual(
    DefaultConsoleModifier(
      {
        source: true,
        sourcePrefix: `${pathToFileURL(import.meta.dirname)}/`,
        time: false,
      },
      defaultObj,
      ['test'],
    ),
    ['[INFO]', '[DefaultConsoleModifier.test.ts:9:11]', 'test'],
  )

  t.assert.deepStrictEqual(
    DefaultConsoleModifier(
      {
        source: true,
        time: false,
      },
      { ...defaultObj, stacks: undefined },
      ['test'],
    ),
    ['[INFO]', 'test'],
  )

  t.assert.deepStrictEqual(
    DefaultConsoleModifier(
      {
        source: true,
        time: false,
      },
      { ...defaultObj, stacks: [] },
      ['test'],
    ),
    ['[INFO]', 'test'],
  )
})
