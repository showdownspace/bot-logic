import { MessageAttachment, TextChannel } from 'discord.js'
import { writeBackup } from './backup'
import { definePlugin } from './bot'
import { guildId } from './config'
import { encrypted } from './encrypted'
import { management } from './management'
import { getRtSysToken } from './rt-sys'
import { getRenderingCode, screenshot } from './screenshotter'
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
      await getRoomRef(context).child('settings/acceptingSubmissions').set(true)
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
      const url = payload.trim()
      const imageUrl = url.replace(/\/$/, '') + '/reference.png'
      await getRoomRef(context)
        .child('config/refImage')
        .set(imageUrl || null)
      output.puts('Reference image set')

      const channel = (await context.client.guilds
        .resolve(guildId)!
        .channels.fetch('975398699477913621')!) as TextChannel
      channel.send(':arrow_right: ' + url)
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
  type Submission = {
    html: string
    css: string
    compiledCss: string
  }
  const getSubmissionHtml = (submission: Submission) => {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<base href="https://codeinthewind-editor.showdown.space/">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Karla:wght@200;300;400;500;600;700&family=Noto+Sans+Thai:wght@100;200;300;400;500;600;700;800;900&family=Noto+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
<style>body { font-family: Noto Sans, Noto Sans Thai, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"; }</style>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style id="cssstyle">${submission.compiledCss}</style>
</head>
<body id="htmlbody">${submission.html}</body>
</html>`
  }
  management(bot).handleManagementCommand(
    'citw-snap',
    async (context, interaction, payload, output) => {
      const channel = interaction.channel!
      const stage = await getRoomRef(context)
        .child('config/stage')
        .once('value')
      const uids: string[] = []
      stage.forEach((item) => {
        uids.push(item.val())
      })
      for (const [index, uid] of uids.entries()) {
        output.puts(`Contestant #${index + 1}...`)
        try {
          const data = await getRoomRef(context)
            .child(`publicSubmissions/${uid}/data`)
            .once('value')
          if (!data) {
            output.puts('-> No submission')
            continue
          }
          const submission = JSON.parse(data.val())
          const buffer = await screenshot(
            context,
            getRenderingCode(getSubmissionHtml(submission)),
          )
          output.puts('-> Rendered, file size = ' + buffer.length)
          await channel.send({
            content: `:arrow_down: Contestant #${index + 1}`,
            files: [
              new MessageAttachment(
                buffer,
                `contestant${index + 1}_${Date.now()}.png`,
              ),
            ],
          })
        } catch (error) {
          output.puts(
            `-> !! Error processing contestant #${index + 1}: ${error}`,
          )
        }
      }
    },
  )
  management(bot).handleManagementCommand(
    'citw-status',
    async (context, interaction, payload, output) => {
      var { allUsersCount, onlineUsers, stageEntries } = await getCitwStatus(
        context,
      )

      output.puts(`All users count: ${allUsersCount}`)
      output.puts(`Online users count: ${onlineUsers.length}`)
      for (const user of onlineUsers) {
        output.puts(`- ${user}`)
      }
      output.puts(`On stage: ${stageEntries.length}`)
      for (const [i, { uid, name }] of stageEntries.entries()) {
        output.puts(`${i + 1}. ${uid} -> ${name}`)
      }
    },
  )
  management(bot).handleManagementCommand(
    'citw-votes',
    async (context, interaction, payload, output) => {
      const { voteResult } = await getCitwVoteResult(context)
      for (const { score } of voteResult) {
        output.puts(`${score}`)
      }
    },
  )

  const httpKey = encrypted`gV4Vw7ZamIEzbt4HWJBC/VY88m32wvkE.QYW1+P2UzCEpdOjSVUu0apOAjoGgW0cvdwcXtbXJ`
  bot.handleHttpAction('citw-info', async (context, request, reply) => {
    if ((request.query as { key?: string }).key !== httpKey) {
      reply.status(401)
      return 'Unauthorized'
    }
    const statusPromise = getCitwStatus(context)
    const voteResultPromise = getCitwVoteResult(context)
    const { allUsersCount, onlineUsers, stageEntries } = await statusPromise
    const { voteResult, votes } = await voteResultPromise
    const output: string[] = []

    output.push(`# All users count: ${allUsersCount}`)
    output.push('')

    output.push(`# On stage: ${stageEntries.length}`)
    for (const { name } of stageEntries) {
      output.push(`${name}`)
    }
    output.push('')

    output.push(`# Online users count: ${onlineUsers.length}`)
    for (const user of onlineUsers) {
      output.push(`${user}`)
    }
    output.push('')

    output.push(`# Voters count: ${votes.length}`)
    output.push('')

    output.push(`# Vote result`)
    for (const { count, score } of voteResult) {
      output.push(`${score}`)
    }
    output.push('')

    output.push(`# Details`)
    for (const [i, { uid, name }] of stageEntries.entries()) {
      const result = voteResult[i]
      output.push(
        `${i + 1} | ${uid} | ${name} | count=${result?.count}, rank=${
          result?.rank
        }, score=${result?.score}`,
      )
    }
    output.push('')

    return output.join('\n')
  })
})

async function getCitwVoteResult(context: BotContext) {
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
    return contestants.filter((c) => countOf(c) > countOf(contestant)).length
  })
  const voteResult = rankings.map((n, i) => {
    const score = [25, 16, 9, 4, 3, 2, 1][n] || 0
    const number = contestants[i]
    return { number, rank: n + 1, score, count: countOf(number) }
  })
  return { voteResult, votes }
}

async function getCitwStatus(context: BotContext) {
  const stagePromise = getRoomRef(context).child('config/stage').once('value')
  const presencePromise = getRoomRef(context).child('presence').once('value')
  const profilesPromise = getRoomRef(context).child('profiles').once('value')
  const stage = await stagePromise
  const presence = await presencePromise
  const profiles = await profilesPromise
  const uids: string[] = []
  stage.forEach((item) => {
    uids.push(item.val())
  })
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
  const stageEntries = uids.map((uid) => ({
    uid,
    name: profiles.child(uid).child('name').val(),
  }))
  return { allUsersCount, onlineUsers, stageEntries }
}

function getRoomRef(context: BotContext) {
  return context.firebaseAdmin.database().ref('rooms/citw')
}
