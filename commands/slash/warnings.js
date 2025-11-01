const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");
const fs = require("fs");
const path = require("path");

const command = new SlashCommand()
	.setName("warnings")
	.setDescription("Shows the warnings of a user")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to check warnings for")
			.setRequired(true)
	)
	.setRun(async (client, interaction) => {
		// Check if user is an admin or has moderate members permissions
		const isAdmin = interaction.member.permissions.has("ADMINISTRATOR");
		const canModerate = interaction.member.permissions.has("MODERATE_MEMBERS");
		
		// Check if user is in the admin list
		const adminIds = client.config.adminId || [];
		const isListedAdmin = adminIds.includes(interaction.user.id);
		
		if (!isAdmin && !canModerate && !isListedAdmin) {
			return interaction.reply({
				content: "You need to be an administrator to use this command!",
				ephemeral: true
			});
		}
		
		const target = interaction.options.getUser("user");
		
		try {
			// Load database
			const dbPath = path.join(process.cwd(), "db.json");
			let db = {};
			
			// Check if db.json exists
			if (!fs.existsSync(dbPath)) {
				return interaction.reply({
					content: `${target.tag} has no warnings in this server.`,
					ephemeral: false
				});
			}
			
			const data = fs.readFileSync(dbPath, "utf8");
			db = JSON.parse(data);
			
			// Check if warnings exist for the server and user
			const guildId = interaction.guild.id;
			if (!db.warnings || !db.warnings[guildId] || !db.warnings[guildId][target.id] || db.warnings[guildId][target.id].length === 0) {
				return interaction.reply({
					content: `${target.tag} has no warnings in this server.`,
					ephemeral: false
				});
			}
			
			const userWarnings = db.warnings[guildId][target.id];
			
			// Create embed with warnings
			const warningsEmbed = new MessageEmbed()
				.setTitle(`Warnings for ${target.tag}`)
				.setColor("#FFCC00")
				.setThumbnail(target.displayAvatarURL())
				.setDescription(`Total warnings: ${userWarnings.length}`)
				.setTimestamp();
			
			// Add each warning to the embed
			userWarnings.slice(0, 10).forEach((warning, index) => {
				const moderator = interaction.client.users.cache.get(warning.moderator) || { tag: "Unknown moderator" };
				const date = new Date(warning.timestamp).toLocaleString();
				
				warningsEmbed.addField(
					`Warning ${index + 1}`,
					`**Moderator:** ${moderator.tag}\n**Date:** ${date}\n**Reason:** ${warning.reason}`,
					false
				);
			});
			
			// If there are more than 10 warnings, add a note
			if (userWarnings.length > 10) {
				warningsEmbed.setFooter({ text: `Showing 10 of ${userWarnings.length} warnings` });
			}
			
			return interaction.reply({ embeds: [warningsEmbed] });
		} catch (error) {
			console.error("Error in warnings command:", error);
			return interaction.reply({
				content: `An error occurred: ${error.message}`,
				ephemeral: true
			});
		}
	});

module.exports = command;