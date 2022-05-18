import type { Client } from 'discord.js'
import type { Db } from 'mongodb'
import type { FastifyInstance, FastifyLoggerInstance } from 'fastify'
import type { google } from 'googleapis'
import type { GoogleAuth } from 'google-auth-library'

export interface BotContext {
  discordToken: string
  client: Client
  db: Db
  fastify: FastifyInstance
  log: FastifyLoggerInstance
  firebaseAdmin: typeof import('firebase-admin')
  google: typeof google
  googleAuth: GoogleAuth
  unscopedGoogleAuth: GoogleAuth
  processState: Record<string, any>
}
