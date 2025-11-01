const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");

const command = new SlashCommand()
	.setName("banner")
	.setDescription("Shows the banner of a user")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user whose banner you want to see")
			.setRequired(false)
	)
	.setRun(async (client, interaction) => {
		// Get the target user (or the command user if no target specified)
		const target = interaction.options.getUser("user") || interaction.user;
		
		try {
			// Fetch the user to get the banner
			const fetchedUser = await client.users.fetch(target.id, { force: true });
			
			// Check if the user has a banner
			if (!fetchedUser.banner) {
				return interaction.reply({
					content: `${target.tag} doesn't have a banner.`,
					ephemeral: true
				});
			}
			
			// Get banner URL in different formats
			const bannerURL = fetchedUser.bannerURL({ dynamic: true, size: 4096 });
			const pngURL = fetchedUser.bannerURL({ format: "png", size: 4096 });
			const jpgURL = fetchedUser.bannerURL({ format: "jpg", size: 4096 });
			const webpURL = fetchedUser.bannerURL({ format: "webp", size: 4096 });
			
			// Create embed
			const bannerEmbed = new MessageEmbed()
				.setTitle(`${target.tag}'s Banner`)
				.setColor(client.config.embedColor)
				.setImage(bannerURL)
				.setDescription(`[PNG](${pngURL}) | [JPG](${jpgURL}) | [WEBP](${webpURL})`)
				.setFooter({ text: `Requested by ${interaction.user.tag}` })
				.setTimestamp();
			
			return interaction.reply({ embeds: [bannerEmbed] });
		} catch (error) {
			console.error(error);
			return interaction.reply({
				content: `An error occurred while fetching the banner: ${error.message}`,
				ephemeral: true
			});
		}
	});

module.exports = command;