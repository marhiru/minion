const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");

const command = new SlashCommand()
  .setName("stoploop")
  .setDescription("Stops the looping process for a user (defaults to you if not provided)")
  .addUserOption((option) =>
    option
      .setName("target")
      .setDescription("The user whose loop to stop (defaults to you if not provided)")
      .setRequired(false)
  )
  .setRun(async (client, interaction) => {
    // If not provided, use the user who executed the command
    const targetUser = interaction.options.getUser("target") || interaction.user;
    const member = interaction.guild.members.cache.get(targetUser.id);

    // Check if there is an active loop stored in client.loopIntervals
    if (!client.loopIntervals || !client.loopIntervals.has(member.id)) {
      return interaction.reply({
        ephemeral: true,
        embeds: [
          new MessageEmbed()
            .setColor("RED")
            .setDescription("No active looping process found for that user.")
        ]
      });
    }

    // Stop the interval and remove it from the map
    const loopInterval = client.loopIntervals.get(member.id);
    clearInterval(loopInterval);
    client.loopIntervals.delete(member.id);

    return interaction.reply({
      ephemeral: true,
      embeds: [
        new MessageEmbed()
          .setColor(client.config.embedColor)
          .setDescription(`Looping has been stopped for ${targetUser.tag}.`)
      ]
    });
  });

module.exports = command;
