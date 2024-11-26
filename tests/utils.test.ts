import { type TestContext, test } from 'node:test'
import {
  isLastDateEarlier,
  padStartZero,
  toDateString,
  toISOStringWithOffset,
} from '../src/utils.ts'

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
  t.assert.strictEqual(isLastDateEarlier(date1, date2), true)
  t.assert.strictEqual(isLastDateEarlier(date1, date2, true), false)
  t.assert.strictEqual(isLastDateEarlier(date3, date4), true)
  t.assert.strictEqual(isLastDateEarlier(date3, date4, true), true)
  t.assert.strictEqual(isLastDateEarlier(date1, date4), false)
  t.assert.strictEqual(isLastDateEarlier(date1, date4, true), false)
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
  const date1 = new Date('2024-11-13T17:42:44Z')
  const result1 = toISOStringWithOffset(date1)
  t.assert.strictEqual(result1, '2024-11-14T01:42:44+08:00')
  const result2 = toISOStringWithOffset(date1, false)
  t.assert.strictEqual(result2, '2024-11-14')

  process.env.TZ = 'UTC'
  const date2 = new Date('2024-11-13T17:42:44Z')
  const result3 = toISOStringWithOffset(date2)
  t.assert.strictEqual(result3, '2024-11-13T17:42:44+00:00')

  process.env.TZ = 'America/Los_Angeles'
  const date3 = new Date('2024-11-13T17:42:44Z')
  const result4 = toISOStringWithOffset(date3)
  t.assert.strictEqual(result4, '2024-11-13T09:42:44-08:00')
})
