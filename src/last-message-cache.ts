import { getInMemoryCacheMap } from './process-state'
import { BotContext } from './types'

export async function saveLastMessageTimestamp(
  context: BotContext,
  id: string,
) {
  getInMemoryCacheMap(context, 'lastMessageTimestamp').set(id, Date.now())
}

export async function getLastMessageTimestampMap(context: BotContext) {
  return getInMemoryCacheMap(context, 'lastMessageTimestamp') as Map<
    string,
    number
  >
}
