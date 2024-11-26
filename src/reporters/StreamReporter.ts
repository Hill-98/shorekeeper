import type { Reporter } from '../index.ts'

export function createStreamReporter(
  stream: NodeJS.WritableStream,
  autoAppendLf = true,
): Reporter<Promise<void>> {
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

      writable = stream.write(
        autoAppendLf && typeof data === 'string' ? data.concat('\n') : data,
        (err) => (err ? reject(err) : resolve()),
      )

      if (!writable) {
        stream.once('drain', () => {
          writable = true
        })
      }
    })
  }
}
