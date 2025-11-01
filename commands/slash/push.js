const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed, ChannelType, PermissionsBitField } = require("discord.js");

// Tipos válidos para canais de voz (aceita tanto strings quanto números)
const validVoiceTypes = ["GUILD_VOICE", "GUILD_STAGE_VOICE", 2, 13];

const command = new SlashCommand()
  .setName("push")
  .setDescription("Moves a user to a selected voice channel or loops them between two channels (admin only)")
  // Opção obrigatória: selecione o canal de voz principal
  .addChannelOption((option) =>
    option
      .setName("channel")
      .setDescription("Select the voice channel you want to join")
      .setRequired(true)
      .addChannelTypes(ChannelType?.GuildVoice || 2, ChannelType?.GuildStageVoice || 13)
  )
  // Opção opcional: selecione um segundo canal para looping
  .addChannelOption((option) =>
    option
      .setName("channel2")
      .setDescription("Select a second voice channel for looping (optional)")
      .setRequired(false)
      .addChannelTypes(ChannelType?.GuildVoice || 2, ChannelType?.GuildStageVoice || 13)
  )
  // Opção opcional: selecione o usuário alvo (padrão: quem executou)
  .addUserOption((option) =>
    option
      .setName("target")
      .setDescription("The user to be moved (defaults to you)")
      .setRequired(false)
  )
  // Opção opcional: ativa o looping (requer canal2)
  .addBooleanOption((option) =>
    option
      .setName("loop")
      .setDescription("Enable looping between two channels (requires a second channel)")
      .setRequired(false)
  )
  .setRun(async (client, interaction) => {
    // Verifica se o usuário que executa o comando tem permissão de Administrador ou é o admin global
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
      interaction.user.id !== client.config.adminId
    ) {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          new MessageEmbed()
            .setColor("RED")
            .setDescription("You must have Administrator permission on this server to use this command.")
        ]
      });
    }

    // Defer a resposta para evitar timeout
    await interaction.deferReply({ ephemeral: true });

    // Determina o usuário alvo (padrão: quem executa)
    const targetUser = interaction.options.getUser("target") || interaction.user;
    const member = interaction.guild.members.cache.get(targetUser.id);

    const channel1 = interaction.options.getChannel("channel");
    const channel2 = interaction.options.getChannel("channel2");
    const loopEnabled = interaction.options.getBoolean("loop") || false;

    // Valida se channel1 é um canal de voz
    if (!validVoiceTypes.includes(channel1.type)) {
      return interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setColor("RED")
            .setDescription("The selected primary channel is not a voice channel!")
        ]
      });
    }

    // Se o looping estiver habilitado, confirma se channel2 foi fornecido e é válido
    const doLoop = loopEnabled && channel2;
    if (loopEnabled && !channel2) {
      return interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setColor("RED")
            .setDescription("Looping is enabled, but no second channel was selected!")
        ]
      });
    }
    if (doLoop && !validVoiceTypes.includes(channel2.type)) {
      return interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setColor("RED")
            .setDescription("The second selected channel is not a voice channel!")
        ]
      });
    }

    // Verifica se o usuário alvo está conectado a um canal de voz
    if (!member.voice.channel) {
      return interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setColor("RED")
            .setDescription("The target user is not connected to a voice channel.")
        ]
      });
    }

    // Se looping estiver habilitado e channel2 estiver presente, inicia o looping; caso contrário, apenas move o usuário
    if (doLoop) {
      try {
        await member.voice.setChannel(channel1);
      } catch (error) {
        console.error(error);
        return interaction.editReply({
          embeds: [
            new MessageEmbed()
              .setColor("RED")
              .setDescription("Error moving the user to the primary channel initially.")
          ]
        });
      }

      await interaction.editReply({
        embeds: [
          new MessageEmbed()
            .setColor(client.config.embedColor)
            .setDescription(`Started looping ${targetUser.tag} between ${channel1.name} and ${channel2.name}.`)
        ]
      });

      let currentChannel = channel1;
      const interval = setInterval(async () => {
        // Se o usuário sair do canal, encerra o loop
        if (!member.voice.channel) {
          clearInterval(interval);
          return;
        }
        currentChannel = currentChannel.id === channel1.id ? channel2 : channel1;
        try {
          await member.voice.setChannel(currentChannel);
        } catch (err) {
          console.error(err);
        }
      }, 1000); // Intervalo de 1000ms para um looping mais rápido

      // Opcional: armazena o intervalo para permitir que o loop seja interrompido posteriormente
      if (!client.loopIntervals) client.loopIntervals = new Map();
      client.loopIntervals.set(member.id, interval);
    } else {
      try {
        await member.voice.setChannel(channel1);
        await interaction.editReply({
          embeds: [
            new MessageEmbed()
              .setColor(client.config.embedColor)
              .setDescription(`Moved ${targetUser.tag} to ${channel1.name}.`)
          ]
        });
      } catch (error) {
        console.error(error);
        await interaction.editReply({
          embeds: [
            new MessageEmbed()
              .setColor("RED")
              .setDescription("Error moving the user to the voice channel.")
          ]
        });
      }
    }
  });

module.exports = command;
