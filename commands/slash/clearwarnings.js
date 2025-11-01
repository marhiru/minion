const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");
const fs = require("fs");
const path = require("path");

const command = new SlashCommand()
	.setName("clearwarnings")
	.setDescription("Clears warnings for a user")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to clear warnings for")
			.setRequired(true)
	)
	.addIntegerOption((option) =>
		option
			.setName("count")
			.setDescription("Number of warnings to clear (leave empty to clear all)")
			.setRequired(false)
	)
	.setRun(async (client, interaction) => {
		// Check if user is an admin
		const isAdmin = interaction.member.permissions.has("ADMINISTRATOR");
		
		// Check if user is in the admin list
		const adminIds = client.config.adminId || [];
		const isListedAdmin = adminIds.includes(interaction.user.id);
		
		if (!isAdmin && !isListedAdmin) {
			return interaction.reply({
				content: "You need to be an administrator to use this command!",
				ephemeral: true
			});
		}
		
		const target = interaction.options.getUser("user");
		const count = interaction.options.getInteger("count");
		
		try {
			// Load database
			const dbPath = path.join(process.cwd(), "db.json");
			
			// Check if db.json exists
			if (!fs.existsSync(dbPath)) {
				return interaction.reply({
					content: `${target.tag} has no warnings to clear.`,
					ephemeral: false
				});
			}
			
			const data = fs.readFileSync(dbPath, "utf8");
			let db = JSON.parse(data);
			
			// Check if warnings exist for the server and user
			const guildId = interaction.guild.id;
			if (!db.warnings || !db.warnings[guildId] || !db.warnings[guildId][target.id] || db.warnings[guildId][target.id].length === 0) {
				return interaction.reply({
					content: `${target.tag} has no warnings to clear.`,
					ephemeral: false
				});
			}
			
			const userWarnings = db.warnings[guildId][target.id];
			const originalCount = userWarnings.length;
			
			// Clear all or specific number of warnings
			if (!count || count >= originalCount) {
				// Clear all warnings
				db.warnings[guildId][target.id] = [];
			} else {
				// Clear specific number of warnings (most recent first)
				db.warnings[guildId][target.id] = userWarnings.slice(0, userWarnings.length - count);
			}
			
			// Save to db.json
			fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
			
			// Calculate how many warnings were cleared
			const clearedCount = count ? Math.min(count, originalCount) : originalCount;
			const remainingCount = db.warnings[guildId][target.id].length;
			
			// Create embed
			const clearEmbed = new MessageEmbed()
				.setTitle("Warnings Cleared")
				.setColor("#00FF00")
				.setThumbnail(target.displayAvatarURL())
				.addField("User", `${target.tag} (${target.id})`, false)
				.addField("Moderator", `${interaction.user.tag}`, false)
				.addField("Warnings Cleared", `${clearedCount}`, false)
				.addField("Remaining Warnings", `${remainingCount}`, false)
				.setTimestamp();
			
			return interaction.reply({ embeds: [clearEmbed] });
		} catch (error) {
			console.error("Error in clearwarnings command:", error);
			return interaction.reply({
				content: `An error occurred: ${error.message}`,
				ephemeral: true
			});
		}
	});

module.exports = command;