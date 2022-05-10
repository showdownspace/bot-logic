import { Comparator } from '@dtinth/comparator'
import { TextChannel, User } from 'discord.js'
import throttle from 'lodash.throttle'
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

export async function findGitHubInfo(
  context: BotContext,
  discordUserIds?: string[],
) {
  const { db } = context
  return db
    .collection<ProfileEntity>('profiles')
    .find({
      'githubUser.login': { $exists: true },
      ...(discordUserIds
        ? { _id: { $in: discordUserIds.map((id) => `discord${id}`) } }
        : {}),
    })
    .project<
      Pick<ProfileEntity, '_id' | 'discordUserId' | 'discordTag' | 'githubUser'>
    >({
      _id: true,
      discordUserId: true,
      discordTag: true,
      githubUser: true,
    })
    .toArray()
}

async function doSyncGitHubDirectory(context: BotContext) {
  try {
    const messageIds = [
      '973597769518415892',
      '973597790255058944',
      '973598007238991882',
      '973598011886272562',
      '973598017020133436',
      '973598021839364186',
      '973598026637660190',
      '973598031448506429',
      '973598036339089439',
      '973598040726315109',
      '973598045608480788',
      '973598050507432047',
      '973598055284748308',
      '973598060351488100',
      '973598065116205067',
      '973598070015152220',
      '973598074750504990',
      '973598079867572225',
      '973598084749754379',
      '973598089585770567',
    ]
    const info = await findGitHubInfo(context)
    const channel = (await context.client.guilds
      .resolve(guildId)!
      .channels.fetch('973597074354483230')!) as TextChannel
    const last = await channel.messages.fetch(messageIds.pop()!)
    await last.edit(
      '**To link your GitHub account and appear on this list, run the `/profile` slash command.**',
    )

    const listMessage = await channel.messages.fetch(messageIds.pop()!)
    const text = info
      .map((data) => {
        const login = data.githubUser!.login
        const suffix = '' // data.githubUser!.name ? ` (${data.githubUser!.name})` : ''
        return [
          `・ <@${data.discordUserId}> — https://github.com/${login}${suffix}`,
          data.discordTag,
        ]
      })
      .sort(Comparator.comparing((x) => x[1].toLowerCase()))
      .map((x) => x[0])
    await listMessage.edit({
      content: text.join('\n'),
    })
    return info
  } catch (error) {
    context.log.error({ err: error }, 'Unable to sync GitHub directory')
  }
}

export const syncGitHubDirectory = throttle(doSyncGitHubDirectory, 10000)
