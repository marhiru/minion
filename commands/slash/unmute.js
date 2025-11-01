const SlashCommand = require("../../lib/SlashCommand");
const { 
    MessageEmbed, 
    Permissions,
    MessageActionRow,
    MessageButton
} = require("discord.js");

const command = new SlashCommand()
    .setName("unmute")
    .setDescription("Unmute a muted user in the server")
    .addUserOption(option =>
        option
            .setName("user")
            .setDescription("The user to unmute")
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName("reason")
            .setDescription("Reason for unmuting the user")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        // Check if the user has permission to moderate members
        if (!interaction.member.permissions.has(Permissions.FLAGS.MODERATE_MEMBERS)) {
            return interaction.reply({
                content: "You don't have permission to unmute members!",
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason") || "No reason provided";

        // Check if the user is valid
        if (!targetUser) {
            return interaction.editReply({
                content: "Please provide a valid user to unmute."
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

            // Find the muted role
            const mutedRole = interaction.guild.roles.cache.find(role => role.name === "Muted");
            
            // Check if there's a muted role and if the user has it
            if (!mutedRole || !targetMember.roles.cache.has(mutedRole.id)) {
                // Also check if the user is timed out
                if (!targetMember.communicationDisabledUntil) {
                    return interaction.editReply({
                        content: "This user is not muted!"
                    });
                }
            }

            // Create confirmation message
            const confirmEmbed = new MessageEmbed()
                .setTitle("Confirm Unmute")
                .setDescription(`Are you sure you want to unmute **${targetUser.tag}** (${targetUser.id})?`)
                .addField("Reason", reason)
                .setColor("GREEN")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

            const confirmRow = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("unmute_confirm")
                    .setLabel("Confirm")
                    .setStyle("SUCCESS")
                    .setEmoji("✅"),
                new MessageButton()
                    .setCustomId("unmute_cancel")
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
                            (i.customId === "unmute_confirm" || i.customId === "unmute_cancel"),
                time: 30000, // 30 seconds
                max: 1
            });

            collector.on("collect", async i => {
                if (i.customId === "unmute_confirm") {
                    try {
                        // Remove timeout if there is one
                        if (targetMember.communicationDisabledUntil) {
                            await targetMember.timeout(null, `${reason} | Unmuted by ${interaction.user.tag}`);
                        }
                        
                        // Remove muted role if it exists and member has it
                        if (mutedRole && targetMember.roles.cache.has(mutedRole.id)) {
                            await targetMember.roles.remove(mutedRole, `${reason} | Unmuted by ${interaction.user.tag}`);
                        }
                        
                        // Try to DM the unmuted user
                        try {
                            const dmEmbed = new MessageEmbed()
                                .setTitle(`You were unmuted in ${interaction.guild.name}`)
                                .setDescription(`You have been unmuted in ${interaction.guild.name}`)
                                .addField("Reason", reason)
                                .setColor("GREEN")
                                .setTimestamp();

                            await targetUser.send({ embeds: [dmEmbed] });
                        } catch (error) {
                            console.log(`Could not DM user ${targetUser.tag}: ${error.message}`);
                        }
                        
                        // Create success embed
                        const successEmbed = new MessageEmbed()
                            .setTitle("User Unmuted")
                            .setDescription(`Successfully unmuted **${targetUser.tag}** (${targetUser.id})`)
                            .addField("Reason", reason)
                            .addField("Unmuted by", `${interaction.user.tag} (${interaction.user.id})`)
                            .setColor("GREEN")
                            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                            .setTimestamp();
                            
                        await i.update({
                            embeds: [successEmbed],
                            components: []
                        });
                        
                        // Log the unmute if a log channel is set up
                        if (client.config.modLogChannel) {
                            const logChannel = interaction.guild.channels.cache.get(client.config.modLogChannel);
                            if (logChannel) {
                                logChannel.send({ embeds: [successEmbed] }).catch(console.error);
                            }
                        }
                    } catch (error) {
                        console.error("Error unmuting user:", error);
                        await i.update({
                            content: `Failed to unmute user: ${error.message}`,
                            embeds: [],
                            components: []
                        });
                    }
                } else if (i.customId === "unmute_cancel") {
                    const cancelEmbed = new MessageEmbed()
                        .setTitle("Unmute Cancelled")
                        .setDescription(`Unmute for **${targetUser.tag}** has been cancelled.`)
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
                        .setTitle("Unmute Cancelled")
                        .setDescription("Unmute confirmation timed out.")
                        .setColor("BLUE")
                        .setTimestamp();
                        
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: []
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error("Error in unmute command:", error);
            return interaction.editReply({
                content: `An error occurred while trying to unmute the user: ${error.message}`
            });
        }
    });

module.exports = command;