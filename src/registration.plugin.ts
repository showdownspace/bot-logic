import { definePlugin } from './bot'
import { time } from '@discordjs/builders'
import { management } from './management'

interface RegistrationCodeEntity {
  _id: string
  used: number
  quota: number
  nbf: string
  usedUsers: string[]
  waitlistRoleId?: string
  registeredRoleId?: string
}

interface RegistrationAttemptEntity {
  timestamp: string
  userId: string
  discordUserTag: string
  registrationCode: string
  result: string
}

export default definePlugin((bot) => {
  bot.handleCommand('/signup', async (context, interaction, reply) => {
    const { db, log } = context
    const registrationCode = String(
      interaction.options.getString('code'),
    ).toUpperCase()
    if (!registrationCode) {
      await reply.fail('Please provide a code.')
      return
    }
    const user = interaction.user
    const userId = `discord${user.id}`
    let result = 'Unimplemented'
    try {
      const codeRecord = await db
        .collection<RegistrationCodeEntity>('registration_codes')
        .findOne({ _id: registrationCode })
      if (!codeRecord) {
        result = 'Invalid code'
        reply.fail('Code not found')
        return
      }
      const nbf = Date.parse(codeRecord.nbf)
      if (nbf && Date.now() < nbf) {
        const nbfDate = new Date(nbf)
        result = 'Code not yet valid'
        reply.fail(
          `Registration is not open yet. ` +
            `Registration will open at ${time(nbfDate, 'F')} ` +
            `(${time(nbfDate, 'R')})`,
        )
        return
      }
      if ((codeRecord.usedUsers || []).includes(userId)) {
        const index = (codeRecord.usedUsers || []).indexOf(userId)
        result = 'Already used'
        reply.fail(
          'You already signed up with this registration code.\n' +
            (index < codeRecord.quota
              ? 'You already got a ticket.'
              : 'You are on a waitlist for this code.'),
        )
        return
      }

      const updatedCodeRecord = await db
        .collection<RegistrationCodeEntity>('registration_codes')
        .findOneAndUpdate(
          { _id: registrationCode },
          { $inc: { used: 1 }, $addToSet: { usedUsers: userId } },
          { returnDocument: 'after' },
        )
      const used: number = updatedCodeRecord.value!.used
      const quota: number = updatedCodeRecord.value!.quota
      const ticketsLeft = quota - used + 1
      if (ticketsLeft > 0) {
        result = `Success (${used}/${quota})`
        reply.ok(
          `Successfully registered using the code "${registrationCode}". Congratulations!`,
        )
        if (codeRecord.registeredRoleId) {
          interaction.guild?.members
            .fetch(user.id)
            .then((member) => {
              return member.roles.add(codeRecord.registeredRoleId!)
            })
            .catch((err) => {
              log.error({ err }, 'Unable to add to waitlist')
            })
        }
      } else {
        result = `Over quota (${used}/${quota})`
        reply.please(
          `Sorry, the registration limit for the code "${registrationCode}" has been reached.\nYou have been put on the waiting list.`,
        )
        if (codeRecord.waitlistRoleId) {
          interaction.guild?.members
            .fetch(user.id)
            .then((member) => {
              return member.roles.add(codeRecord.waitlistRoleId!)
            })
            .catch((err) => {
              log.error({ err }, 'Unable to add to waitlist')
            })
        }
      }
    } catch (error) {
      log.error({ err: error }, 'Unable to handle command /signup')
      result = `Error: ${error}`
    } finally {
      await db.collection('registration_attempts').insertOne({
        timestamp: new Date().toISOString(),
        userId,
        discordUserTag: user.tag,
        registrationCode,
        result,
      })
    }
  })

  management(bot).handleManagementCommand(
    'signup-stats',
    async (context, interaction, payload, output) => {
      const { db } = context
      const code = payload.trim().toUpperCase()
      if (!code) {
        output.puts('Please provide a code.')
        return
      }
      const codeRecord = await db
        .collection<RegistrationCodeEntity>('registration_codes')
        .findOne({ _id: code })
      if (!codeRecord) {
        output.puts('Code not found')
        return
      }
      const used = codeRecord.used
      const quota = codeRecord.quota
      output.puts(`Registered: ${used}/${quota}`)
    },
  )
  management(bot).handleManagementCommand(
    'signup-log',
    async (context, interaction, payload, output) => {
      const { db } = context
      const params = payload.split(/\s+/)
      const records = await db
        .collection<RegistrationAttemptEntity>('registration_attempts')
        .find()
        .sort({ _id: -1 })
        .skip(+params[1] > 0 ? +params[1] : 0)
        .limit(+params[0] > 0 ? +params[0] : 10)
        .toArray()
      for (const record of records) {
        output.puts(
          `[${record.timestamp}] ${record.discordUserTag} "${record.registrationCode}" -> ${record.result}`,
        )
      }
    },
  )
})
