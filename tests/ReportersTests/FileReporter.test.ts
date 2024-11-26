import { constants, createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { type TestContext, test } from 'node:test'
import { createBrotliDecompress, createGunzip } from 'node:zlib'
import { createFileReporter } from '../../src/reporters/FileReporter.ts'

const ONE_MINUTE = 60 * 1000
const ONE_HOUR = ONE_MINUTE * 60
const ONE_DAY = ONE_HOUR * 24

test('FileReporter test', async (t: TestContext) => {
  const file = join(tmpdir(), 'FileReporter.test.log')
  await rm(file, { force: true })

  const report1 = await createFileReporter(file)
  await report1('FileReporter1')
  await report1('FileReporter1')
  await report1('FileReporter1')
  t.assert.strictEqual(
    await readFile(file, 'utf-8'),
    'FileReporter1\n'.repeat(3),
  )

  const report2 = await createFileReporter(file)
  await report2('FileReporter2')
  await report2('FileReporter2')
  await report2('FileReporter2')
  t.assert.strictEqual(
    await readFile(file, 'utf-8'),
    'FileReporter1\n'.repeat(3) + 'FileReporter2\n'.repeat(3),
  )
})

test('FileReporter test with custom mode', async (t: TestContext) => {
  const file = join(tmpdir(), 'FileReporter.mode.test.log')
  await rm(file, { force: true })

  const report = await createFileReporter(file, {
    mode: constants.S_IRUSR | constants.S_IWUSR,
  })
  await report('FileReporter')
  const { mode } = await stat(file)
  t.assert.strictEqual(mode & constants.S_IRUSR, constants.S_IRUSR)
  t.assert.strictEqual(mode & constants.S_IWUSR, constants.S_IWUSR)
  t.assert.strictEqual(mode & constants.S_IRGRP, 0)
  t.assert.strictEqual(mode & constants.S_IROTH, 0)
})

test('FileReporter test with compression', async (t: TestContext) => {
  const TZ = process.env.TZ
  t.after(() => {
    process.env.TZ = TZ
  })
  process.env.TZ = 'Asia/Shanghai'

  const dir1 = join(tmpdir(), 'FileReporter.compression.brotli.test')
  const file1 = join(dir1, 'FileReporter.compression.log')
  await rm(dir1, { force: true, recursive: true })
  await mkdir(dir1)

  const dir2 = join(tmpdir(), 'FileReporter.compression.gzip.test')
  const file2 = join(dir2, 'FileReporter.compression.log')
  await rm(dir2, { force: true, recursive: true })
  await mkdir(dir2)

  t.mock.timers.enable({ apis: ['Date'] })
  // set time to 2024-11-11 00:00:00 (Beijing time)
  t.mock.timers.tick(new Date(2024, 10, 11, 0, 0, 0).getTime())

  const report1 = await createFileReporter(file1, {
    compression: 'brotli',
  })
  await report1('FileReporter1-1')
  t.mock.timers.tick(ONE_DAY)
  await report1('FileReporter1-2')
  await pipeline(
    createReadStream(join(dir1, 'FileReporter.compression.2024-11-11.log.br')),
    createBrotliDecompress(),
    createWriteStream(join(dir1, 'FileReporter.compression.2024-11-11.log')),
  )
  t.assert.strictEqual(
    await readFile(
      join(dir1, 'FileReporter.compression.2024-11-11.log'),
      'utf-8',
    ),
    'FileReporter1-1\n',
  )

  const report2 = await createFileReporter(file2, {
    compression: 'gzip',
    compressionOptions: {
      level: 0,
    },
  })
  await report2('FileReporter2-1'.repeat(100))
  t.mock.timers.tick(ONE_DAY)
  await report2('FileReporter2-2')
  await pipeline(
    createReadStream(join(dir2, 'FileReporter.compression.2024-11-12.log.gz')),
    createGunzip(),
    createWriteStream(join(dir2, 'FileReporter.compression.2024-11-12.log')),
  )
  t.assert.strictEqual(
    (await stat(join(dir2, 'FileReporter.compression.2024-11-12.log.gz'))).size,
    1524,
  )
  t.assert.strictEqual(
    await readFile(
      join(dir2, 'FileReporter.compression.2024-11-12.log'),
      'utf-8',
    ),
    `${'FileReporter2-1'.repeat(100)}\n`,
  )
})

test('FileReporter test with rotate', async (t: TestContext) => {
  const TZ = process.env.TZ
  t.after(() => {
    process.env.TZ = TZ
  })
  process.env.TZ = 'Asia/Shanghai'

  const dir1 = join(tmpdir(), 'FileReporter.rotate.test')
  const file1 = join(dir1, 'FileReporter.rotate.log')
  await rm(dir1, { force: true, recursive: true })
  await mkdir(dir1)

  const dir2 = join(tmpdir(), 'FileReporter.rotate.utc.test')
  const file2 = join(dir2, 'FileReporter.rotate.utc.log')
  await rm(dir2, { force: true, recursive: true })
  await mkdir(dir2)

  t.mock.timers.enable({ apis: ['Date'] })
  // set time to 2024-11-11 23:59:00 (Beijing time)
  t.mock.timers.tick(new Date(2024, 10, 11, 23, 59, 0).getTime())

  const report1 = await createFileReporter(file1, {
    maxKeepCount: 3,
  })
  await report1('FileReporter1-1')
  t.mock.timers.tick(ONE_DAY) // 2024-11-12
  await report1('FileReporter1-2')
  t.assert.strictEqual(
    await readFile(join(dir1, 'FileReporter.rotate.2024-11-11.log'), 'utf-8'),
    'FileReporter1-1\n',
  )
  t.mock.timers.tick(ONE_DAY) // 2024-11-13
  await report1('FileReporter1-3')
  t.mock.timers.tick(ONE_DAY) // 2024-11-14
  await report1('FileReporter1-4')
  t.mock.timers.tick(ONE_DAY) // 2024-11-15
  await report1('FileReporter1-5')
  t.mock.timers.tick(ONE_DAY) // 2024-11-16
  await report1('FileReporter1-6')
  t.assert.strictEqual(await readFile(file1, 'utf-8'), 'FileReporter1-6\n')
  const files = await readdir(dir1, 'utf-8')
  t.assert.ok(!files.includes('FileReporter.rotate.2024-11-11.log'))
  t.assert.ok(!files.includes('FileReporter.rotate.2024-11-12.log'))
  t.assert.ok(files.includes('FileReporter.rotate.2024-11-13.log'))
  t.assert.ok(files.includes('FileReporter.rotate.2024-11-14.log'))
  t.assert.ok(files.includes('FileReporter.rotate.2024-11-15.log'))

  // Test on UTC time

  const report2 = await createFileReporter(file2, {
    maxKeepCount: 3,
    utc: true,
  })
  await report2('FileReporter2-1')
  t.mock.timers.tick(ONE_MINUTE)
  await report2('FileReporter2-2')
  t.assert.strictEqual(
    await readFile(file2, 'utf-8'),
    'FileReporter2-1\nFileReporter2-2\n',
  )
  t.mock.timers.tick(ONE_HOUR * 8) // 2024-11-16 (utc)
  await report2('FileReporter2-3')
  t.assert.strictEqual(
    await readFile(
      join(dir2, 'FileReporter.rotate.utc.2024-11-16.log'),
      'utf-8',
    ),
    'FileReporter2-1\nFileReporter2-2\n',
  )
  t.assert.strictEqual(await readFile(file2, 'utf-8'), 'FileReporter2-3\n')
})

test('FileReporter test with not rotate', async (t: TestContext) => {
  const TZ = process.env.TZ
  t.after(() => {
    process.env.TZ = TZ
  })
  process.env.TZ = 'Asia/Shanghai'

  const file = join(tmpdir(), 'FileReporter.not_rotate.log')
  await rm(file, { force: true })

  t.mock.timers.enable({ apis: ['Date'] })
  // set time to 2024-11-11 23:59:00 (Beijing time)
  t.mock.timers.tick(new Date(2024, 10, 11, 23, 59, 0).getTime())

  const report = await createFileReporter(file, {
    rotate: false,
  })
  await report('FileReporter1-1')
  t.mock.timers.tick(ONE_DAY) // 2024-11-12
  await report('FileReporter1-2')
  t.mock.timers.tick(ONE_DAY) // 2024-11-13
  await report('FileReporter1-3')
  t.assert.strictEqual(
    await readFile(file, 'utf-8'),
    'FileReporter1-1\nFileReporter1-2\nFileReporter1-3\n',
  )
})
