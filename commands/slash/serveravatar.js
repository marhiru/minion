const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");

const command = new SlashCommand()
	.setName("serveravatar")
	.setDescription("Shows the icon of the server")
	.setRun(async (client, interaction) => {
		// Get the server
		const guild = interaction.guild;
		
		// Check if the server has an icon
		if (!guild.icon) {
			return interaction.reply({
				content: "This server doesn't have an icon.",
				ephemeral: true
			});
		}
		
		// Get icon URL in different formats
		const iconURL = guild.iconURL({ dynamic: true, size: 4096 });
		const pngURL = guild.iconURL({ format: "png", size: 4096 });
		const jpgURL = guild.iconURL({ format: "jpg", size: 4096 });
		const webpURL = guild.iconURL({ format: "webp", size: 4096 });
		
		// Create embed
		const serverAvatarEmbed = new MessageEmbed()
			.setTitle(`${guild.name}'s Icon`)
			.setColor(client.config.embedColor)
			.setImage(iconURL)
			.setDescription(`[PNG](${pngURL}) | [JPG](${jpgURL}) | [WEBP](${webpURL})`)
			.setFooter({ text: `Requested by ${interaction.user.tag}` })
			.setTimestamp();
		
		return interaction.reply({ embeds: [serverAvatarEmbed] });
	});

module.exports = command;