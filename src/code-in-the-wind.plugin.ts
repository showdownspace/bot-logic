import { definePlugin } from './bot'
import { getRtSysToken } from './rt-sys'

export default definePlugin((bot) => {
  bot.handleCommand(
    '/codeinthewind editor',
    async (context, interaction, reply) => {
      const token = await getRtSysToken(context, interaction.user)
      const url =
        'https://codeinthewind-editor.showdown.space/?room=citw#auth_token=' +
        encodeURIComponent(token)
      reply
        .withLink('Click here to launch the editor', url, url)
        .ok('Click the following link to open the editor:')
    },
  )
})
