import type { Client, Interaction, Message } from 'discord.js'
import type { Db } from 'mongodb'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { inspect } from 'util'
import { SlashCommandBuilder } from '@discordjs/builders'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'
import { clientId, guildId } from './config'
import {
  getGitHubAuthorizeUrl,
  getGitHubProfile,
  verifyGitHubCode,
} from './github-linking'
import { verifyIdToken } from './id-token'
import { enhanceError } from './enhance-error'

interface BotContext {
  discordToken: string
  client: Client
  db: Db
  fastify: FastifyInstance
}

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [showdownspace-bot] ${message}`)
}

export async function handleInteraction(
  context: BotContext,
  interaction: Interaction,
) {
  const { db } = context
  if (!interaction.isCommand()) return

  const { commandName } = interaction
  if (commandName === 'showdown') {
    const subcommand = interaction.options.getSubcommand()
    log(`Received command "${subcommand}" from ${interaction.user.tag}`)
    if (subcommand === 'ping') {
      await interaction.reply({
        content: `:white_check_mark: pong`,
        ephemeral: true,
      })
    } else if (subcommand === 'link-github') {
      const url = await getGitHubAuthorizeUrl(interaction.user)
      await interaction.reply({
        content: `:pleading_face: Please go to this URL to link your GitHub account: :arrow_down:\n${url}`,
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
        await interaction.reply({
          content: `**Error:** Unknown profile key ${key}`,
          ephemeral: true,
        })
      }
    }
  }
}

export async function handleMessage(context: BotContext, message: Message) {
  const { client, db } = context

  if (message.partial) {
    console.log('Received a partial message!')
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
            deployCommands: () => deployCommands(context),
          },
          m[1],
        )
        replyText = '```\n' + inspect(result) + '\n```'
      } catch (error) {
        replyText = '```\n' + String(error) + '\n```'
        console.error(error)
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
  return 'unknown action'
}

async function deployCommands(context: BotContext) {
  const commands = [
    new SlashCommandBuilder()
      .setName('showdown')
      .setDescription('Talk to showdown.space bot')
      .addSubcommand((subcommand) =>
        subcommand.setName('ping').setDescription('Replies with pong'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('link-github')
          .setDescription('Link your GitHub Account'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('set')
          .setDescription('Set user profile info')
          .addStringOption((o) =>
            o.setName('key').setDescription('Key to set').setRequired(true),
          )
          .addStringOption((o) =>
            o.setName('value').setDescription('Value to set').setRequired(true),
          ),
      ),
  ].map((command) => command.toJSON())

  const rest = new REST({ version: '9' }).setToken(context.discordToken)
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  })
  return 'Successfully registered application commands.'
}
