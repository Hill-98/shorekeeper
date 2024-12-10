import type { Writable } from 'stream'
import type { Reporter } from '../index.ts'

export interface StreamReporterOptions {
  appendLf?: boolean
  encoding?: BufferEncoding
}

export function createStreamReporter(
  stream: Writable,
  options?: StreamReporterOptions,
): Reporter {
  let writable = true

  return function StreamReporter(data) {
    return new Promise<void>((resolve, reject) => {
      if (!stream.writable) {
        return reject(new Error('StreamReporter: stream not writable'))
      }

      if (!writable) {
        const onClose = () => {
          reject(new Error('StreamReporter: stream closed'))
        }
        stream.once('drain', () => {
          StreamReporter(data).then(resolve).catch(reject)
        })
        stream.once('close', onClose)
        stream.once('drain', stream.off.bind(stream, 'close', onClose))
        return
      }

      const callback = function streamReporterWriteCallback(err: any) {
        return err ? reject(err) : resolve()
      }

      if (typeof data === 'string') {
        writable = stream.write(
          options?.appendLf ? data.concat('\n') : data,
          options?.encoding ?? 'utf-8',
          callback,
        )
      } else {
        writable = stream.write(data, callback)
      }

      if (!writable) {
        stream.once('drain', () => {
          writable = true
        })
      }
    })
  }
}
