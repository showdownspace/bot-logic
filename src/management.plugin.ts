import { definePlugin } from './bot'

export default definePlugin((bot) => {
  bot.handleCommand('/manage', async (context, interaction, reply) => {
    const command = interaction.options.getString('command')
    await reply.ok(`Command:\`\`\`${command}\`\`\``)
  })
})
