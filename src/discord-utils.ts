import { guildId } from './config'
import { BotContext } from './types'

export function getDiscordUserName(context: BotContext, id: string) {
  const fallback = 'Discord user ' + id
  const guild = getDiscordGuild(context)
  const member = guild?.members.cache.get(id)
  return member?.user.tag ?? fallback
}

export function getDiscordGuild(context: BotContext) {
  const guild = context.client.guilds.cache.get(guildId)
  if (!guild) {
    throw new Error('Unable to find Discord guild ' + guildId)
  }
  return guild
}
