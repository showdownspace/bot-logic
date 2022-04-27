import {
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  MessageOptions,
} from 'discord.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { BotContext } from './types'

export class Bot {
  interactionProcessors: InteractionProcessor[] = []
  httpRequestProcessors: HttpRequestProcessor[] = []

  handleCommand(pattern: string, commandHandler: CommandHandler) {
    this.interactionProcessors.push((context, interaction) => {
      if (!interaction.isCommand()) {
        return
      }
      const commandName = interaction.commandName
      const subcommand = interaction.options.getSubcommand(false)
      let str = '/' + commandName
      if (subcommand) {
        str += ' ' + subcommand
      }
      if (str !== pattern) {
        return
      }
      return async () => {
        const reply: Reply = new Reply(interaction)
        try {
          await commandHandler(context, interaction, reply)
        } catch (error) {
          reply.fail(`An error has occurred.`)
          context.log.error({ err: error }, 'Unable to handle command ' + str)
        }
      }
    })
  }
  handleButton(customId: string, buttonHandler: ButtonHandler) {
    this.interactionProcessors.push((context, interaction) => {
      if (!interaction.isButton()) {
        return
      }
      if (interaction.customId !== customId) {
        return
      }
      return async () => {
        const reply: Reply = new Reply(interaction)
        try {
          await buttonHandler(context, interaction, reply)
        } catch (error) {
          reply.fail(`An error has occurred.`)
          context.log.error(
            { err: error },
            'Unable to handle button ' + customId,
          )
        }
      }
    })
  }
  handleHttpAction(actionName: string, actionHandler: HttpActionHandler) {
    this.httpRequestProcessors.push((context, request, reply) => {
      const query = request.query as
        | Record<string, string | undefined>
        | undefined
      if (query?.action !== actionName) {
        return
      }
      return async () => {
        return actionHandler(context, request, reply)
      }
    })
  }

  async processInteraction(context: BotContext, interaction: Interaction) {
    for (const processor of this.interactionProcessors) {
      const handler = processor(context, interaction)
      if (handler) {
        await handler()
        return true
      }
    }
    return false
  }
  async processHttpRequest(
    context: BotContext,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    for (const processor of this.httpRequestProcessors) {
      const handler = processor(context, request, reply)
      if (handler) {
        return await handler()
      }
    }
    return 'unknown action'
  }
}

export type InteractionProcessor = (
  context: BotContext,
  interaction: Interaction,
) => (() => Promise<void>) | void

export type HttpRequestProcessor = (
  context: BotContext,
  request: FastifyRequest,
  reply: FastifyReply,
) => (() => Promise<any>) | void

export type CommandHandler = (
  context: BotContext,
  interaction: CommandInteraction,
  reply: Reply,
) => Promise<void>

export type ButtonHandler = (
  context: BotContext,
  interaction: ButtonInteraction,
  reply: Reply,
) => Promise<void>

export type HttpActionHandler = (
  context: BotContext,
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<any>

export class Reply {
  private extraParams: any = {}
  private written = false
  constructor(private interaction: CommandInteraction | ButtonInteraction) {}

  async writeText(content: string) {
    if (this.written) {
      await this.interaction.editReply({
        content: content,
        ...this.extraParams,
      })
    } else {
      await this.interaction.reply({
        content: content,
        ephemeral: true,
        ...this.extraParams,
      })
      this.written = true
    }
  }

  async wait(content: string) {
    await this.writeText(':hourglass_flowing_sand: ' + content)
  }

  async please(content: string) {
    await this.writeText(':pleading_face: ' + content)
  }

  async ok(content: string) {
    await this.writeText(':white_check_mark: ' + content)
  }

  async fail(content: string) {
    await this.writeText(':x: ' + content)
  }

  withComponents(...components: NonNullable<MessageOptions['components']>) {
    this.extraParams.components = components
    return this
  }

  withEmbeds(...embeds: NonNullable<MessageOptions['embeds']>) {
    this.extraParams.embeds = embeds
    return this
  }

  withLink(title: string, description: string, url: string) {
    this.extraParams.embeds = [
      {
        title,
        description,
        url,
      },
    ]
    return this
  }
}
