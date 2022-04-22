import { Client } from 'discord.js'
import { Db } from 'mongodb'
import { FastifyInstance, FastifyLoggerInstance } from 'fastify'

export interface BotContext {
  discordToken: string
  client: Client
  db: Db
  fastify: FastifyInstance
  log: FastifyLoggerInstance
}
