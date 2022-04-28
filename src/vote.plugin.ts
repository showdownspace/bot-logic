import { writeBackup } from './backup'
import { definePlugin } from './bot'
import { management } from './management'
import { clearAllVotes, exportVotes, saveVote } from './vote'

export default definePlugin((bot) => {
  bot.handleCommand('/vote', async (context, interaction, reply) => {
    const options = [
      ...(interaction.options.getString('options')?.matchAll(/\d+/g) || []),
    ].map(([id]) => id)
    const allowedOptions = ['1', '2', '3', '4', '5', '6', '7', '8']
    const allowedOptionSet = new Set(allowedOptions)
    const invalidOptions = options.filter((id) => !allowedOptionSet.has(id))
    if (invalidOptions.length) {
      await reply.fail(
        `You specified invalid options: ${invalidOptions.join(', ')}.\n` +
          `Valid options are: ${allowedOptions.join(', ')}.`,
      )
      return
    }
    const expected: number = 2
    if (options.length !== expected) {
      await reply.fail(
        expected === 1
          ? 'Please provide exactly one option.'
          : `Please provide exactly ${expected} options (separate them with spaces).`,
      )
      return
    }
    await saveVote(context, interaction.user, options)
    await reply.ok('Vote submitted. Thanks!')
  })
  management(bot).handleManagementCommand(
    'vote-stats',
    async (context, interaction, payload, output) => {
      const votes = await exportVotes(context)
      output.makePublic()
      output.puts(`Total number of voters: ${votes.length}`)
    },
  )
  management(bot).handleManagementCommand(
    'vote-reset',
    async (context, interaction, payload, output) => {
      const votes = await exportVotes(context)
      const backupFilename = await writeBackup(context, 'votes', votes)
      output.makePublic()
      output.puts(`Backup file saved to "${backupFilename}".`)
      await clearAllVotes(context)
      output.puts(`All votes have been cleared.`)
    },
  )
})
