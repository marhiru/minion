const SlashCommand = require("../../lib/SlashCommand");
const { 
    MessageEmbed, 
    Permissions,
    MessageActionRow,
    MessageButton
} = require("discord.js");

const command = new SlashCommand()
    .setName("kick")
    .setDescription("Kick a user from the server")
    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("The user to kick")
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("reason")
            .setDescription("Reason for kicking the user")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        // Check if the user has permission to kick members
        if (!interaction.member.permissions.has(Permissions.FLAGS.KICK_MEMBERS)) {
            return interaction.reply({
                content: "You don't have permission to kick members!",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "No reason provided";

        // Check if the user is valid
        if (!targetUser) {
            return interaction.editReply({
                content: "Please provide a valid user to kick."
            });
        }

        // Check if the user is trying to kick themselves
        if (targetUser.id === interaction.user.id) {
            return interaction.editReply({
                content: "You cannot kick yourself!"
            });
        }

        // Check if the user is trying to kick the bot
        if (targetUser.id === client.user.id) {
            return interaction.editReply({
                content: "I cannot kick myself!"
            });
        }

        try {
            // Get the member object
            const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

            // Check if user is in the server
            if (!targetMember) {
                return interaction.editReply({
                    content: "This user is not in the server!"
                });
            }

            // Check if the bot can kick the user (role hierarchy)
            if (!targetMember.kickable) {
                return interaction.editReply({
                    content: "I cannot kick this user! They may have a higher role than me or I don't have proper permissions."
                });
            }

            // Check if the user trying to kick has a higher role than the target
            if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && 
                interaction.guild.ownerId !== interaction.user.id) {
                return interaction.editReply({
                    content: "You cannot kick this user as they have the same or higher role than you!"
                });
            }

            // Create confirmation message
            const confirmEmbed = new MessageEmbed()
                .setTitle("Confirm Kick")
                .setDescription(`Are you sure you want to kick **${targetUser.tag}** (${targetUser.id})?`)
                .addField("Reason", reason)
                .setColor("ORANGE")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const confirmRow = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("kick_confirm")
                    .setLabel("Confirm")
                    .setStyle("DANGER")
                    .setEmoji("✅"),
                new MessageButton()
                    .setCustomId("kick_cancel")
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
                            (i.customId === "kick_confirm" || i.customId === "kick_cancel"),
                time: 30000, // 30 seconds
                max: 1
            });

            collector.on("collect", async i => {
                if (i.customId === "kick_confirm") {
                    try {
                        // Try to DM the kicked user before kicking
                        try {
                            const dmEmbed = new MessageEmbed()
                                .setTitle(`You were kicked from ${interaction.guild.name}`)
                                .setDescription(`You have been kicked from ${interaction.guild.name}`)
                                .addField("Reason", reason)
                                .setColor("ORANGE")
                                .setTimestamp();

                            await targetUser.send({ embeds: [dmEmbed] });
                        } catch (error) {
                            console.log(`Could not DM user ${targetUser.tag}: ${error.message}`);
                        }

                        // Kick the user
                        await targetMember.kick(`${reason} | Kicked by ${interaction.user.tag}`);
                        
                        // Create success embed
                        const successEmbed = new MessageEmbed()
                            .setTitle("User Kicked")
                            .setDescription(`Successfully kicked **${targetUser.tag}** (${targetUser.id})`)
                            .addField("Reason", reason)
                            .addField("Kicked by", `${interaction.user.tag} (${interaction.user.id})`)
                            .setColor("GREEN")
                            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                            .setTimestamp();
                            
                        await i.update({
                            embeds: [successEmbed],
                            components: []
                        });
                        
                        // Log the kick if a log channel is set up
                        if (client.config.modLogChannel) {
                            const logChannel = interaction.guild.channels.cache.get(client.config.modLogChannel);
                            if (logChannel) {
                                logChannel.send({ embeds: [successEmbed] }).catch(console.error);
                            }
                        }
                    } catch (error) {
                        console.error("Error kicking user:", error);
                        await i.update({
                            content: `Failed to kick user: ${error.message}`,
                            embeds: [],
                            components: []
                        });
                    }
                } else if (i.customId === "kick_cancel") {
                    const cancelEmbed = new MessageEmbed()
                        .setTitle("Kick Cancelled")
                        .setDescription(`Kick for **${targetUser.tag}** has been cancelled.`)
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
                        .setTitle("Kick Cancelled")
                        .setDescription("Kick confirmation timed out.")
                        .setColor("BLUE")
                        .setTimestamp();
                        
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error("Error in kick command:", error);
            return interaction.editReply({
                content: `An error occurred while trying to kick the user: ${error.message}`
            });
        }
    });

module.exports = command;