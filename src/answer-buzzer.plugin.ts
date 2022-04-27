import { CommandHandler, definePlugin } from './bot'

function createAnswerHandler(answer: string): CommandHandler {
  return async (context, interaction, reply) => {
    const { db } = context
    await db.collection('answer_buzzes').insertOne({
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
export default definePlugin((bot) => {
  bot.handleCommand('/answer a', createAnswerHandler('A'))
  bot.handleCommand('/answer b', createAnswerHandler('B'))
  bot.handleCommand('/answer c', createAnswerHandler('C'))
  bot.handleCommand('/answer d', createAnswerHandler('D'))
})
