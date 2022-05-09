import type { User } from 'discord.js'
import { BotContext } from './types'

export function getRtSysToken(
  context: BotContext,
  user: User,
  extraClaims: Record<string, any> = {},
) {
  return context.firebaseAdmin
    .auth()
    .createCustomToken(`discord${user.id}`, { name: user.tag, ...extraClaims })
}
