const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");
const fs = require("fs");
const path = require("path");

const command = new SlashCommand()
	.setName("warn")
	.setDescription("Warns a user")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user you want to warn")
			.setRequired(true)
	)
	.addStringOption((option) =>
		option
			.setName("reason")
			.setDescription("Reason for the warning")
			.setRequired(false)
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
		const reason = interaction.options.getString("reason") || "No reason provided";
		
		// Check if the user is trying to warn themselves
		if (target.id === interaction.user.id) {
			return interaction.reply({
				content: "You cannot warn yourself!",
				ephemeral: true
			});
		}
		
		// Check if the user is trying to warn the bot
		if (target.id === client.user.id) {
			return interaction.reply({
				content: "You cannot warn me!",
				ephemeral: true
			});
		}
		
		// Get the guild member
		const member = interaction.guild.members.cache.get(target.id);
		
		// Check if the target exists in the server
		if (!member) {
			return interaction.reply({
				content: "This user is not in the server!",
				ephemeral: true
			});
		}
		
		// Check role hierarchy
		if (member.roles.highest.position >= interaction.member.roles.highest.position && interaction.guild.ownerId !== interaction.user.id && !isListedAdmin) {
			return interaction.reply({
				content: "You cannot warn someone with a role equal to or higher than yours!",
				ephemeral: true
			});
		}
		
		try {
			// Load database
			const dbPath = path.join(process.cwd(), "db.json");
			let db = {};
			
			// Check if db.json exists, if not create it
			if (fs.existsSync(dbPath)) {
				const data = fs.readFileSync(dbPath, "utf8");
				db = JSON.parse(data);
			}
			
			// Initialize warnings structure if it doesn't exist
			if (!db.warnings) {
				db.warnings = {};
			}
			
			// Initialize guild warnings if they don't exist
			const guildId = interaction.guild.id;
			if (!db.warnings[guildId]) {
				db.warnings[guildId] = {};
			}
			
			// Initialize user warnings if they don't exist
			if (!db.warnings[guildId][target.id]) {
				db.warnings[guildId][target.id] = [];
			}
			
			// Add new warning
			const warning = {
				moderator: interaction.user.id,
				reason: reason,
				timestamp: Date.now()
			};
			
			db.warnings[guildId][target.id].push(warning);
			
			// Save to db.json
			fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
			
			// Get total warnings count
			const warningsCount = db.warnings[guildId][target.id].length;
			
			// Create warning embed
			const warnEmbed = new MessageEmbed()
				.setTitle("User Warned")
				.setColor("#FFCC00")
				.setThumbnail(target.displayAvatarURL())
				.addField("User", `${target.tag} (${target.id})`, false)
				.addField("Moderator", `${interaction.user.tag}`, false)
				.addField("Reason", reason, false)
				.addField("Total Warnings", `${warningsCount}`, false)
				.setTimestamp();
			
			// Notify the user via DM
			try {
				const dmEmbed = new MessageEmbed()
					.setTitle(`You were warned in ${interaction.guild.name}`)
					.setColor("#FFCC00")
					.addField("Moderator", `${interaction.user.tag}`, false)
					.addField("Reason", reason, false)
					.addField("Total Warnings", `${warningsCount}`, false)
					.setTimestamp();
				
				await target.send({ embeds: [dmEmbed] }).catch(() => {
					// Ignore DM errors (user may have DMs disabled)
				});
			} catch (error) {
				console.error("Error sending DM:", error);
			}
			
			return interaction.reply({ embeds: [warnEmbed] });
		} catch (error) {
			console.error("Error in warn command:", error);
			return interaction.reply({
				content: `An error occurred: ${error.message}`,
				ephemeral: true
			});
		}
	});

module.exports = command;