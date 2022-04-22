import {
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  MessageOptions,
} from 'discord.js'
import { BotContext } from './types'

export class Bot {
  interactionProcessors: InteractionProcessor[] = []
  handleCommand(pattern: string, commandHandler: CommandHandler) {
    this.interactionProcessors.push((context, interaction) => {
      if (!interaction.isCommand()) {
        return
      }
      const commandName = interaction.commandName
      const subcommand = interaction.options.getSubcommand()
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
}

export type InteractionProcessor = (
  context: BotContext,
  interaction: Interaction,
) => (() => Promise<void>) | void

export type CommandHandler = (
  context: BotContext,
  interaction: CommandInteraction,
  reply: Reply,
) => Promise<void>

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
}
