import { Comparator } from '@dtinth/comparator'
import { ObjectId } from 'mongodb'
import { writeBackup } from './backup'
import { CommandHandler, definePlugin } from './bot'
import { getDiscordUserName } from './discord-utils'
import { management, ManagementCommandOutput } from './management'
import { BotContext } from './types'

export interface AnswerBuzz {
  _id?: ObjectId
  timestamp: string
  discordUserId: string
  discordGuildId: string
  answer: string
}

export interface PointHistory {
  _id?: ObjectId
  timestamp: string
  discordUserId: string
  points: number
  reason: string
}

export interface Answer {
  timestamp: string
  discordUserId: string
  answer: string
}

function createAnswerHandler(answer: string): CommandHandler {
  return async (context, interaction, reply) => {
    const { db } = context
    await db.collection<AnswerBuzz>('answer_buzzes').insertOne({
      timestamp: new Date().toISOString(),
      discordUserId: interaction.user.id,
      discordGuildId: interaction.guild!.id,
      answer: answer.toUpperCase(),
    })
    await interaction.reply({
      content: `:ok_hand: Received answer choice “${answer.toUpperCase()}”`,
      ephemeral: true,
    })
  }
}

export async function exportAnswerBuzzes(context: BotContext) {
  const { db } = context
  return db.collection<AnswerBuzz>('answer_buzzes').find({}).toArray()
}

export async function clearAllAnswerBuzzes(context: BotContext) {
  const { db } = context
  await db.collection<AnswerBuzz>('answer_buzzes').deleteMany({})
}

export async function exportPointHistory(context: BotContext) {
  const { db } = context
  return db.collection<PointHistory>('point_history').find({}).toArray()
}

export async function clearAllPointHistory(context: BotContext) {
  const { db } = context
  await db.collection<PointHistory>('point_history').deleteMany({})
}

export function collectAnswers(buzzes: AnswerBuzz[]): Answer[] {
  buzzes.sort((a, b) => {
    return a.timestamp.localeCompare(b.timestamp)
  })
  const data: Record<string, Answer> = {}
  for (const buzz of buzzes) {
    if (
      !data[buzz.discordUserId] ||
      data[buzz.discordUserId].answer !== buzz.answer
    ) {
      data[buzz.discordUserId] = {
        answer: buzz.answer,
        timestamp: buzz.timestamp,
        discordUserId: buzz.discordUserId,
      }
    }
  }
  return Object.values(data).sort((a, b) => {
    return a.timestamp.localeCompare(b.timestamp)
  })
}

export default definePlugin((bot) => {
  bot.handleCommand('/answer a', createAnswerHandler('A'))
  bot.handleCommand('/answer b', createAnswerHandler('B'))
  bot.handleCommand('/answer c', createAnswerHandler('C'))
  bot.handleCommand('/answer d', createAnswerHandler('D'))

  const exportAndClear = async (
    context: BotContext,
    output: ManagementCommandOutput,
  ) => {
    output.makePublic()
    const buzzes = await exportAnswerBuzzes(context)
    if (!buzzes.length) {
      output.puts('No buzzes found')
      return
    }
    const filename = await writeBackup(context, 'answer-buzzes', buzzes)
    output.puts(`Database backup saved to "${filename}"`)
    await clearAllAnswerBuzzes(context)
    output.puts(`Answer buzzes cleared`)
  }
  management(bot).handleManagementCommand(
    'answer-clear',
    async (context, interaction, payload, output) => {
      await exportAndClear(context, output)
    },
  )
  management(bot).handleManagementCommand(
    'points',
    async (context, interaction, payload, output) => {
      output.makePublic()
      const pointHistory = await exportPointHistory(context)
      const data: Record<string, number> = {}
      for (const entry of pointHistory) {
        data[entry.discordUserId] =
          (data[entry.discordUserId] || 0) + entry.points
      }
      const ids = Object.keys(data).sort(
        Comparator.comparing((x: string) => data[x]).reversed(),
      )
      for (const id of ids) {
        output.puts(`${getDiscordUserName(context, id)}: ${data[id]}`)
      }
    },
  )
  management(bot).handleManagementCommand(
    'points-clear',
    async (context, interaction, payload, output) => {
      output.makePublic()
      const pointHistory = await exportPointHistory(context)
      if (!pointHistory.length) {
        output.puts('No point history found')
        return
      }
      const filename = await writeBackup(
        context,
        'points-history',
        pointHistory,
      )
      output.puts(`Database backup saved to "${filename}"`)
      await clearAllPointHistory(context)
      output.puts(`Point history cleared`)
    },
  )
  management(bot).handleManagementCommand(
    'answer-award',
    async (context, interaction, payload, output) => {
      const allowedAnswers = ['A', 'B', 'C', 'D']
      const expectedAnswer = payload.trim().toUpperCase()
      if (!allowedAnswers.includes(expectedAnswer)) {
        output.puts('Please provide a valid answer choice.')
        return
      }
      const data = await exportAnswerBuzzes(context)
      const answers = collectAnswers(data)
      let score = 100
      for (const answer of answers) {
        if (answer.answer === expectedAnswer) {
          const name = getDiscordUserName(context, answer.discordUserId)
          output.puts(`Award ${score} points to ${name}`)
          await context.db.collection<PointHistory>('point_history').insertOne({
            timestamp: new Date().toISOString(),
            discordUserId: answer.discordUserId,
            points: score,
            reason: `Answer ${expectedAnswer}`,
          })
          score--
        }
        if (score < 1) return
      }
      await exportAndClear(context, output)
    },
  )
  management(bot).handleManagementCommand(
    'answer-stats',
    async (context, interaction, payload, output) => {
      const data = await exportAnswerBuzzes(context)
      const answers = collectAnswers(data)
      const summary = ['A', 'B', 'C', 'D']
        .map((x) => x + '=' + answers.filter((a) => a.answer === x).length)
        .join(', ')
      output.puts(`${answers.length} answers collected: ${summary}`)
    },
  )
  bot.handleHttpAction('answer-info', async (context, request, reply) => {
    const data = await exportAnswerBuzzes(context)
    return collectAnswers(data)
  })
})
