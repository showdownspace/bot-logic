import { definePlugin } from './bot'
import { management } from './management'

export default definePlugin((bot) => {
  bot.handleCommand('/manage', async (context, interaction, reply) => {
    const command = interaction.options.getString('command') ?? ''
    const roleId = '964059437629333554'
    if (
      !interaction.guild?.members
        .resolve(interaction.user.id)
        ?.roles.cache.has(roleId)
    ) {
      reply.fail('You do not have the required role to use this command.')
      return
    }
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
