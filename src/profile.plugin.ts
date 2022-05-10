import { definePlugin, Reply } from './bot'
import { sendEmailVerificationRequest, verifyEmail } from './email-verification'
import { enhanceError } from './enhance-error'
import {
  getGitHubAuthorizeUrl,
  getGitHubProfile,
  verifyGitHubCode,
} from './github-linking'
import { verifyIdToken } from './id-token'
import { MapMemo, MemoSlot, StrongMemo } from './memo-tools'
import { getInMemoryCacheMap } from './process-state'
import { findGitHubInfo, ProfileEntity, syncProfile } from './profile'
import { BotContext } from './types'

function getProfileReplyCache(context: BotContext) {
  return new MapMemo<string, MemoSlot<Reply>>(
    getInMemoryCacheMap(context, 'profileReply'),
    (uid) => new MemoSlot({ ttl: 600e3 }),
  )
}

function getNameInRanking(profile: ProfileEntity): string {
  if (profile.hideInRanking) {
    return `(anonymous)`
  }
  const suffix = (x: string | null | undefined) => (x ? ` (${x})` : '')
  if (profile.githubUser) {
    return `@${profile.githubUser.login}${suffix(profile.githubUser.name)}`
  }
  return profile.discordTag + suffix(profile.discordNickname)
}

export default definePlugin((bot) => {
  async function displayProfile(
    context: BotContext,
    profile: ProfileEntity,
    reply: Reply,
  ) {
    await reply
      .withEmbeds({
        title: profile.discordTag,
        color: 0xffcf56,
        description: '',
        fields: [
          {
            name: 'GitHub',
            value: profile.githubUser
              ? `↳ [@${profile.githubUser.login}](https://github.com/${profile.githubUser.login})`
              : '↳ (Not linked)',
            inline: true,
          },
          {
            name: 'Name in ranking',
            value: `↳ ${getNameInRanking(profile)}`,
            inline: true,
          },
        ],
      })
      .withComponents({
        type: 'ACTION_ROW',
        components: [
          profile.githubUser
            ? {
                type: 'BUTTON',
                style: 'SECONDARY',
                customId: 'unlink-github',
                label: 'Unlink GitHub user',
              }
            : {
                type: 'BUTTON',
                style: 'PRIMARY',
                customId: 'link-github',
                label: 'Link GitHub user',
              },
          profile.hideInRanking
            ? {
                type: 'BUTTON',
                style: 'PRIMARY',
                customId: 'show-in-ranking',
                label: 'Show my name in ranking pages',
              }
            : {
                type: 'BUTTON',
                style: 'SECONDARY',
                customId: 'hide-in-ranking',
                label: 'Hide my name in ranking pages',
              },
        ],
      })
      .ok('Here is your profile info:')
  }

  async function updateProfileReplyIfExist(
    context: BotContext,
    profile: ProfileEntity,
  ) {
    const reply = getProfileReplyCache(context).get(profile._id).get()
    if (reply) {
      await displayProfile(context, profile, reply).catch((e) => {
        context.log.error({ err: e }, 'Unable to update profile reply')
      })
    }
  }

  bot.handleCommand('/profile', async (context, interaction, reply) => {
    const profile = await syncProfile(context, interaction.user, {})
    displayProfile(context, profile, reply)
    getProfileReplyCache(context).get(profile._id).set(reply)
  })
  bot.handleButton('link-github', async (context, interaction, reply) => {
    const url = await getGitHubAuthorizeUrl(interaction.user)
    await reply
      .withLink('Click here to link your GitHub account', url, url)
      .please(
        `Please click the link below to link your GitHub account: :arrow_down:`,
      )
  })
  bot.handleHttpAction('callback/github', async (context, request, reply) => {
    const query = request.query as Record<string, string>
    const code = String(query.code)
    const state = String(query.state)
    const owner = await verifyIdToken(
      state,
      'showdownspace-bot/github-linking',
    ).catch(enhanceError('Unable to verify ID token'))
    const { accessToken } = await verifyGitHubCode(code)
    const user = await getGitHubProfile(accessToken)
    const profile = await syncProfile(
      context,
      { id: owner.discordId, tag: owner.discordTag },
      {
        githubUser: {
          login: user.login,
          id: user.id,
          avatar_url: user.avatar_url,
          name: user.name,
        },
      },
    )
    await updateProfileReplyIfExist(context, profile)
    return `Successfully linked GitHub account "@${user.login}" for Discord user "${owner.discordTag}"`
  })
  bot.handleButton('unlink-github', async (context, interaction, reply) => {
    const profile = await syncProfile(context, interaction.user, {
      githubUser: null,
    })
    await updateProfileReplyIfExist(context, profile)
    await reply.ok(`Unassociated your GitHub account from your Discord ID.`)
  })
  bot.handleButton('hide-in-ranking', async (context, interaction, reply) => {
    const profile = await syncProfile(context, interaction.user, {
      hideInRanking: true,
    })
    await updateProfileReplyIfExist(context, profile)
    await reply.ok(
      `Your name will be hidden in ranking pages.\n` +
        `**Note:** This only applies to the ranking page; your name will still be visible in the live stream. This setting will not affect past events.`,
    )
  })
  bot.handleButton('show-in-ranking', async (context, interaction, reply) => {
    const profile = await syncProfile(context, interaction.user, {
      hideInRanking: false,
    })
    await updateProfileReplyIfExist(context, profile)
    await reply.ok(`Your name will be shown in ranking pages.`)
  })

  bot.handleCommand(
    '/showdown register-email',
    async (context, interaction, reply) => {
      const email = interaction.options.getString('email')
      await reply.wait(
        'Saving your email address and sending a verification email...',
      )
      await syncProfile(context, interaction.user, {
        proposedEmail: email,
      })
      await sendEmailVerificationRequest(email!)
      await reply.please(
        `**Please verify your email address.**\n` +
          `You will get an OTP in your email. Please use the \`/showdown verify-email\` command to submit your OTP.`,
      )
    },
  )
  bot.handleCommand(
    '/showdown verify-email',
    async (context, interaction, reply) => {
      const otp = interaction.options.getString('otp')
      await interaction.reply({
        content: `:hourglass_flowing_sand: Verifying your OTP...`,
        ephemeral: true,
      })
      const profile = await syncProfile(context, interaction.user, {})
      if (!profile.proposedEmail) {
        await interaction.editReply({
          content: `:x: **No email address has been registered.** Please use the \`/showdown register-email\` command to register an email address first.`,
        })
        return
      }
      try {
        await verifyEmail(profile.proposedEmail, otp!)
        await interaction.editReply({
          content: `:white_check_mark: **Email address verified.** Thank you!`,
        })
        await syncProfile(context, interaction.user, {
          email: profile.proposedEmail,
        })
      } catch (error) {
        context.log.error({ err: error }, 'Unable to verify email')
        await interaction.editReply({
          content: `:x: **Unable to verify your email address.** Please try again.`,
        })
      }
    },
  )
  bot.handleCommand('/github', async (context, interaction, reply) => {
    //   db.collection('profiles').find({ 'githubUser.login': { $exists: true } })
    // .project({ discordUserId: true, githubUser: true })
    // .toArray()
    const users = interaction.options.getString('users', false) || ''
    const mentions = Array.from(users.matchAll(/<@!?(\d+)>/g)).map(
      (mention) => `${mention[1]}`,
    )

    const targetUserIds = mentions.length
      ? mentions
      : await interaction.guild!.members.fetch().then((m) =>
          Array.from(m.values())
            .filter((m) => {
              const s = m.presence?.status
              return s && s !== 'offline'
            })
            .map((x) => x.id),
        )
    const githubInfo = await findGitHubInfo(context, targetUserIds)
    const list = githubInfo
      .map((g) => {
        return `\n<@${g.discordUserId}> - @${g.githubUser!.login}`
      })
      .join('')
    reply.ok(`Number of users found: ${githubInfo.length}${list}`)
  })
})
