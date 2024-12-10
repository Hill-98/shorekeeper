import type { CallSite } from 'callsites'
import type { CallData } from './index.ts'

export interface DefaultConsoleModifierOptions {
  source?: boolean
  sourcePrefix?: string
  time?: boolean
}

export function firstStackSource(
  stacks?: CallSite[],
  trimPrefix?: string,
): string | undefined {
  const firstStack = stacks ? stacks[0] : undefined

  if (firstStack) {
    let filename = firstStack.getFileName()
    if (typeof trimPrefix === 'string' && typeof filename === 'string') {
      filename = filename.replace(trimPrefix, '')
    }
    return `${filename}:${firstStack.getLineNumber()}:${firstStack.getColumnNumber()}`
  }
  return firstStack
}

export function DefaultConsoleModifier(
  opts: DefaultConsoleModifierOptions,
  data: CallData,
  messages: any[],
) {
  return [
    ...[
      opts.time ? data.time : null,
      data.level.toUpperCase(),
      opts.source ? firstStackSource(data.stacks, opts.sourcePrefix) : null,
    ]
      .filter((v) => !!v)
      .map((v) => `[${v}]`),
    ...messages,
  ]
}
