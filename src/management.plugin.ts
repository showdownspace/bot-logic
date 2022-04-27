import { definePlugin } from './bot'
import { management } from './management'

export default definePlugin((bot) => {
  bot.handleCommand('/manage', async (context, interaction, reply) => {
    const command = interaction.options.getString('command') ?? ''
    return management(bot).handleCommandInteraction(
      context,
      interaction,
      command,
      reply,
    )
  })
  management(bot).handleManagementCommand(
    'example',
    async (context, interaction, payload, output) => {
      output.makePublic()
      output.puts('ok')
    },
  )
})
