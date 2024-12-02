import { type TestContext, test } from 'node:test'
import {
  escapeRegExp,
  isLastDateEarlier,
  padStartZero,
  toDateString,
  toISOStringWithOffset,
} from '../src/utils.ts'

test('escapeRegExp test', (t: TestContext) => {
  t.assert.strictEqual(escapeRegExp('abc'), String.raw`abc`)
  t.assert.strictEqual(escapeRegExp('ab(c'), String.raw`ab\(c`)
})

test('isLastDateEarlier test', (t: TestContext) => {
  const TZ = process.env.TZ
  t.after(() => {
    process.env.TZ = TZ
  })
  process.env.TZ = 'Asia/Shanghai'

  const date1 = new Date('2024-11-13T11:42:44Z')
  const date2 = new Date('2024-11-13T22:42:44Z')
  const date3 = new Date('2023-11-14T14:42:44Z')
  const date4 = new Date('2024-11-12T17:42:44Z')
  t.assert.ok(isLastDateEarlier(date1, date2))
  t.assert.ok(!isLastDateEarlier(date1, date2, true))
  t.assert.ok(isLastDateEarlier(date3, date4))
  t.assert.ok(isLastDateEarlier(date3, date4, true))
  t.assert.ok(!isLastDateEarlier(date1, date4))
  t.assert.ok(!isLastDateEarlier(date1, date4, true))
})

test('padStartZero test', (t: TestContext) => {
  t.assert.strictEqual(padStartZero('123', 4), '0123')
  t.assert.strictEqual(padStartZero('1234', 4), '1234')
})

test('toDateString test', (t: TestContext) => {
  const TZ = process.env.TZ
  t.after(() => {
    process.env.TZ = TZ
  })
  process.env.TZ = 'Asia/Shanghai'

  const date = new Date('2024-11-13T17:42:44Z')
  t.assert.strictEqual(toDateString(date), '2024-11-14')
  t.assert.strictEqual(toDateString(date, true), '2024-11-13')
})

test('toISOStringWithOffset test', (t: TestContext) => {
  const TZ = process.env.TZ
  t.after(() => {
    process.env.TZ = TZ
  })

  process.env.TZ = 'Asia/Shanghai'
  const date1 = new Date('2024-11-13T17:42:44.013Z')
  const result1 = toISOStringWithOffset(date1)
  t.assert.strictEqual(result1, '2024-11-14T01:42:44.013+08:00')
  const result2 = toISOStringWithOffset(date1, false)
  t.assert.strictEqual(result2, '2024-11-14')

  process.env.TZ = 'UTC'
  const date2 = new Date('2024-11-13T17:42:44Z')
  const result3 = toISOStringWithOffset(date2)
  t.assert.strictEqual(result3, '2024-11-13T17:42:44.000+00:00')

  process.env.TZ = 'America/Los_Angeles'
  const date3 = new Date('2024-11-13T17:42:44.123Z')
  const result4 = toISOStringWithOffset(date3)
  t.assert.strictEqual(result4, '2024-11-13T09:42:44.123-08:00')
})
