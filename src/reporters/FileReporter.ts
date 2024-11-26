import { createReadStream, createWriteStream, readdir, rm, truncate } from 'fs'
import type { ParsedPath } from 'path'
import { join, parse, resolve } from 'path'
import type { Writable } from 'stream'
import { pipeline } from 'stream'
import { promisify } from 'util'
import type { BrotliOptions, ZlibOptions } from 'zlib'
import { createBrotliCompress, createGzip } from 'zlib'
import escapeRegExp from 'lodash.escaperegexp'
import { isLastDateEarlier, toDateString } from '../utils.ts'
import { createStreamReporter } from './StreamReporter.ts'

export interface FileReporterOptions {
  maxKeepCount?: number
  mode?: number
  rotate?: boolean
  utc?: boolean
}

export interface FileReporterOptionsWithBrotli extends FileReporterOptions {
  compression: 'brotli'
  compressionOptions?: BrotliOptions
}

export interface FileReporterOptionsWithGzip extends FileReporterOptions {
  compression: 'gzip'
  compressionOptions?: ZlibOptions
}

export type Options =
  | FileReporterOptions
  | FileReporterOptionsWithBrotli
  | FileReporterOptionsWithGzip

class FileReporter {
  static readonly StreamWriteSymbol = Symbol(
    'module:shorekeeper:symbol:stream:write',
  )

  readonly #file: string

  readonly #opts: Options & Required<FileReporterOptions> = {
    maxKeepCount: 7,
    mode: 0o644,
    rotate: true,
    utc: false,
  }

  readonly #path: ParsedPath

  readonly stream: Writable

  #lastDate: Date = new Date()

  constructor(file: string, options?: Options) {
    this.#file = resolve(file)
    this.#opts = {
      ...this.#opts,
      ...(options ?? {}),
    }
    this.#path = parse(this.#file)
    this.stream = createWriteStream(this.#file, {
      flags: 'a',
      mode: this.#opts.mode,
    })
    this.stream._write = this.#write.bind(this, this.stream, this.stream._write)
  }

  async #clean() {
    const regex = new RegExp(
      `^${escapeRegExp(this.#path.name)}\\.(\\d{4}-\\d{2}-\\d{2})\\.`,
    )
    const filenames = await promisify(readdir)(this.#path.dir, 'utf-8')
    const archivedFiles: { file: string; date: Date }[] = []

    for (const filename of filenames) {
      const matches = filename.match(regex)
      if (matches !== null) {
        const numbers = matches[1].split('-').map((v) => Number.parseInt(v))
        const date = new Date(numbers[0], numbers[1], numbers[2])
        archivedFiles.push({
          file: join(this.#path.dir, filename),
          date,
        })
      }
    }

    if (this.#opts.maxKeepCount < archivedFiles.length) {
      const deleteFiles = archivedFiles
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .splice(0, archivedFiles.length - this.#opts.maxKeepCount)
        .map((item) => item.file)
      for (const deleteFile of deleteFiles) {
        await promisify(rm)(deleteFile)
      }
    }
  }

  async #rotate() {
    const compression =
      'compression' in this.#opts ? this.#opts.compression : undefined
    const compressionOptions =
      'compressionOptions' in this.#opts
        ? this.#opts.compressionOptions
        : undefined
    const dateStr = toDateString(this.#lastDate, this.#opts.utc)
    const streams: Writable[] = []
    let newFile = join(
      this.#path.dir,
      `${this.#path.name}.${dateStr}${this.#path.ext}`,
    )

    if (compression === 'brotli') {
      streams.push(createBrotliCompress(compressionOptions))
      newFile = `${newFile}.br`
    } else if (compression === 'gzip') {
      streams.push(createGzip(compressionOptions))
      newFile = `${newFile}.gz`
    }

    streams.push(
      createWriteStream(newFile, {
        flags: 'w',
        mode: this.#opts.mode,
      }),
    )
    await promisify(pipeline)([createReadStream(this.#file), ...streams])
    await promisify(truncate)(this.#file, 0)
  }

  #touch(date: Date) {
    this.#lastDate = date
  }

  #write(
    stream: Writable,
    write: Writable['_write'],
    ...args: Parameters<Writable['_write']>
  ): ReturnType<Writable['_write']> {
    const w = write.bind(stream, ...args)
    if (this.#opts.rotate) {
      const date = new Date()
      if (isLastDateEarlier(this.#lastDate, date, this.#opts.utc)) {
        this.#rotate().then(this.#clean.bind(this)).then(w).catch(args[2])
        this.#touch(date)
        return
      }
      this.#touch(date)
    }
    w()
  }
}

export async function createFileReporter(file: string, options?: Options) {
  return createStreamReporter(new FileReporter(file, options).stream)
}
