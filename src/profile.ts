import { User } from 'discord.js'
import { BotContext } from './types'

export async function syncProfile(
  context: BotContext,
  user: User,
  fieldsToSet: Record<string, any>,
) {
  const { db } = context
  const result = await db.collection('profiles').findOneAndUpdate(
    { _id: `discord${user.id}` },
    {
      $set: {
        discordUserId: user.id,
        discordTag: user.tag,
        ...fieldsToSet,
      },
    },
    { upsert: true, returnDocument: 'after' },
  )
  return result.value!
}
