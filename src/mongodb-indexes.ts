import { BotContext } from './types'

export async function createIndexes(context: BotContext) {
  const { db } = context
  return Promise.all([
    db.collection('profiles').createIndex({ 'githubUser.login': 1 }),
  ])
}
