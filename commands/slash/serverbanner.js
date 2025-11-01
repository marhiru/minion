const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");

const command = new SlashCommand()
	.setName("serverbanner")
	.setDescription("Shows the banner of the server")
	.setRun(async (client, interaction) => {
		// Get the server
		const guild = interaction.guild;
		
		// Check if the server has a banner
		if (!guild.banner) {
			return interaction.reply({
				content: "This server doesn't have a banner.",
				ephemeral: true
			});
		}
		
		// Get banner URL in different formats
		const bannerURL = guild.bannerURL({ dynamic: true, size: 4096 });
		const pngURL = guild.bannerURL({ format: "png", size: 4096 });
		const jpgURL = guild.bannerURL({ format: "jpg", size: 4096 });
		const webpURL = guild.bannerURL({ format: "webp", size: 4096 });
		
		// Create embed
		const serverBannerEmbed = new MessageEmbed()
			.setTitle(`${guild.name}'s Banner`)
			.setColor(client.config.embedColor)
			.setImage(bannerURL)
			.setDescription(`[PNG](${pngURL}) | [JPG](${jpgURL}) | [WEBP](${webpURL})`)
			.setFooter({ text: `Requested by ${interaction.user.tag}` })
			.setTimestamp();
		
		return interaction.reply({ embeds: [serverBannerEmbed] });
	});

module.exports = command;