const SlashCommand = require("../../lib/SlashCommand");
const { 
    MessageEmbed, 
    Permissions,
    MessageActionRow,
    MessageButton
} = require("discord.js");

const command = new SlashCommand()
    .setName("unban")
    .setDescription("Unban a user from the server")
    .addStringOption(option =>
        option
            .setName("user_id")
            .setDescription("The ID of the user to unban")
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("reason")
            .setDescription("Reason for unbanning the user")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        // Check if the user has permission to ban members
        if (!interaction.member.permissions.has(Permissions.FLAGS.BAN_MEMBERS)) {
            return interaction.reply({
                content: "You don't have permission to unban members!",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.options.getString("user_id");
        const reason = interaction.options.getString("reason") || "No reason provided";

        // Check if the user ID is valid
        if (!/^\d+$/.test(userId)) {
            return interaction.editReply({
                content: "Please provide a valid user ID (numbers only)."
            });
        }

        try {
            // Fetch ban list to check if the user is banned
            const banList = await interaction.guild.bans.fetch();
            const bannedUser = banList.find(ban => ban.user.id === userId);

            if (!bannedUser) {
                return interaction.editReply({
                    content: `User with ID ${userId} is not banned from this server.`
                });
            }

            // Create confirmation message
            const confirmEmbed = new MessageEmbed()
                .setTitle("Confirm Unban")
                .setDescription(`Are you sure you want to unban **${bannedUser.user.tag}** (${bannedUser.user.id})?`)
                .addField("Original Ban Reason", bannedUser.reason || "No reason provided")
                .addField("Unban Reason", reason)
                .setColor("YELLOW")
                .setThumbnail(bannedUser.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const confirmRow = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("unban_confirm")
                    .setLabel("Confirm")
                    .setStyle("SUCCESS")
                    .setEmoji("✅"),
                new MessageButton()
                    .setCustomId("unban_cancel")
                    .setLabel("Cancel")
                    .setStyle("DANGER")
                    .setEmoji("❌")
            );

            const confirmMessage = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });

            // Create collector for button interactions
            const collector = confirmMessage.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && 
                            (i.customId === "unban_confirm" || i.customId === "unban_cancel"),
                time: 30000, // 30 seconds
                max: 1
            });

            collector.on("collect", async i => {
                if (i.customId === "unban_confirm") {
                    try {
                        // Unban the user
                        await interaction.guild.members.unban(userId, `${reason} | Unbanned by ${interaction.user.tag}`);
                        
                        // Create success embed
                        const successEmbed = new MessageEmbed()
                            .setTitle("User Unbanned")
                            .setDescription(`Successfully unbanned **${bannedUser.user.tag}** (${bannedUser.user.id})`)
                            .addField("Reason", reason)
                            .addField("Unbanned by", `${interaction.user.tag} (${interaction.user.id})`)
                            .setColor("GREEN")
                            .setThumbnail(bannedUser.user.displayAvatarURL({ dynamic: true }))
                            .setTimestamp();
                            
                        await i.update({
                            embeds: [successEmbed],
                            components: []
                        });
                        
                        // Log the unban if a log channel is set up
                        if (client.config.modLogChannel) {
                            const logChannel = interaction.guild.channels.cache.get(client.config.modLogChannel);
                            if (logChannel) {
                                logChannel.send({ embeds: [successEmbed] }).catch(console.error);
                            }
                        }
                    } catch (error) {
                        console.error("Error unbanning user:", error);
                        await i.update({
                            content: `Failed to unban user: ${error.message}`,
                            embeds: [],
                            components: []
                        });
                    }
                } else if (i.customId === "unban_cancel") {
                    const cancelEmbed = new MessageEmbed()
                        .setTitle("Unban Cancelled")
                        .setDescription(`Unban for **${bannedUser.user.tag}** has been cancelled.`)
                        .setColor("BLUE")
                        .setTimestamp();
                        
                    await i.update({
                        embeds: [cancelEmbed],
                        components: []
                    });
                }
            });

            collector.on("end", async (collected, reason) => {
                if (reason === "time" && collected.size === 0) {
                    const timeoutEmbed = new MessageEmbed()
                        .setTitle("Unban Cancelled")
                        .setDescription("Unban confirmation timed out.")
                        .setColor("BLUE")
                        .setTimestamp();
                        
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error("Error in unban command:", error);
            return interaction.editReply({
                content: `An error occurred while trying to unban the user: ${error.message}`
            });
        }
    });

module.exports = command;