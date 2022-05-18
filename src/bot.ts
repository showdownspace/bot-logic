import {
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  MessageOptions,
  SelectMenuInteraction,
} from 'discord.js'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { ChainOfResponsibility } from './pipeline-tools'
import { BotContext } from './types'

export class Bot {
  private interactionProcessors =
    new ChainOfResponsibility<InteractionProcessor>()
  private httpRequestProcessors =
    new ChainOfResponsibility<HttpRequestProcessor>(
      () => async () => 'unknown action :(',
    )

  handleCommand(pattern: string, commandHandler: CommandHandler) {
    this.interactionProcessors.add((context, interaction) => {
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
        const reply: Reply = new Reply(context, interaction)
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
    this.interactionProcessors.add((context, interaction) => {
      if (!interaction.isButton()) {
        return
      }
      if (interaction.customId !== customId) {
        return
      }
      return async () => {
        const reply: Reply = new Reply(context, interaction)
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
  handleSelectMenu(customId: string, selectMenuHandler: SelectMenuHandler) {
    this.interactionProcessors.add((context, interaction) => {
      if (!interaction.isSelectMenu()) {
        return
      }
      if (interaction.customId !== customId) {
        return
      }
      return async () => {
        const reply: Reply = new Reply(context, interaction)
        try {
          await selectMenuHandler(context, interaction, reply)
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
    this.httpRequestProcessors.add((context, request, reply) => {
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
  register(plugin: (bot: Bot) => void) {
    plugin(this)
  }

  async processInteraction(context: BotContext, interaction: Interaction) {
    return this.interactionProcessors.handle(context, interaction)
  }
  async processHttpRequest(
    context: BotContext,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    return this.httpRequestProcessors.handle(context, request, reply)
  }
}

export type InteractionProcessor = (
  context: BotContext,
  interaction: Interaction,
) => (() => Promise<void>) | undefined

export type HttpRequestProcessor = (
  context: BotContext,
  request: FastifyRequest,
  reply: FastifyReply,
) => (() => Promise<any>) | undefined

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

export type SelectMenuHandler = (
  context: BotContext,
  interaction: SelectMenuInteraction,
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
  private ephemeral = true
  private requiresFollowUp = false
  constructor(
    private context: BotContext,
    private interaction:
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction,
  ) {}

  makePublic() {
    if (this.ephemeral && this.written) {
      this.requiresFollowUp = true
    }
    this.ephemeral = false
  }
  async writeText(content: string) {
    try {
      if (this.requiresFollowUp) {
        await this.interaction.followUp({
          content: content,
          ephemeral: this.ephemeral,
          ...this.extraParams,
        })
      } else if (this.written) {
        await this.interaction.editReply({
          content: content,
          ...this.extraParams,
        })
      } else {
        await this.interaction.reply({
          content: content,
          ephemeral: this.ephemeral,
          ...this.extraParams,
        })
        this.written = true
      }
    } catch (error) {
      this.context.log.error({ err: error }, 'Unable to write text')
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

export function definePlugin(fn: (bot: Bot) => void) {
  return fn
}
