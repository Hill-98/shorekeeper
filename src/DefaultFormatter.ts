import type { CallSite } from 'callsites'
import { serializeError } from 'serialize-error'
import type { FormatterData } from './index.ts'

function serialize(...params: any[]) {
  if (params.length === 0) {
    return
  }

  if (params.length > 1) {
    const results = []
    for (const param of params) {
      results.push(serialize(param))
    }
    return serialize(results)
  }

  const param = params[0]
  if (typeof param === 'object' && typeof param.toJSON === 'function') {
    return JSON.parse(param.toJSON())
  }
  if (param instanceof Error) {
    return serializeError(param)
  }
  return param
}

function serializeStacks(stacks: CallSite[]) {
  return stacks.map((s) => {
    const typeName = s.getTypeName()
    const methodName = s.getMethodName() ?? s.getFunctionName() ?? '<anonymous>'
    return {
      method: s.isToplevel()
        ? null
        : `${typeName ? typeName.concat('.') : ''}${methodName}`,
      source: `${s.getFileName()}:${s.getLineNumber()}:${s.getColumnNumber()}`,
    }
  })
}

export function DefaultFormatter(
  data: FormatterData,
  ...messages: any[]
): string {
  return JSON.stringify({
    level: data.level.toLowerCase(),
    message: serialize(...messages),
    stacks: data.stacks ? serializeStacks(data.stacks) : data.stacks,
    time: data.time,
  })
}
