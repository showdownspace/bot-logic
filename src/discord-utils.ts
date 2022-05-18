import { guildId } from './config'
import { BotContext } from './types'

export function getDiscordUserName(context: BotContext, id: string) {
  const fallback = 'Discord user ' + id
  const guild = context.client.guilds.cache.get(guildId)
  const member = guild?.members.cache.get(id)
  return member?.user.tag ?? fallback
}
