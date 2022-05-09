import { BotContext } from './types'

export function getInMemoryCacheMap(
  context: BotContext,
  ns: string,
): Map<any, any> {
  return (context.processState['cache:' + ns] ??= new Map())
}
