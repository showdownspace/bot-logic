import { SlashCommandBuilder } from '@discordjs/builders'
import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'
import { clientId, guildId } from './config'
import { BotContext } from './index'

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
          .setName('set')
          .setDescription('Set user profile info')
          .addStringOption((o) =>
            o.setName('key').setDescription('Key to set').setRequired(true),
          )
          .addStringOption((o) =>
            o.setName('value').setDescription('Value to set').setRequired(true),
          ),
      ),
    new SlashCommandBuilder()
      .setName('answer')
      .setDescription('Submit an answer')
      .addSubcommand((subcommand) =>
        subcommand.setName('a').setDescription('Submit an answer choice “A”'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('b').setDescription('Submit an answer choice “A”'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('c').setDescription('Submit an answer choice “A”'),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('d').setDescription('Submit an answer choice “A”'),
      ),
  ].map((command) => command.toJSON())

  const rest = new REST({ version: '9' }).setToken(context.discordToken)
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  })
  return 'Successfully registered application commands.'
}
