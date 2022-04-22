import { Interaction, Message } from 'discord.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import axios from 'axios'

import { inspect } from 'util'
import {
  getGitHubAuthorizeUrl,
  getGitHubProfile,
  verifyGitHubCode,
} from './github-linking'
import { verifyIdToken } from './id-token'
import { enhanceError } from './enhance-error'
import { deployCommands } from './deploy-commands'
import { encrypted } from './encrypted'
import { BotContext } from './types'
import { syncProfile } from './profile'
import { sendEmailVerificationRequest, verifyEmail } from './email-verification'

export async function handleInteraction(
  context: BotContext,
  interaction: Interaction,
) {
  const { db, log } = context

  if (!interaction.guild) return

  if (interaction.isCommand()) {
    const { commandName } = interaction
    const subcommand = interaction.options.getSubcommand()
    log.info(
      { commandName, subcommand, user: interaction.user.tag },
      'Command interaction received',
    )
    if (commandName === 'showdown') {
      if (subcommand === 'ping') {
        await interaction.reply({
          content: `:white_check_mark: pong`,
          ephemeral: true,
        })
      } else if (subcommand === 'profile') {
        const result = await db.collection('profiles').findOneAndUpdate(
          { _id: `discord${interaction.user.id}` },
          {
            $set: {
              discordUserId: interaction.user.id,
              discordTag: interaction.user.tag,
            },
          },
          { upsert: true, returnDocument: 'after' },
        )
        const profile = result.value!
        await interaction.reply({
          content: '```' + JSON.stringify(profile, null, 2) + '```',
          components: [
            {
              type: 'ACTION_ROW',
              components: [
                {
                  type: 'BUTTON',
                  style: profile.githubUser ? 'SECONDARY' : 'PRIMARY',
                  customId: profile.githubUser
                    ? 'unlink-github'
                    : 'link-github',
                  label: profile.githubUser
                    ? 'Unlink GitHub user'
                    : 'Link GitHub user',
                },
              ],
            },
          ],
          ephemeral: true,
        })
      } else if (subcommand === 'set') {
        const key = interaction.options.getString('key')
        const value = interaction.options.getString('value')

        if (key === 'email') {
          await db.collection('profiles').updateOne(
            { _id: `discord${interaction.user.id}` },
            {
              $set: {
                discordUserId: interaction.user.id,
                discordTag: interaction.user.tag,
                proposedEmail: value,
              },
            },
            { upsert: true },
          )
          await interaction.reply({
            content: `:white_check_mark: Thank you, your email address has been saved.`,
            ephemeral: true,
          })
        } else {
          await interaction.editReply({
            content: `**Error:** Unknown profile key ${key}`,
          })
        }
      } else if (subcommand === 'register-email') {
        const email = interaction.options.getString('email')
        await interaction.reply({
          content: `:hourglass_flowing_sand: Saving your email address and sending a verification email...`,
          ephemeral: true,
        })
        await syncProfile(context, interaction.user, {
          proposedEmail: email,
        })
        await sendEmailVerificationRequest(email!)
        await interaction.editReply({
          content:
            `:pleading_face: **Please verify your email address.**\n` +
            `You will get an OTP in your email. Please use the \`/showdown verify-email\` command to submit your OTP.`,
        })
      } else if (subcommand === 'verify-email') {
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
          log.error({ err: error })
          await interaction.editReply({
            content: `:x: **Unable to verify your email address.** Please try again.`,
          })
        }
      }
    } else if (commandName === 'answer') {
      await db.collection('answer_buzzes').insertOne({
        timestamp: new Date().toISOString(),
        discordUserId: interaction.user.id,
        discordGuildId: interaction.guild.id,
        answer: subcommand.toUpperCase(),
      })
      await interaction.reply({
        content: `:ok_hand: Received answer choice “${subcommand.toUpperCase()}”`,
        ephemeral: true,
      })
    }
  } else if (interaction.isButton()) {
    log.info(
      { customId: interaction.customId, user: interaction.user.tag },
      'Button interaction received',
    )
    if (interaction.customId === 'link-github') {
      const url = await getGitHubAuthorizeUrl(interaction.user)
      await interaction.reply({
        content: `:pleading_face: Please go to this URL to link your GitHub account: :arrow_down:\n${url}`,
        ephemeral: true,
      })
    } else if (interaction.customId === 'unlink-github') {
      const user = interaction.user
      await db
        .collection('profiles')
        .updateOne({ _id: `discord${user.id}` }, { $unset: { githubUser: '' } })
      await interaction.reply({
        content: `:pleading_face: Unassociated your GitHub account from your Discord ID.`,
        ephemeral: true,
      })
    }
  }
}

export async function handleMessage(context: BotContext, message: Message) {
  const { client, db, log } = context

  if (message.partial) {
    log.info('Received a partial message!')
    message = await message.fetch()
  }

  if (message.author.bot) {
    return
  }

  if (!message.guild) {
    message.reply(`Sorry, I no longer accept DMs :pleading_face:`)
    return
  }

  const guild = message.guild
  let isAdmin = message.author.id === '104986860236877824'

  {
    let m = message.content.match(
      /^\s*<@965531868625776671>\s*```js\s*([^]*)\s*```\s*$/,
    )
    if (isAdmin && m) {
      const fn = new Function('ctx', 'code', 'with(ctx){return eval(code)}')
      let replyText = ''
      try {
        const result = await fn(
          {
            message,
            client,
            guild,
            db,
            axios,
            encrypted,
            log: log.child({ name: 'code-eval' }),
            deployCommands: () => deployCommands(context),
          },
          m[1],
        )
        replyText = '```\n' + inspect(result) + '\n```'
      } catch (error) {
        replyText = '```\n' + String(error) + '\n```'
        log.error({ err: error }, 'Code evaluation failed')
      }
      message.reply(replyText)
      return
    }
  }

  // if (message.mentions.has(client.user) && !message.author.bot && message.guild.id === guildId) {
  //   console.log(`[${new Date().toJSON()}] ${message.author.tag} Message=>`, message)

  //   message.reply(`heyo`)
  // }
}

export async function handleHttpRequest(
  context: BotContext,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { db } = context
  const query = request.query as Record<string, string | undefined>

  if (query.action === 'callback/github') {
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
  }

  if (query.action === 'encrypt') {
    const text = (request.body as Record<string, string> | undefined)?.text
    if (text) {
      return 'encrypted`' + encrypted.encrypt(String(text)) + '`'
    }
    reply.header('Content-Type', 'text/html')
    return `<html><form method="post">
    <textarea name="text" rows="10" cols="80"></textarea>
    <input type="submit" value="Encrypt" />`
  }

  return 'unknown action'
}
