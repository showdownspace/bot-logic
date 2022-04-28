import { CommandInteraction } from 'discord.js'
import { Bot, Reply } from './bot'
import { WeakMemo } from './memo-tools'
import { ChainOfResponsibility } from './pipeline-tools'
import { BotContext } from './types'

export class ManagementApi {
  private availableCommands: string[] = []
  private commandHandlers =
    new ChainOfResponsibility<ManagementCommandLineHandler>(
      (context, interaction, command, reply) => async () => {
        const list = this.availableCommands.join('\n')
        reply.fail(
          `Unknown command:\`\`\`${command}\`\`\`Available commands:\`\`\`${list}\`\`\``,
        )
      },
    )
  constructor(private bot: Bot) {}

  handleManagementCommand(
    commandName: string,
    handler: ManagementCommandHandler,
  ) {
    this.availableCommands.push(commandName)
    this.commandHandlers.add((context, interaction, command, reply) => {
      if (command === commandName || command.startsWith(commandName + ' ')) {
        const payload = command.slice(commandName.length + 1)
        return async () => {
          const output = new ManagementCommandOutput()
          let ok = true
          let written = false
          setTimeout(() => {
            if (!written) reply.wait('Thinking....')
          }, 500)
          try {
            await handler(context, interaction, payload, output)
          } catch (error) {
            ok = false
            context.log.error({ err: error })
            output.puts('FAIL: ' + String(error))
          }
          const text = [
            '```',
            `> ${command}`,
            '',
            output.toString(),
            '```',
          ].join('\n')
          written = true
          if (ok) {
            if (output.public) {
              reply.makePublic()
            }
            reply.ok(text)
          } else {
            reply.fail(text)
          }
        }
      }
    })
  }

  handleCommandInteraction(
    context: BotContext,
    interaction: CommandInteraction,
    command: string,
    reply: Reply,
  ) {
    return this.commandHandlers.handle(context, interaction, command, reply)
  }
}

type ManagementCommandLineHandler = (
  context: BotContext,
  interaction: CommandInteraction,
  command: string,
  reply: Reply,
) => (() => Promise<void>) | undefined

export type ManagementCommandHandler = (
  context: BotContext,
  interaction: CommandInteraction,
  payload: string,
  output: ManagementCommandOutput,
) => Promise<void>

export class ManagementCommandOutput {
  output: string[] = []
  public = false
  constructor() {}
  makePublic() {
    this.public = true
  }
  puts(...stuff: string[]) {
    this.output.push(...stuff)
  }
  toString() {
    return this.output.join('\n')
  }
}

const cache = new WeakMemo<Bot, ManagementApi>((bot) => new ManagementApi(bot))

export function management(bot: Bot) {
  return cache.get(bot)
}
