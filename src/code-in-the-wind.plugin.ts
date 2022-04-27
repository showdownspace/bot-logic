import { definePlugin } from './bot'
import { management } from './management'
import { getRtSysToken } from './rt-sys'
import { BotContext } from './types'

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
  management(bot).handleManagementCommand(
    'citw-unlock',
    async (context, interaction, payload, output) => {
      await getRoomRef(context).child('settings/acceptingSubmissions').set(true)
      output.puts('Editor unlocked')
    },
  )
  management(bot).handleManagementCommand(
    'citw-lock',
    async (context, interaction, payload, output) => {
      await getRoomRef(context)
        .child('settings/acceptingSubmissions')
        .set(false)
      output.puts('Editor locked')
    },
  )
  management(bot).handleManagementCommand(
    'citw-status',
    async (context, interaction, payload, output) => {
      const presencePromise = getRoomRef(context)
        .child('presence')
        .once('value')
      const profilesPromise = getRoomRef(context)
        .child('profiles')
        .once('value')
      const presence = await presencePromise
      const profiles = await profilesPromise
      const onlineUsers: string[] = []
      presence.forEach((item) => {
        const timestamp = item.val()
        if (timestamp >= Date.now() - 60e3) {
          const name = profiles.child(item.key!).child('name').val()
          if (name) {
            onlineUsers.push(name)
          }
        }
      })
      onlineUsers.sort()
      output.puts(`Online users count: ${onlineUsers.length}`)
      for (const user of onlineUsers) {
        output.puts(`- ${user}`)
      }
    },
  )
})

function getRoomRef(context: BotContext) {
  return context.firebaseAdmin.database().ref('rooms/citw')
}
