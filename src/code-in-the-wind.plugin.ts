import { writeBackup } from './backup'
import { definePlugin } from './bot'
import { management } from './management'
import { getRtSysToken } from './rt-sys'
import { BotContext } from './types'
import { exportVotes } from './vote'

export default definePlugin((bot) => {
  bot.handleCommand(
    '/codeinthewind editor',
    async (context, interaction, reply) => {
      const token = await getRtSysToken(context, interaction.user)
      const url =
        'https://codeinthewind-editor.showdown.space/?room=citw#auth_token=' +
        encodeURIComponent(token)
      reply
        .withLink(
          'Click here to launch the editor',
          'Code in the Wind Editor',
          url,
        )
        .ok(
          '**Click the link below to open the editor.** (Note: This link is unique to you, do not share with others!)',
        )
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
    'citw-backup',
    async (context, interaction, payload, output) => {
      output.makePublic()
      const snapshot = await getRoomRef(context).once('value')
      const filename = await writeBackup(context, 'citw', snapshot.val() || {})
      output.puts(`Database backup saved to "${filename}"`)
    },
  )
  management(bot).handleManagementCommand(
    'citw-reset',
    async (context, interaction, payload, output) => {
      output.makePublic()
      const snapshot = await getRoomRef(context).once('value')
      const filename = await writeBackup(context, 'citw', snapshot.val() || {})
      output.puts(`Database backup saved to "${filename}"`)
      await getRoomRef(context).set(null)
      output.puts('Database reset')
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
    'citw-ref',
    async (context, interaction, payload, output) => {
      await getRoomRef(context)
        .child('config/refImage')
        .set(payload.trim() || null)
      output.puts('Reference image set')
    },
  )
  management(bot).handleManagementCommand(
    'citw-reveal',
    async (context, interaction, payload, output) => {
      await getRoomRef(context).child('config/namesRevealed').set(true)
      output.puts('Revealed')
    },
  )
  management(bot).handleManagementCommand(
    'citw-conceal',
    async (context, interaction, payload, output) => {
      await getRoomRef(context).child('config/namesRevealed').set(false)
      output.puts('Concealed')
    },
  )
  management(bot).handleManagementCommand(
    'citw-add',
    async (context, interaction, payload, output) => {
      let added = 0
      for (const mention of payload.matchAll(/<@!?(\d+)>/g)) {
        const uid = `discord${mention[1]}`
        await getRoomRef(context).child('config/stage').push(uid)
        added++
      }
      output.puts('Number of people added to stage: ' + added)
    },
  )
  management(bot).handleManagementCommand(
    'citw-rm',
    async (context, interaction, payload, output) => {
      const uidsToRemove = new Set(
        Array.from(payload.matchAll(/<@!?(\d+)>/g)).map(
          (mention) => `discord${mention[1]}`,
        ),
      )
      const stage = await getRoomRef(context)
        .child('config/stage')
        .once('value')
      const actions: Promise<void>[] = []
      stage.forEach((item) => {
        if (uidsToRemove.has(item.val())) {
          actions.push(item.ref.remove())
        }
      })
      const results = await Promise.all(actions)
      output.puts('Number of people removed from stage: ' + results.length)
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
      let allUsersCount = 0
      presence.forEach((item) => {
        const timestamp = item.val()
        allUsersCount++
        if (timestamp >= Date.now() - 60e3) {
          const name = profiles.child(item.key!).child('name').val()
          if (name) {
            onlineUsers.push(name)
          }
        }
      })
      onlineUsers.sort()
      output.puts(`All users count: ${allUsersCount}`)
      output.puts(`Online users count: ${onlineUsers.length}`)
      for (const user of onlineUsers) {
        output.puts(`- ${user}`)
      }
    },
  )
  management(bot).handleManagementCommand(
    'citw-votes',
    async (context, interaction, payload, output) => {
      const votes = await exportVotes(context)
      const count: Record<string, number> = {}
      const countOf = (option: string) => count[option] || 0
      for (const vote of votes) {
        for (const option of vote.options) {
          count[option] = countOf(option) + 1
        }
      }
      const contestants = ['1', '2', '3', '4', '5', '6', '7', '8']
      const rankings = contestants.map((contestant) => {
        return contestants.filter((c) => countOf(c) > countOf(contestant))
          .length
      })
      for (const n of rankings) {
        const score = [25, 16, 9, 4, 3, 2, 1][n] || 0
        output.puts(`${score}`)
      }
    },
  )
})

function getRoomRef(context: BotContext) {
  return context.firebaseAdmin.database().ref('rooms/citw')
}
