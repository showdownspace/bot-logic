import { definePlugin } from './bot'
import { sendEmailVerificationRequest, verifyEmail } from './email-verification'
import { enhanceError } from './enhance-error'
import {
  getGitHubAuthorizeUrl,
  getGitHubProfile,
  verifyGitHubCode,
} from './github-linking'
import { verifyIdToken } from './id-token'
import { syncProfile } from './profile'

export default definePlugin((bot) => {
  bot.handleCommand('/profile', async (context, interaction, reply) => {
    const profile = await syncProfile(context, interaction.user, {})
    await reply
      .withEmbeds(
        {
          title: 'Discord',
          color: 0x5865f2,
          description: profile.discordTag,
        },
        {
          title: 'GitHub',
          color: 0x24292e,
          description: profile.githubUser
            ? `@${profile.githubUser.login}`
            : '(Not linked)',
          url: profile.githubUser
            ? `https://github.com/${profile.githubUser.login}`
            : undefined,
        },
      )
      .withComponents({
        type: 'ACTION_ROW',
        components: [
          {
            type: 'BUTTON',
            style: profile.githubUser ? 'SECONDARY' : 'PRIMARY',
            customId: profile.githubUser ? 'unlink-github' : 'link-github',
            label: profile.githubUser
              ? 'Unlink GitHub user'
              : 'Link GitHub user',
          },
        ],
      })
      .ok(
        'Here is your profile: ```' +
          JSON.stringify(profile, null, 2) +
          '```\n',
      )
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
    const { db } = context
    const query = request.query as Record<string, string>
    const code = String(query.code)
    const state = String(query.state)
    const owner = await verifyIdToken(
      state,
      'showdownspace-bot/github-linking',
    ).catch(enhanceError('Unable to verify ID token'))
    const { accessToken } = await verifyGitHubCode(code)
    const user = await getGitHubProfile(accessToken)
    await db.collection('profiles').updateOne(
      { _id: `discord${owner.discordId}` },
      {
        $set: {
          discordUserId: owner.discordId,
          discordTag: owner.discordTag,
          githubUser: {
            login: user.login,
            id: user.id,
            avatar_url: user.avatar_url,
            name: user.name,
          },
        },
      },
      { upsert: true },
    )
    return `Successfully linked GitHub account "@${user.login}" for Discord user "${owner.discordTag}"`
  })
  bot.handleButton('unlink-github', async (context, interaction, reply) => {
    await syncProfile(context, interaction.user, { githubUser: null })
    await reply.ok(`Unassociated your GitHub account from your Discord ID.`)
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
})
