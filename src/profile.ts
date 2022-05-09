import { User } from 'discord.js'
import { BotContext } from './types'

export interface ProfileEntity {
  _id: string
  discordUserId: string
  discordTag: string
  githubUser?: {
    login: string
    id: number
    avatar_url: string
    name: string
  } | null
  proposedEmail?: string | null
  email?: string
}

export async function syncProfile(
  context: BotContext,
  user: User,
  fieldsToSet: Partial<ProfileEntity>,
) {
  const { db } = context
  const result = await db
    .collection<ProfileEntity>('profiles')
    .findOneAndUpdate(
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
