const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");

const command = new SlashCommand()
	.setName("avatar")
	.setDescription("Shows the avatar of a user")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user whose avatar you want to see")
			.setRequired(false)
	)
	.setRun(async (client, interaction) => {
		// Get the target user (or the command user if no target specified)
		const target = interaction.options.getUser("user") || interaction.user;
		
		// Get avatar URL in different formats
		const avatarURL = target.displayAvatarURL({ dynamic: true, size: 4096 });
		const pngURL = target.displayAvatarURL({ format: "png", size: 4096 });
		const jpgURL = target.displayAvatarURL({ format: "jpg", size: 4096 });
		const webpURL = target.displayAvatarURL({ format: "webp", size: 4096 });
		
		// Create embed
		const avatarEmbed = new MessageEmbed()
			.setTitle(`${target.tag}'s Avatar`)
			.setColor(client.config.embedColor)
			.setImage(avatarURL)
			.setDescription(`[PNG](${pngURL}) | [JPG](${jpgURL}) | [WEBP](${webpURL})`)
			.setFooter({ text: `Requested by ${interaction.user.tag}` })
			.setTimestamp();
		
		return interaction.reply({ embeds: [avatarEmbed] });
	});

module.exports = command;