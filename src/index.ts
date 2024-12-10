import type { CallSite } from 'callsites'
import callsites from 'callsites'
import isPromise from 'is-promise'
import { DefaultConsoleModifier } from './DefaultConsoleModifier.ts'
import { DefaultFormatter } from './DefaultFormatter.ts'
import { toISOStringWithOffset } from './utils.ts'

export const ConsoleSymbol = Symbol('module:shorekeeper:symbol:console')

declare global {
  interface Console {
    [ConsoleSymbol]: Console
  }
}

export type ConsoleMethods = keyof Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info'
>

export type ConsoleLogLevel = Exclude<ConsoleMethods, 'log'> | 'notice'

export interface ConsoleModifierData {
  method: ConsoleMethods
  level: ConsoleLogLevel
  stacks?: CallSite[]
  time?: string
}

export type ConsoleModifier = (
  data: ConsoleModifierData,
  messages: any[],
) => any[]

export interface DefaultFormatterResult {
  level: ConsoleLogLevel
  message: any
  stacks?: {
    method: string | null
    source: string
  }
  time?: string
}

export interface FilterResult {
  call?: boolean
  report?: boolean
}

export type Filter = (
  level: ConsoleLogLevel,
  messages: any[],
  stacks?: CallSite[],
) => boolean | FilterResult

export interface FormatterData {
  level: ConsoleLogLevel
  stacks?: CallSite[]
  time?: string
}

export type Formatter = (
  data: FormatterData,
  ...messages: any[]
) => Uint8Array | string | Promise<Uint8Array | string>

export type Reporter<T = any> = (data: Uint8Array | string) => T

export interface Options {
  console: Console
  consoleModifier: boolean | ConsoleModifier
  filter?: Filter
  formatter: Formatter
  methods: ConsoleMethods[]
  reporters: Reporter[]
  source: boolean | string
  time: boolean
}

export type InitOptions = Partial<Options>

export {
  DefaultConsoleModifier,
  firstStackSource,
} from './DefaultConsoleModifier.ts'

export { DefaultFormatter } from './DefaultFormatter.ts'

export async function report(reporters: Reporter[], data: Uint8Array | string) {
  const errors: any[] = []
  for (const reporter of reporters) {
    try {
      const promise = reporter(data)
      if (isPromise(promise)) {
        await promise
      }
    } catch (err) {
      errors.push(err)
    }
  }
  if (errors.length !== 0) {
    // @ts-ignore NodeJS 14 no AggregateError
    const error = globalThis.AggregateError
      ? new AggregateError(errors, 'shorekeeper: Call reporter error')
      : new Error('shorekeeper: Call reporter error')
    if (!('errors' in error)) {
      Object.defineProperty(error, 'errors', {
        configurable: true,
        enumerable: false,
        value: errors,
        writable: true,
      })
    }
    throw error
  }
}

function callConsole(
  this: Console,
  method: ConsoleMethods,
  opts: Options,
  ...params: any[]
) {
  const time = opts.time ? toISOStringWithOffset(new Date()) : undefined
  const level: ConsoleLogLevel = method === 'log' ? 'notice' : method
  const stacks = opts.source !== false ? callsites().splice(1) : undefined
  const is = opts.filter ? opts.filter(level, params, stacks) : true

  if (is === false) {
    return
  }

  const isCall = typeof is === 'boolean' ? is : is.call
  const isReport = typeof is === 'boolean' ? is : is.report

  if (isCall) {
    this[method](
      ...(typeof opts.consoleModifier === 'function'
        ? opts.consoleModifier(
            {
              method,
              level,
              stacks,
              time,
            },
            params,
          )
        : params),
    )
  }

  if (isReport && opts.reporters.length !== 0) {
    const data = opts.formatter({ level, stacks, time }, ...params)
    const func = report.bind(null, opts.reporters)
    if (isPromise(data)) {
      data.then(func)
    } else {
      // noinspection JSIgnoredPromiseFromCall
      func(data)
    }
  }
}

export function init(options?: InitOptions) {
  const opts: Options = {
    console: globalThis.console,
    consoleModifier: true,
    formatter: DefaultFormatter,
    methods: ['error', 'debug', 'info', 'log', 'warn'],
    reporters: [],
    source: false,
    time: true,
    ...(options ?? {}),
  }

  if (
    typeof opts.source === 'string' &&
    opts.source.match(/^[A-Za-z0-9+-.]+:\/\//) === null
  ) {
    let source = opts.source.replaceAll('\\', '/')
    if (!source.startsWith('/')) {
      source = `/${source}`
    }
    if (!source.endsWith('/')) {
      source += '/'
    }
    opts.source = `file://${source}`
  }

  if (opts.consoleModifier === true) {
    opts.consoleModifier = DefaultConsoleModifier.bind(null, {
      source: opts.source !== false,
      sourcePrefix: typeof opts.source === 'string' ? opts.source : undefined,
      time: opts.time,
    })
  }

  if (ConsoleSymbol in opts.console) {
    Object.defineProperties(
      opts.console,
      Object.getOwnPropertyDescriptors(opts.console[ConsoleSymbol]),
    )
  } else {
    Object.defineProperty(opts.console, ConsoleSymbol, {
      configurable: true,
      enumerable: false,
      value: Object.create(
        Object.getPrototypeOf(opts.console),
        Object.getOwnPropertyDescriptors(opts.console),
      ),
      writable: false,
    })
  }

  for (const method of opts.methods) {
    Object.defineProperty(opts.console, method, {
      ...Object.getOwnPropertyDescriptor(opts.console, method),
      value: callConsole.bind(console[ConsoleSymbol], method, opts),
    })
  }
}
