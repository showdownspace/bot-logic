import type { Client } from 'discord.js'
import type { Db } from 'mongodb'
import type { FastifyInstance, FastifyLoggerInstance } from 'fastify'
import type { google } from 'googleapis'

export interface BotContext {
  discordToken: string
  client: Client
  db: Db
  fastify: FastifyInstance
  log: FastifyLoggerInstance
  firebaseAdmin: typeof import('firebase-admin')
  google: typeof google
  googleAuth: typeof google.auth.GoogleAuth
  processState: Record<string, any>
}
