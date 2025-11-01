const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed, Permissions, MessageActionRow, MessageButton } = require("discord.js");

const command = new SlashCommand()
	.setName("botstats")
	.setDescription("Shows information about all servers the bot is in (Bot Owner Only)")
	.setRun(async (client, interaction) => {
		// Check if user is in the admin list
		const adminIds = client.config.adminId || [];
		if (!adminIds.includes(interaction.user.id)) {
			return interaction.reply({
				content: "This command is restricted to bot owners only!",
				ephemeral: true
			});
		}
		
		await interaction.deferReply({ ephemeral: true });
		
		try {
			// Get all guilds the bot is in
			const guilds = Array.from(client.guilds.cache.values());
			
			if (guilds.length === 0) {
				return interaction.editReply("The bot is not in any servers.");
			}
			
			// Create an array to store server information pages (1 server per page)
			const serverInfoPages = [];
			
			// Create main overview page
			const mainPageEmbed = new MessageEmbed()
				.setTitle(`${client.user.username} - Server Overview`)
				.setColor(client.config.embedColor)
				.setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 1024 }))
				.setDescription(`General information about the bot and the servers it's present in.`)
				.addField("Total Servers", `${guilds.length}`, true)
				.addField("Total Members", `${guilds.reduce((acc, guild) => acc + guild.memberCount, 0)}`, true);
			
			// Count voice channels the bot is connected to
			let voiceConnections = 0;
			if (client.manager) {
				voiceConnections = client.manager.players.size;
			}
			mainPageEmbed.addField("Active Voice Channels", `${voiceConnections}`, true);
			
			// Add uptime if available
			if (client.uptime) {
				const uptime = new Date(client.uptime);
				const days = Math.floor(uptime / 86400000);
				const hours = Math.floor(uptime / 3600000) % 24;
				const minutes = Math.floor(uptime / 60000) % 60;
				const seconds = Math.floor(uptime / 1000) % 60;
				
				const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
				mainPageEmbed.addField("Uptime", uptimeString, true);
			}
			
			// Add RAM usage
			const memoryUsage = process.memoryUsage();
			const memoryUsedMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
			mainPageEmbed.addField("Memory Usage", `${memoryUsedMB} MB`, true);
			
			// Add list of servers and their owners
			let serversList = "";
			for (let i = 0; i < guilds.length; i++) {
				const guild = guilds[i];
				let ownerInfo = "Unknown";
				try {
					const owner = await guild.fetchOwner();
					ownerInfo = owner.user.tag;
				} catch (error) {
					console.error(`Could not fetch owner for guild ${guild.name}:`, error);
				}
				
				serversList += `**${i+1}.** ${guild.name} (${guild.memberCount} members)\n   👑 ${ownerInfo}\n`;
				
				// Add a separator between entries except for the last one
				if (i < guilds.length - 1) {
					serversList += "\n";
				}
			}
			
			mainPageEmbed.addField("Server List", serversList.length > 1024 ? serversList.substring(0, 1021) + "..." : serversList);
			mainPageEmbed.setFooter({ text: `Main Page | Use the buttons below to see details for each server` });
			mainPageEmbed.setTimestamp();
			
			// Add main page as the first page
			serverInfoPages.push(mainPageEmbed);
			
			// Process each guild
			for (let i = 0; i < guilds.length; i++) {
				const guild = guilds[i];
				
				// Fetch owner information
				let ownerInfo = "Unknown";
				try {
					const owner = await guild.fetchOwner();
					ownerInfo = `${owner.user.tag} (${owner.user.id})`;
				} catch (error) {
					console.error(`Could not fetch owner for guild ${guild.name}:`, error);
				}
				
				// Get bot permissions in the guild
				const botMember = guild.members.cache.get(client.user.id);
				const permissionFlags = botMember.permissions.toArray();
				
				// Check for important permissions
				const hasAdmin = botMember.permissions.has(Permissions.FLAGS.ADMINISTRATOR);
				const canManageServer = botMember.permissions.has(Permissions.FLAGS.MANAGE_GUILD);
				const canBanMembers = botMember.permissions.has(Permissions.FLAGS.BAN_MEMBERS);
				const canManageRoles = botMember.permissions.has(Permissions.FLAGS.MANAGE_ROLES);
				const canManageChannels = botMember.permissions.has(Permissions.FLAGS.MANAGE_CHANNELS);
				const canKickMembers = botMember.permissions.has(Permissions.FLAGS.KICK_MEMBERS);
				
				// Format permissions for display
				let permissionsList = [];
				if (hasAdmin) permissionsList.push("✅ ADMINISTRATOR");
				else {
					permissionsList.push(canManageServer ? "✅ Manage Server" : "❌ Manage Server");
					permissionsList.push(canBanMembers ? "✅ Ban Members" : "❌ Ban Members");
					permissionsList.push(canKickMembers ? "✅ Kick Members" : "❌ Kick Members");
					permissionsList.push(canManageRoles ? "✅ Manage Roles" : "❌ Manage Roles");
					permissionsList.push(canManageChannels ? "✅ Manage Channels" : "❌ Manage Channels");
				}
				
				// Get server boost level
				const boostLevel = guild.premiumTier ? `Level ${guild.premiumTier}` : "Level 0";
				const boostCount = guild.premiumSubscriptionCount || 0;
				
				// Try to create an invite
				let inviteUrl = "No invite could be created";
				try {
					// Find a suitable channel for the invite
					const generalChannel = guild.channels.cache.find(
						channel => 
							channel.type === "GUILD_TEXT" && 
							channel.permissionsFor(client.user).has(Permissions.FLAGS.CREATE_INSTANT_INVITE)
					);
					
					if (generalChannel) {
						const invite = await generalChannel.createInvite({
							maxAge: 0, // 0 = permanent
							maxUses: 0, // 0 = unlimited
							unique: true,
							reason: "Bot admin requested server info"
						});
						inviteUrl = invite.url;
					}
				} catch (error) {
					console.error(`Could not create invite for guild ${guild.name}:`, error);
					inviteUrl = "Error creating invite";
				}
				
				// Create embed for this server
				const serverEmbed = new MessageEmbed()
					.setTitle(`${guild.name}`)
					.setColor(client.config.embedColor)
					.setDescription(`Server ID: ${guild.id}`)
					.setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }) || null)
					.addField("Members", `${guild.memberCount}`, true)
					.addField("Boost Status", `${boostLevel} (${boostCount} boosts)`, true)
					.addField("Owner", ownerInfo, false)
					.addField("Bot Permissions", permissionsList.join("\n"), false)
					.addField("Invite Link", inviteUrl, false)
					.setFooter({ text: `Server ${i + 1}/${guilds.length}` })
					.setTimestamp();
				
				// Add server banner if available
				if (guild.banner) {
					serverEmbed.setImage(guild.bannerURL({ dynamic: true, size: 4096 }));
				}
				
				serverInfoPages.push(serverEmbed);
			}
			
			// If there's only one page, send it directly
			if (serverInfoPages.length === 1) {
				return interaction.editReply({ embeds: [serverInfoPages[0]] });
			}
			
			// Otherwise, set up pagination
			let currentPageIndex = 0;
			
			// Create navigation buttons
			const row = new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId("prev_page")
					.setLabel("Previous")
					.setStyle("PRIMARY")
					.setDisabled(true),
				new MessageButton()
					.setCustomId("next_page")
					.setLabel("Next")
					.setStyle("PRIMARY")
					.setDisabled(false)
			);
			
			// Send the first page with navigation buttons
			const message = await interaction.editReply({
				embeds: [serverInfoPages[0]],
				components: [row],
				fetchReply: true
			});
			
			// Create a collector for button interactions
			const collector = message.createMessageComponentCollector({
				filter: (i) => i.user.id === interaction.user.id,
				time: 300000 // 5 minutes
			});
			
			collector.on("collect", async (i) => {
				if (i.customId === "prev_page") {
					currentPageIndex--;
				} else if (i.customId === "next_page") {
					currentPageIndex++;
				}
				
				// Update button states
				row.components[0].setDisabled(currentPageIndex === 0);
				row.components[1].setDisabled(currentPageIndex === serverInfoPages.length - 1);
				
				// Update the message with the new page
				await i.update({
					embeds: [serverInfoPages[currentPageIndex]],
					components: [row]
				});
			});
			
			collector.on("end", () => {
				// Disable all buttons when the collector ends
				row.components.forEach(button => button.setDisabled(true));
				
				// Update the message with disabled buttons
				interaction.editReply({ components: [row] }).catch(() => {});
			});
			
		} catch (error) {
			console.error("Error in botservers command:", error);
			return interaction.editReply({
				content: `An error occurred: ${error.message}`
			});
		}
	});

module.exports = command;