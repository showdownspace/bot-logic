import { SlashCommandBuilder } from '@discordjs/builders'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'
import { clientId, guildId } from './config'
import { BotContext } from './types'

export async function deployCommands(context: BotContext) {
  const commands = [
    new SlashCommandBuilder()
      .setName('showdown')
      .setDescription('Talk to showdown.space bot')
      .addSubcommand((subcommand) =>
        subcommand.setName('ping').setDescription('Replies with pong'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('link-github')
          .setDescription('Link your GitHub Account'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('profile')
          .setDescription('View your showdown.space profile'),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('register-email')
          .setDescription('Registers your email address (for staff)')
          .addStringOption((o) =>
            o.setName('email').setDescription('Your email').setRequired(true),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('verify-email')
          .setDescription('Verify your email address')
          .addStringOption((o) =>
            o.setName('otp').setDescription('OTP').setRequired(true),
          ),
      ),
    new SlashCommandBuilder()
      .setName('answer')
      .setDescription('Submit an answer')
      .addSubcommand((subcommand) =>
        subcommand.setName('a').setDescription('Submit an answer choice “A”'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('b').setDescription('Submit an answer choice “B”'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('c').setDescription('Submit an answer choice “C”'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('d').setDescription('Submit an answer choice “D”'),
      ),
  ].map((command) => command.toJSON())

  const rest = new REST({ version: '9' }).setToken(context.discordToken)
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  })
  return 'Successfully registered application commands.'
}
