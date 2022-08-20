import { definePlugin } from './bot'
import { enhanceError } from './enhance-error'
import { mintIdToken, verifyIdToken } from './id-token'
import { createPublicKey } from 'crypto'
import { jwtVerify } from 'jose'
import { Db } from 'mongodb'
import { getDiscordGuild } from './discord-utils'

interface EventpopTicketLinkEntity {
  /** `discord<uid>-<ticketId>` */
  _id: string
  discordUserId: string
  ticketId: number
  eventId: number
  referenceCode: string
  ticketType: string
  linkedAt: string
}

export default definePlugin((bot) => {
  const aud = 'showdownspace-bot/eventpop-ticket-linking'
  bot.handleCommand('/eventpop', async (context, interaction, reply) => {
    const token = await mintIdToken(interaction.user, aud)
    const url =
      'https://eventpop-ticket-gateway.vercel.app/redirect.html?' +
      new URLSearchParams({
        eventId: '13449',
        target: `https://showdownspace-bot.wonderful.software/showdown?action=callback/eventpop&id_token=${token}&ticket=%s`,
      })
    await reply
      .withLink('Click here to link your Eventpop ticket', url, url)
      .please(
        `Please click the link below to link your Eventpop ticket: :arrow_down:`,
      )
  })
  bot.handleHttpAction('callback/eventpop', async (context, request, reply) => {
    const { db, log } = context
    const query = request.query as Record<string, string>
    const idToken = String(query.id_token)
    const ticket = String(query.ticket)
    const owner = await verifyIdToken(idToken, aud).catch(
      enhanceError('Unable to verify ID token'),
    )
    const publicKey = createPublicKey(`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8GO2/OpcRMCJ150DyObi
QkN54M1ACoDN+CyRzCuY4o3yFPYfIFnhwTFX622SIDrqv9HDoIKwT1XitIsToyBH
sSfET/iukcHhqjQnowdQAvxmgK4gSDxipHcbBd1c2Qfjwfkfj4X3CfR9ronA1HYe
2vICBpwcyiJTyicljuyq1kvFWG7S24iugh0DJ9wuHo/rF3gmWlU9/5TTMKR+GLxI
nRAFIpN5DfdVYbj6foLelq2r8KdMtQZzzt6nBR7RcraPSuidHWKkYR8KJrTmZn4z
JW6iZD9S9gdyfRQZMXu1TMYq7B9D25EE8lceY/c5KSVSvKcrvIcqTJu02T+iOrat
swIDAQAB
-----END PUBLIC KEY-----`)
    const { payload } = await jwtVerify(ticket, publicKey)
    const eventId = payload.eventId as number
    const ticketId = payload.ticketId as number
    const firstname = payload.firstname as string
    const lastname = payload.lastname as string
    const referenceCode = payload.referenceCode as string
    const ticketType = payload.ticketType as string
    await getCollection(db).findOneAndUpdate(
      { _id: `discord${owner.discordId}-${ticketId}` },
      {
        $set: {
          discordUserId: owner.discordId,
          ticketId,
          eventId,
          referenceCode,
          ticketType,
          linkedAt: new Date().toISOString(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    )

    // Add Code Golf Party role to Code Golf Party ticket holders
    if (eventId === 13449) {
      const guild = getDiscordGuild(context)
      guild.members
        .fetch(owner.discordId)
        .then((member) => {
          return member.roles.add('1010447539323015200')
        })
        .catch((err) => {
          log.error({ err }, 'Unable to add to waitlist')
        })
    }

    return `Linked: "${owner.discordTag}" <-> "${firstname} ${lastname} [${referenceCode}] (${ticketType})"`
  })
})

function getCollection(db: Db) {
  return db.collection<EventpopTicketLinkEntity>('eventpop_tickets')
}
