import { User } from 'discord.js'
import { guildId } from './config'
import { BotContext } from './types'

export interface ProfileEntity {
  _id: string
  discordUserId: string
  discordTag: string
  discordNickname?: string | null
  githubUser?: {
    login: string
    id: number
    avatar_url: string
    name: string
  } | null
  hideInRanking?: boolean
  proposedEmail?: string | null
  email?: string
}

export async function syncProfile(
  context: BotContext,
  user: Pick<User, 'id' | 'tag'>,
  fieldsToSet: Partial<ProfileEntity>,
) {
  const { db } = context
  const nickname = await context.client.guilds
    .resolve(guildId)
    ?.members.fetch(user.id)
    .then((member) => {
      return member.nickname
    })
    .catch((err) => {
      context.log.error({ err }, 'Unable to fetch member ' + user.id)
    })
  if (nickname) {
    fieldsToSet.discordNickname = nickname
  }
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
