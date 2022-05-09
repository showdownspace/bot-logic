import { definePlugin } from './bot'
import { management } from './management'
import { getRtSysToken } from './rt-sys'

export default definePlugin((bot) => {
  management(bot).handleManagementCommand(
    'token',
    async (context, interaction, payload, output) => {
      output.puts(
        await getRtSysToken(context, interaction.user, { management: true }),
      )
    },
  )
})
