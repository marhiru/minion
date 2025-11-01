const SlashCommand = require("../../lib/SlashCommand");
const { 
    MessageEmbed, 
    Permissions,
    MessageActionRow,
    MessageButton
} = require("discord.js");

const command = new SlashCommand()
    .setName("ban")
    .setDescription("Ban a user from the server")
    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("The user to ban")
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("reason")
            .setDescription("Reason for banning the user")
            .setRequired(false)
    )
    .addIntegerOption(option =>
        option
            .setName("days")
            .setDescription("Number of days of messages to delete (0-7)")
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(7)
    )
    .setRun(async (client, interaction) => {
        // Check if the user has permission to ban members
        if (!interaction.member.permissions.has(Permissions.FLAGS.BAN_MEMBERS)) {
            return interaction.reply({
                content: "You don't have permission to ban members!",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "No reason provided";
        const days = interaction.options.getInteger("days") || 0;

        // Check if the user is valid
        if (!targetUser) {
            return interaction.editReply({
                content: "Please provide a valid user to ban."
            });
        }

        // Check if the user is trying to ban themselves
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({
                content: "You cannot ban yourself!"
            });
        }

        // Check if the user is trying to ban the bot
        if (targetUser.id === client.user.id) {
            return interaction.editReply({
                content: "I cannot ban myself!"
            });
        }

        try {
            // Get the member object
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            // Check if user is in the server
            if (targetMember) {
                // Check if the bot can ban the user (role hierarchy)
                if (!targetMember.bannable) {
                    return interaction.editReply({
                        content: "I cannot ban this user! They may have a higher role than me or I don't have proper permissions."
                    });
                }

                // Check if the user trying to ban has a higher role than the target
                if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && 
                    interaction.guild.ownerId !== interaction.user.id) {
                    return interaction.editReply({
                        content: "You cannot ban this user as they have the same or higher role than you!"
                    });
                }
            }

            // Create confirmation message
            const confirmEmbed = new MessageEmbed()
                .setTitle("Confirm Ban")
                .setDescription(`Are you sure you want to ban **${targetUser.tag}** (${targetUser.id})?`)
                .addField("Reason", reason)
                .addField("Delete Messages", `${days} day(s)`)
                .setColor("RED")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const confirmRow = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("ban_confirm")
                    .setLabel("Confirm")
                    .setStyle("DANGER")
                    .setEmoji("✅"),
                new MessageButton()
                    .setCustomId("ban_cancel")
                    .setLabel("Cancel")
                    .setStyle("SECONDARY")
                    .setEmoji("❌")
            );

            const confirmMessage = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });

            // Create collector for button interactions
            const collector = confirmMessage.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && 
                            (i.customId === "ban_confirm" || i.customId === "ban_cancel"),
                time: 30000, // 30 seconds
                max: 1
            });

            collector.on("collect", async i => {
                if (i.customId === "ban_confirm") {
                    try {
                        // Ban the user
                        await interaction.guild.members.ban(targetUser.id, { 
                            reason: `${reason} | Banned by ${interaction.user.tag}`,
                            days: days
                        });
                        
                        // Create success embed
                        const successEmbed = new MessageEmbed()
                            .setTitle("User Banned")
                            .setDescription(`Successfully banned **${targetUser.tag}** (${targetUser.id})`)
                            .addField("Reason", reason)
                            .addField("Delete Messages", `${days} day(s)`)
                            .addField("Banned by", `${interaction.user.tag} (${interaction.user.id})`)
                            .setColor("GREEN")
                            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                            .setTimestamp();
                            
                        await i.update({
                            embeds: [successEmbed],
                            components: []
                        });
                        
                        // Log the ban if a log channel is set up
                        if (client.config.modLogChannel) {
                            const logChannel = interaction.guild.channels.cache.get(client.config.modLogChannel);
                            if (logChannel) {
                                logChannel.send({ embeds: [successEmbed] }).catch(console.error);
                            }
                        }

                        // Try to DM the banned user
                        try {
                            const dmEmbed = new MessageEmbed()
                                .setTitle(`You were banned from ${interaction.guild.name}`)
                                .setDescription(`You have been banned from ${interaction.guild.name}`)
                                .addField("Reason", reason)
                                .setColor("RED")
                                .setTimestamp();

                            await targetUser.send({ embeds: [dmEmbed] });
                        } catch (error) {
                            console.log(`Could not DM user ${targetUser.tag}: ${error.message}`);
                        }
                    } catch (error) {
                        console.error("Error banning user:", error);
                        await i.update({
                            content: `Failed to ban user: ${error.message}`,
                            embeds: [],
                            components: []
                        });
                    }
                } else if (i.customId === "ban_cancel") {
                    const cancelEmbed = new MessageEmbed()
                        .setTitle("Ban Cancelled")
                        .setDescription(`Ban for **${targetUser.tag}** has been cancelled.`)
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
                        .setTitle("Ban Cancelled")
                        .setDescription("Ban confirmation timed out.")
                        .setColor("BLUE")
                        .setTimestamp();
                        
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error("Error in ban command:", error);
            return interaction.editReply({
                content: `An error occurred while trying to ban the user: ${error.message}`
            });
        }
    });

module.exports = command;