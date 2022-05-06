import { definePlugin } from './bot'
import { time } from '@discordjs/builders'

interface RegistrationCodeEntity {
  _id: string
  used: number
  quota: number
  nbf: string
  usedUsers: string[]
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
      } else {
        result = `Over quota (${used}/${quota})`
        reply.please(
          `Sorry, the registration limit for the code "${registrationCode}" has been reached.\nYou have been put on the waiting list.`,
        )
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
})
