const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

const command = new SlashCommand()
	.setName("votekick")
	.setDescription("Starts a vote to kick a user from the voice channel")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user you want to kick")
			.setRequired(true)
	)
	.setRun(async (client, interaction) => {
		// Get the vote target
		const target = interaction.options.getUser("user");
		const member = interaction.guild.members.cache.get(target.id);
		
		// Check if the target is in a voice channel
		if (!member.voice.channel) {
			return interaction.reply({
				content: "This user is not in a voice channel!",
				ephemeral: true
			});
		}
		
		// List of admin IDs (using bot configuration)
		const adminIds = client.config.adminId || [];
		
		// Create voting buttons
		const row = new MessageActionRow().addComponents(
			new MessageButton()
				.setCustomId("vote_yes")
				.setLabel("YES")
				.setStyle("SUCCESS"),
			new MessageButton()
				.setCustomId("vote_no")
				.setLabel("NO")
				.setStyle("DANGER")
		);
		
		// Vote time in milliseconds (5 minutes)
		const voteTime = 300000;
		
		// Create vote embed
		const voteEmbed = new MessageEmbed()
			.setTitle("Vote to Kick User")
			.setDescription(`A vote to kick ${target} was started by ${interaction.user}`)
			.setColor(client.config.embedColor)
			.addField("Target", `${target.tag}`, true)
			.addField("Initiator", `${interaction.user.tag}`, true)
			.addField("Status", "Vote in progress...", false)
			.setFooter({ text: `4 'Yes' votes are needed to kick the user.` });
		
		// Send message with buttons
		const message = await interaction.reply({
			embeds: [voteEmbed],
			components: [row],
			fetchReply: true
		});
		
		// Initialize vote counters
		const votes = {
			yes: 0,
			no: 0,
			voters: new Set()
		};
		
		// Create interaction collector for buttons
		const collector = message.createMessageComponentCollector({
			componentType: "BUTTON",
			time: voteTime // 5 minutes to vote
		});
		
		// Handle button interactions
		collector.on("collect", async (i) => {
			// Check if user has already voted
			if (votes.voters.has(i.user.id)) {
				return i.reply({
					content: "You have already voted in this poll!",
					ephemeral: true
				});
			}
			
			// Check if user is an administrator
			const isAdmin = adminIds.includes(i.user.id);
			
			// Register the vote
			votes.voters.add(i.user.id);
			
			if (i.customId === "vote_yes") {
				votes.yes++;
				
				if (isAdmin) {
					await i.reply({
						content: "You voted YES as an administrator. Your vote is decisive!",
						ephemeral: true
					});
					collector.stop("admin_approved");
				} else {
					await i.reply({
						content: "You voted YES to kick the user.",
						ephemeral: true
					});
				}
			} else if (i.customId === "vote_no") {
				votes.no++;
				
				if (isAdmin) {
					await i.reply({
						content: "You voted NO as an administrator. Your vote is decisive!",
						ephemeral: true
					});
					collector.stop("admin_rejected");
				} else {
					await i.reply({
						content: "You voted NO to kick the user.",
						ephemeral: true
					});
				}
			}
			
			// Update embed with current count
			voteEmbed.fields[2] = {
				name: "Status",
				value: `Yes Votes: ${votes.yes} | No Votes: ${votes.no}`,
				inline: false
			};
			
			await message.edit({ embeds: [voteEmbed] });
			
			// Check if we have enough votes to kick
			if (votes.yes >= 4) {
				collector.stop("approved");
			} else if (votes.no >= 4) {
				collector.stop("rejected");
			}
		});
		
		// When the vote ends
		collector.on("end", async (collected, reason) => {
			// Disable buttons
			row.components.forEach(button => button.setDisabled(true));
			
			let result = "";
			
			if (reason === "approved" || reason === "admin_approved") {
				// Kick the user
				try {
					await member.voice.disconnect();
					voteEmbed.setColor("#00FF00");
					
					if (reason === "admin_approved") {
						result = `An administrator decided to kick the user (${votes.yes} Yes votes, ${votes.no} No votes)`;
					} else {
						result = `The user was kicked from the voice channel (${votes.yes} Yes votes, ${votes.no} No votes)`;
					}
				} catch (error) {
					voteEmbed.setColor("#FF0000");
					result = `Error kicking the user: ${error.message}`;
				}
			} else if (reason === "rejected" || reason === "admin_rejected") {
				// Vote rejected
				voteEmbed.setColor("#FF0000");
				
				if (reason === "admin_rejected") {
					result = `An administrator decided not to kick the user (${votes.yes} Yes votes, ${votes.no} No votes)`;
				} else {
					result = `The user will not be kicked (${votes.yes} Yes votes, ${votes.no} No votes)`;
				}
			} else {
				// Time expired
				voteEmbed.setColor("#FF9900");
				result = `Time expired (${votes.yes} Yes votes, ${votes.no} No votes)`;
			}
			
			// Update final message
			voteEmbed.fields[2] = {
				name: "Status",
				value: `Vote completed: ${result}`,
				inline: false
			};
			
			// Update message one last time before deleting
			await message.edit({
				embeds: [voteEmbed],
				components: [row]
			});
			
			// Wait 5 seconds so users can see the final result
			setTimeout(async () => {
				try {
					// Send a temporary message with the result
					await interaction.channel.send({
						content: `**Result of vote to kick ${target.tag}**: ${result}`,
						allowedMentions: { parse: [] } // Avoid mentions
					});
					
					// Delete the original message
					await message.delete();
				} catch (error) {
					console.error("Erro ao deletar mensagem de votação:", error);
				}
			}, 15000); // 5 segundos de espera
		});
	});

module.exports = command;