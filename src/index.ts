import type { CallSite } from 'callsites'
import callsites from 'callsites'
import isPromise from 'is-promise'
import DefaultFormatter from './DefaultFormatter.ts'
import { toISOStringWithOffset } from './utils.ts'

export type ConsoleMethods = keyof Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info'
>

export type ConsoleLogLevel = Exclude<ConsoleMethods, 'log'> | 'notice'

export interface FormatterData {
  level: ConsoleLogLevel
  stacks?: CallSite[]
  time?: string
}

export interface DefaultFormatterResult {
  level: ConsoleLogLevel
  message: any
  stacks: {
    method: string | null
    source: string
  }
  time: string
}

export type ConsoleModifier = (
  method: ConsoleMethods,
  messages: any[],
  stacks?: CallSite[],
) => any[]

export type Filter = (
  level: ConsoleLogLevel,
  messages: any[],
  stacks?: CallSite[],
) => boolean | FilterResult

export type Formatter = (
  data: FormatterData,
  ...messages: any[]
) => Uint8Array | string | Promise<Uint8Array | string>

export type Reporter<T = any> = (data: Uint8Array | string) => T

export interface FilterResult {
  call?: boolean
  report?: boolean
}

export interface Options {
  console: Console
  consoleModifier: boolean | ConsoleModifier
  filter?: Filter
  formatter: Formatter
  methods: ConsoleMethods[]
  reporters: Reporter[]
  source: boolean | string
  timestamp: boolean
}

export type InitOptions = Partial<Options>

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
  const level: ConsoleLogLevel = method === 'log' ? 'notice' : method
  const stacks = opts.source ? callsites().splice(1) : undefined
  const is = opts.filter ? opts.filter(level, params, stacks) : true

  if (is === false) {
    return
  }

  const isCall = typeof is === 'boolean' ? is : is.call
  const isReport = typeof is === 'boolean' ? is : is.report
  const time =
    opts.timestamp && (isCall || isReport)
      ? toISOStringWithOffset(new Date())
      : undefined

  if (isCall) {
    if (opts.consoleModifier === true) {
      let source: string | undefined
      try {
        source = firstStackSource(
          stacks,
          typeof opts.source === 'string' ? opts.source : undefined,
        )
      } catch (err) {
        this.error(err)
      }
      this[method](
        ...[time, level.toUpperCase(), source]
          .filter((v) => !!v)
          .map((v) => `[${v}]`),
        ...params,
      )
    } else if (typeof opts.consoleModifier === 'function') {
      this[method](...opts.consoleModifier(method, params, stacks))
    } else {
      this[method](...params)
    }
  }

  if (isReport && opts.reporters.length !== 0) {
    try {
      const data = opts.formatter({ level, stacks, time }, ...params)
      const func = report.bind(null, opts.reporters)
      if (isPromise(data)) {
        data.then(func).catch(this.error)
      } else {
        func(data).catch(this.error)
      }
    } catch (err) {
      this.error(err)
    }
  }
}

const consoleSymbol = Symbol('module:shorekeeper:symbol:console')

export function init(options?: InitOptions) {
  const opts: Options = {
    console: globalThis.console,
    consoleModifier: true,
    formatter: DefaultFormatter,
    methods: ['error', 'debug', 'info', 'log', 'warn'],
    reporters: [],
    source: false,
    timestamp: true,
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

  if (consoleSymbol in opts.console) {
    Object.defineProperties(
      opts.console,
      Object.getOwnPropertyDescriptors(opts.console[consoleSymbol]),
    )
  } else {
    Object.defineProperty(opts.console, consoleSymbol, {
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
      value: callConsole.bind(opts.console, method, opts),
    })
  }
}
