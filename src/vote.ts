import { User } from 'discord.js'
import { BotContext } from './types'

export async function saveVote(
  context: BotContext,
  user: User,
  options: string[],
) {
  const { db } = context
  await db
    .collection('votes')
    .updateOne(
      { _id: `discord${user.id}` },
      { $set: { options, createdAt: new Date().toISOString() } },
      { upsert: true },
    )
}

export async function exportVotes(context: BotContext) {
  const { db } = context
  return db.collection('votes').find({}).toArray()
}

export async function clearAllVotes(context: BotContext) {
  const { db } = context
  await db.collection('votes').deleteMany({})
}
