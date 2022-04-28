import axios from 'axios'
import { Interaction, Message } from 'discord.js'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { inspect } from 'util'
import answerBuzzerPlugin from './answer-buzzer.plugin'
import { Bot } from './bot'
import codeInTheWindPlugin from './code-in-the-wind.plugin'
import { deployCommands } from './deploy-commands'
import { encrypted } from './encrypted'
import managementPlugin from './management.plugin'
import profilePlugin from './profile.plugin'
import { BotContext } from './types'
import votePlugin from './vote.plugin'

const bot = new Bot()
bot.handleCommand('/showdown ping', async (context, interaction, reply) => {
  await reply.wait('wait for it')
  await reply.ok('pong')
})
bot.handleHttpAction('encrypt', async (context, request, reply) => {
  const text = (request.body as Record<string, string> | undefined)?.text
  if (text) {
    return 'encrypted`' + encrypted.encrypt(String(text)) + '`'
  }
  reply.header('Content-Type', 'text/html')
  return `<html><form method="post">
  <textarea name="text" rows="10" cols="80"></textarea>
  <input type="submit" value="Encrypt" />`
})
bot.register(managementPlugin)
bot.register(profilePlugin)
bot.register(answerBuzzerPlugin)
bot.register(codeInTheWindPlugin)
bot.register(votePlugin)

export async function handleInteraction(
  context: BotContext,
  interaction: Interaction,
) {
  if (!interaction.guild) return
  try {
    await bot.processInteraction(context, interaction)
  } catch (error) {
    context.log.error({ err: error }, 'Unable to process Discord interaction')
  }
}

export async function handleMessage(context: BotContext, message: Message) {
  const { client, db, log, firebaseAdmin, google } = context

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
            firebaseAdmin,
            google,
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
}

export async function handleHttpRequest(
  context: BotContext,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  return bot.processHttpRequest(context, request, reply)
}
