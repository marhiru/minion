const SlashCommand = require("../../lib/SlashCommand");
const { 
    MessageEmbed, 
    MessageActionRow, 
    MessageButton, 
    MessageSelectMenu,
    Permissions
} = require("discord.js");
const fs = require("fs");
const path = require("path");

// Database functions for autorole configuration
function getDBPath() {
    return path.join(process.cwd(), "db.json");
}

function loadDB() {
    try {
        const dbPath = getDBPath();
        if (!fs.existsSync(dbPath)) {
            return { autoroles: {} };
        }
        const data = fs.readFileSync(dbPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading database:", error);
        return { autoroles: {} };
    }
}

function saveDB(db) {
    try {
        const dbPath = getDBPath();
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
        return true;
    } catch (error) {
        console.error("Error saving database:", error);
        return false;
    }
}

function getGuildAutoroles(guildId) {
    const db = loadDB();
    if (!db.autoroles) db.autoroles = {};
    if (!db.autoroles[guildId]) db.autoroles[guildId] = {
        joinRoles: [],
        reactionRoles: []
    };
    return db.autoroles[guildId];
}

function saveGuildAutoroles(guildId, autoroleData) {
    const db = loadDB();
    if (!db.autoroles) db.autoroles = {};
    db.autoroles[guildId] = autoroleData;
    return saveDB(db);
}

// Main command definition
const command = new SlashCommand()
    .setName("autorole")
    .setDescription("Configure automatic roles for new members and reaction systems")
    .addSubcommand(subcommand =>
        subcommand
            .setName("join")
            .setDescription("Configure automatic roles for new members")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("reaction")
            .setDescription("Configure a reaction role system")
            .addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("Channel where the message will be sent")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("list")
            .setDescription("List all configured autoroles")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("remove")
            .setDescription("Remove an autorole configuration")
    )
    .setRun(async (client, interaction) => {
        // Check permissions
        if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) {
            return interaction.reply({
                content: "You need the **Manage Roles** permission to use this command!",
                ephemeral: true
            });
        }

        // Check if bot has permission to manage roles
        if (!interaction.guild.me.permissions.has(Permissions.FLAGS.MANAGE_ROLES)) {
            return interaction.reply({
                content: "I need the **Manage Roles** permission to execute this command!",
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        
        // Load current autorole settings
        const guildId = interaction.guild.id;
        const autoroleData = getGuildAutoroles(guildId);
        
        // Handle different subcommands
        switch (subcommand) {
            case "join":
                await handleJoinAutorole(interaction, autoroleData);
                break;
            case "reaction":
                await handleReactionAutorole(interaction, autoroleData, client);
                break;
            case "list":
                await handleListAutoroles(interaction, autoroleData);
                break;
            case "remove":
                await handleRemoveAutorole(interaction, autoroleData);
                break;
        }
    });

// Handler for join autorole configuration
async function handleJoinAutorole(interaction, autoroleData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get all server roles
    const allRoles = await interaction.guild.roles.fetch();
    
    // Filter roles that the bot can assign
    const availableRoles = allRoles.filter(role => 
        role.position < interaction.guild.me.roles.highest.position && 
        !role.managed && 
        role.id !== interaction.guild.id
    );
    
    if (availableRoles.size === 0) {
        return interaction.editReply("I couldn't find any roles that I can automatically assign. Make sure my role is above the roles you want to configure.");
    }
    
    // Prepare options for the select menu
    const roleOptions = Array.from(availableRoles.values()).map(role => ({
        label: role.name.length > 25 ? role.name.substring(0, 22) + "..." : role.name,
        description: `ID: ${role.id}`,
        value: role.id,
        emoji: "🏷️"
    }));
    
    // Create the initial embed
    const embed = new MessageEmbed()
        .setTitle("🔄 Join Autorole Configuration")
        .setColor(interaction.client.config.embedColor)
        .setDescription(
            "Select the roles that will be automatically assigned to new members when they join the server."
        );
    
    // Add information about already configured roles
    if (autoroleData.joinRoles && autoroleData.joinRoles.length > 0) {
        const configuredRoles = autoroleData.joinRoles.map(roleId => {
            const role = interaction.guild.roles.cache.get(roleId);
            return role ? `<@&${roleId}>` : `Unknown role (${roleId})`;
        }).join(", ");
        
        embed.addField("Currently Configured Roles", configuredRoles);
    } else {
        embed.addField("Currently Configured Roles", "No roles configured");
    }
    
    // Create the select menu
    const selectMenu = new MessageSelectMenu()
        .setCustomId("autorole_join_select")
        .setPlaceholder("Select automatic roles")
        .setMinValues(0)
        .setMaxValues(Math.min(roleOptions.length, 25))
        .addOptions(roleOptions);
    
    const selectMenuRow = new MessageActionRow().addComponents(selectMenu);
    
    // Add buttons for confirmation
    const buttonRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId("autorole_join_save")
            .setLabel("Save Configuration")
            .setStyle("SUCCESS")
            .setEmoji("💾"),
        new MessageButton()
            .setCustomId("autorole_join_clear")
            .setLabel("Clear Selection")
            .setStyle("DANGER")
            .setEmoji("🗑️")
    );
    
    // Send the initial message
    const message = await interaction.editReply({
        embeds: [embed],
        components: [selectMenuRow, buttonRow]
    });
    
    // Prepare the configuration state
    const configState = {
        selectedRoles: [...(autoroleData.joinRoles || [])]
    };
    
    // Create a collector for interactions
    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 300000 // 5 minutes
    });
    
    collector.on("collect", async i => {
        // Update immediately to avoid errors
        await i.deferUpdate().catch(console.error);
        
        if (i.customId === "autorole_join_select") {
            // Update selected roles
            configState.selectedRoles = i.values;
            
            // Update the embed with selected roles
            const updatedEmbed = new MessageEmbed()
                .setTitle("🔄 Join Autorole Configuration")
                .setColor(interaction.client.config.embedColor)
                .setDescription(
                    "Select the roles that will be automatically assigned to new members when they join the server."
                );
            
            if (configState.selectedRoles.length > 0) {
                const selectedRolesText = configState.selectedRoles.map(roleId => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    return role ? `<@&${roleId}>` : `Unknown role (${roleId})`;
                }).join(", ");
                
                updatedEmbed.addField("Selected Roles", selectedRolesText);
            } else {
                updatedEmbed.addField("Selected Roles", "No roles selected");
            }
            
            // Update the message
            await i.editReply({
                embeds: [updatedEmbed],
                components: [selectMenuRow, buttonRow]
            });
        } 
        else if (i.customId === "autorole_join_save") {
            // Save the configuration
            autoroleData.joinRoles = configState.selectedRoles;
            const success = saveGuildAutoroles(interaction.guild.id, autoroleData);
            
            if (success) {
                // Update the embed with success message
                const successEmbed = new MessageEmbed()
                    .setTitle("✅ Configuration Saved")
                    .setColor("#00FF00")
                    .setDescription(
                        "The join autorole configuration has been saved successfully!"
                    );
                
                if (configState.selectedRoles.length > 0) {
                    const selectedRolesText = configState.selectedRoles.map(roleId => {
                        const role = interaction.guild.roles.cache.get(roleId);
                        return role ? `<@&${roleId}>` : `Unknown role (${roleId})`;
                    }).join(", ");
                    
                    successEmbed.addField("Configured Roles", selectedRolesText);
                } else {
                    successEmbed.addField("Configured Roles", "No roles configured. New members will not receive automatic roles.");
                }
                
                // Disable all buttons
                const disabledButtonRow = new MessageActionRow().addComponents(
                    buttonRow.components.map(button => 
                        new MessageButton()
                            .setCustomId(button.customId)
                            .setLabel(button.label)
                            .setStyle(button.style)
                            .setEmoji(button.emoji)
                            .setDisabled(true)
                    )
                );
                
                await i.editReply({
                    embeds: [successEmbed],
                    components: [disabledButtonRow]
                });
                
                // End the collector
                collector.stop();
            } else {
                // Display error message
                await interaction.followUp({
                    content: "❌ An error occurred while saving the configuration. Please try again.",
                    ephemeral: true
                });
            }
        }
        else if (i.customId === "autorole_join_clear") {
            // Clear the selection
            configState.selectedRoles = [];
            
            // Update the select menu
            const updatedEmbed = new MessageEmbed()
                .setTitle("🔄 Join Autorole Configuration")
                .setColor(interaction.client.config.embedColor)
                .setDescription(
                    "Select the roles that will be automatically assigned to new members when they join the server."
                )
                .addField("Selected Roles", "No roles selected");
            
            await i.editReply({
                embeds: [updatedEmbed],
                components: [selectMenuRow, buttonRow]
            });
        }
    });
    
    collector.on("end", async (collected, reason) => {
        if (reason === "time") {
            // Display timeout message
            const timeoutEmbed = new MessageEmbed()
                .setTitle("⏱️ Time Out")
                .setColor("#FF0000")
                .setDescription("The autorole configuration has been canceled due to inactivity.");
            
            // Disable all components
            const components = message.components.map(row => {
                const newRow = new MessageActionRow();
                row.components.forEach(component => {
                    if (component.type === "BUTTON") {
                        newRow.addComponents(
                            new MessageButton()
                                .setCustomId(component.customId)
                                .setLabel(component.label)
                                .setStyle(component.style)
                                .setEmoji(component.emoji)
                                .setDisabled(true)
                        );
                    } else if (component.type === "SELECT_MENU") {
                        newRow.addComponents(
                            new MessageSelectMenu()
                                .setCustomId(component.customId)
                                .setPlaceholder(component.placeholder)
                                .setDisabled(true)
                                .addOptions({ label: "Expired", value: "expired", description: "This selection has expired" })
                        );
                    }
                });
                return newRow;
            });
            
            await interaction.editReply({
                embeds: [timeoutEmbed],
                components: components
            }).catch(console.error);
        }
    });
}

// Handler for reaction autorole configuration
async function handleReactionAutorole(interaction, autoroleData, client) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get the selected channel
    const channel = interaction.options.getChannel("channel");
    
    // Check if the bot has permission to send messages in the channel
    if (!channel.permissionsFor(interaction.guild.me).has(Permissions.FLAGS.SEND_MESSAGES)) {
        return interaction.editReply(`I don't have permission to send messages in the channel ${channel}. Please choose another channel or adjust my permissions.`);
    }
    
    // Get all server roles
    const allRoles = await interaction.guild.roles.fetch();
    
    // Filter roles that the bot can assign
    const availableRoles = allRoles.filter(role => 
        role.position < interaction.guild.me.roles.highest.position && 
        !role.managed && 
        role.id !== interaction.guild.id
    );
    
    if (availableRoles.size === 0) {
        return interaction.editReply("I couldn't find any roles that I can automatically assign. Make sure my role is above the roles you want to configure.");
    }
    
    // Configuration state
    const configState = {
        channel: channel,
        messageContent: "",
        roles: [],
        emojis: [],
        step: "message",
        currentEmbed: null
    };
    
    // Function to update the configuration embed
    function updateConfigEmbed() {
        const embed = new MessageEmbed()
            .setTitle("⚙️ Reaction Autorole Configuration")
            .setColor(interaction.client.config.embedColor);
        
        switch (configState.step) {
            case "message":
                embed.setDescription(
                    "Type the text that will appear in the reaction selection message.\n\n" +
                    "You can use markdown and mentions if you want. Write an attractive message that explains how the role system works."
                );
                embed.addField("Next Step", "After defining the message, you will select the roles and emojis.");
                break;
                
            case "roles":
                embed.setDescription(
                    "Select the roles that will be available in the reaction system.\n\n" +
                    "You can select up to 20 different roles."
                );
                
                if (configState.messageContent) {
                    embed.addField("Defined Message", 
                        configState.messageContent.length > 1024 
                            ? configState.messageContent.substring(0, 1021) + "..." 
                            : configState.messageContent
                    );
                }
                
                if (configState.roles.length > 0) {
                    const rolesText = configState.roles.map(roleId => {
                        const role = interaction.guild.roles.cache.get(roleId);
                        return role ? `<@&${roleId}>` : `Unknown role (${roleId})`;
                    }).join(", ");
                    
                    embed.addField("Selected Roles", rolesText);
                }
                break;
                
            case "emojis":
                embed.setDescription(
                    "Associate an emoji with each selected role.\n\n" +
                    "Click the button corresponding to each role and then send the desired emoji in the chat."
                );
                
                // List roles and their associated emojis
                configState.roles.forEach((roleId, index) => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    const emoji = configState.emojis[index] || "❓";
                    
                    if (role) {
                        embed.addField(`Role #${index + 1}`, `${emoji} <@&${roleId}>`);
                    }
                });
                break;
                
            case "preview":
                embed.setDescription(
                    "Review your reaction role system configuration.\n\n" +
                    "If you are satisfied, click \"Create System\" to finalize the configuration."
                );
                
                embed.addField("Channel", `<#${configState.channel.id}>`);
                
                if (configState.messageContent) {
                    embed.addField("Message", 
                        configState.messageContent.length > 1024 
                            ? configState.messageContent.substring(0, 1021) + "..." 
                            : configState.messageContent
                    );
                }
                
                // List roles and their associated emojis
                if (configState.roles.length > 0) {
                    let rolesAndEmojis = "";
                    configState.roles.forEach((roleId, index) => {
                        const role = interaction.guild.roles.cache.get(roleId);
                        const emoji = configState.emojis[index];
                        
                        if (role) {
                            rolesAndEmojis += `${emoji} <@&${roleId}>\n`;
                        }
                    });
                    
                    embed.addField("Roles and Emojis", rolesAndEmojis);
                }
                break;
        }
        
        return embed;
    }
    
    // Function to create components based on the current step
    function createComponents() {
        switch (configState.step) {
            case "message":
                return [
                    new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("autorole_message_continue")
                            .setLabel("Continue to Role Selection")
                            .setStyle("PRIMARY")
                            .setEmoji("➡️")
                    )
                ];
                
            case "roles":
                // Prepare options for the select menu
                const roleOptions = Array.from(availableRoles.values()).map(role => ({
                    label: role.name.length > 25 ? role.name.substring(0, 22) + "..." : role.name,
                    description: `ID: ${role.id}`,
                    value: role.id,
                    emoji: "🏷️"
                }));
                
                return [
                    new MessageActionRow().addComponents(
                        new MessageSelectMenu()
                            .setCustomId("autorole_roles_select")
                            .setPlaceholder("Select roles (maximum 20)")
                            .setMinValues(1)
                            .setMaxValues(Math.min(20, roleOptions.length))
                            .addOptions(roleOptions.slice(0, 25))
                    ),
                    new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("autorole_roles_back")
                            .setLabel("Back to Message")
                            .setStyle("SECONDARY")
                            .setEmoji("⬅️"),
                        new MessageButton()
                            .setCustomId("autorole_roles_continue")
                            .setLabel("Continue to Emojis")
                            .setStyle("PRIMARY")
                            .setEmoji("➡️")
                            .setDisabled(configState.roles.length === 0)
                    )
                ];
                
            case "emojis":
                // Create buttons for each role
                const rows = [];
                
                // Group buttons in rows of up to 5
                for (let i = 0; i < configState.roles.length; i += 5) {
                    const row = new MessageActionRow();
                    
                    for (let j = i; j < Math.min(i + 5, configState.roles.length); j++) {
                        const role = interaction.guild.roles.cache.get(configState.roles[j]);
                        const emoji = configState.emojis[j] || "❓";
                        
                        if (role) {
                            row.addComponents(
                                new MessageButton()
                                    .setCustomId(`autorole_emoji_${j}`)
                                    .setLabel(role.name.length > 10 ? role.name.substring(0, 7) + "..." : role.name)
                                    .setStyle("SECONDARY")
                                    .setEmoji(emoji)
                            );
                        }
                    }
                    
                    rows.push(row);
                }
                
                // Add navigation buttons
                rows.push(
                    new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("autorole_emojis_back")
                            .setLabel("Back to Roles")
                            .setStyle("SECONDARY")
                            .setEmoji("⬅️"),
                        new MessageButton()
                            .setCustomId("autorole_emojis_continue")
                            .setLabel("Continue to Preview")
                            .setStyle("PRIMARY")
                            .setEmoji("➡️")
                            .setDisabled(configState.emojis.filter(e => e).length !== configState.roles.length)
                    )
                );
                
                return rows;
                
            case "preview":
                return [
                    new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("autorole_preview_back")
                            .setLabel("Back to Emojis")
                            .setStyle("SECONDARY")
                            .setEmoji("⬅️"),
                        new MessageButton()
                            .setCustomId("autorole_preview_create")
                            .setLabel("Create System")
                            .setStyle("SUCCESS")
                            .setEmoji("✅")
                    )
                ];
        }
    }
    
    // Start the configurator with the message definition step
    configState.currentEmbed = updateConfigEmbed();
    
    const initialMessage = await interaction.editReply({
        embeds: [configState.currentEmbed],
        components: createComponents()
    });
    
    // Create a collector for button and menu interactions
    const componentCollector = initialMessage.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 600000 // 10 minutes
    });
    
    // Create a collector for messages (to collect message content and emojis)
    const messageCollector = interaction.channel.createMessageCollector({
        filter: m => m.author.id === interaction.user.id,
        time: 600000 // 10 minutes
    });
    
    // Flags to control which collector is active
    let waitingForMessage = true;
    let waitingForEmoji = false;
    let currentEmojiIndex = -1;
    
    // Process received messages
    messageCollector.on("collect", async message => {
        // If we're waiting for the system message
        if (waitingForMessage && configState.step === "message") {
            // Save the message content
            configState.messageContent = message.content;
            waitingForMessage = false;
            
            // Try to delete the user's message to keep the chat clean
            try {
                await message.delete();
            } catch (error) {
                console.error("Could not delete message:", error);
            }
            
            // Update the embed to show the defined message
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the configurator message
            await interaction.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
            
            // Send confirmation
            await interaction.followUp({
                content: "✅ Message defined successfully! Now select the roles.",
                ephemeral: true
            });
        }
        // If we're waiting for an emoji
        else if (waitingForEmoji && configState.step === "emojis" && currentEmojiIndex !== -1) {
            // Try to extract the emoji from the message
            const emojiRegex = /<?(a)?:?(\w+):(\d+)>?|(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
            const emojiMatch = emojiRegex.exec(message.content);
            
            if (emojiMatch) {
                let emoji;
                
                // If it's a custom Discord emoji
                if (emojiMatch[1] !== undefined || emojiMatch[3] !== undefined) {
                    const animated = emojiMatch[1] !== undefined;
                    const name = emojiMatch[2];
                    const id = emojiMatch[3];
                    
                    emoji = `<${animated ? 'a' : ''}:${name}:${id}>`;
                } 
                // If it's a unicode emoji
                else {
                    emoji = emojiMatch[0];
                }
                
                // Save the emoji for the current role
                configState.emojis[currentEmojiIndex] = emoji;
                waitingForEmoji = false;
                currentEmojiIndex = -1;
                
                // Try to delete the user's message to keep the chat clean
                try {
                    await message.delete();
                } catch (error) {
                    console.error("Could not delete message:", error);
                }
                
                // Update the embed and components
                configState.currentEmbed = updateConfigEmbed();
                
                await interaction.editReply({
                    embeds: [configState.currentEmbed],
                    components: createComponents()
                });
                
                // Send confirmation
                await interaction.followUp({
                    content: "✅ Emoji added successfully!",
                    ephemeral: true
                });
            } else {
                // If no valid emoji was found
                try {
                    await message.delete();
                } catch (error) {
                    console.error("Could not delete message:", error);
                }
                
                await interaction.followUp({
                    content: "❌ Invalid emoji. Please send a valid emoji.",
                    ephemeral: true
                });
            }
        }
    });
    
    // Process component interactions
    componentCollector.on("collect", async i => {
        // Update immediately to avoid errors
        await i.deferUpdate().catch(console.error);
        
        // Process different interactions based on the component ID
        if (i.customId === "autorole_message_continue") {
            // If no message has been defined yet, request one
            if (!configState.messageContent) {
                await interaction.followUp({
                    content: "Please send the message that will appear in the reaction role system.",
                    ephemeral: true
                });
                waitingForMessage = true;
                return;
            }
            
            // Advance to the role selection step
            configState.step = "roles";
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the message
            await i.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
        }
        else if (i.customId === "autorole_roles_select") {
            // Save the selected roles
            configState.roles = i.values;
            
            // Initialize the emojis array with the same size as the roles array
            configState.emojis = new Array(configState.roles.length).fill(null);
            
            // Update the embed
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the buttons (enable the continue button if there are selected roles)
            await i.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
        }
        else if (i.customId === "autorole_roles_back") {
            // Go back to the message definition step
            configState.step = "message";
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the message
            await i.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
        }
        else if (i.customId === "autorole_roles_continue") {
            // Advance to the emoji selection step
            configState.step = "emojis";
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the message
            await i.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
        }
        else if (i.customId.startsWith("autorole_emoji_")) {
            // Extract the role index
            const index = parseInt(i.customId.split("_")[2]);
            
            // Request the emoji for this role
            const role = interaction.guild.roles.cache.get(configState.roles[index]);
            
            await interaction.followUp({
                content: `Please send the emoji you want to associate with the role ${role.name}.`,
                ephemeral: true
            });
            
            // Set the state to wait for the emoji
            waitingForEmoji = true;
            currentEmojiIndex = index;
        }
        else if (i.customId === "autorole_emojis_back") {
            // Go back to the role selection step
            configState.step = "roles";
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the message
            await i.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
        }
        else if (i.customId === "autorole_emojis_continue") {
            // Check if all roles have associated emojis
            if (configState.emojis.filter(e => e).length !== configState.roles.length) {
                await interaction.followUp({
                    content: "❌ Please associate an emoji with each role before continuing.",
                    ephemeral: true
                });
                return;
            }
            
            // Advance to the preview step
            configState.step = "preview";
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the message
            await i.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
        }
        else if (i.customId === "autorole_preview_back") {
            // Go back to the emoji selection step
            configState.step = "emojis";
            configState.currentEmbed = updateConfigEmbed();
            
            // Update the message
            await i.editReply({
                embeds: [configState.currentEmbed],
                components: createComponents()
            });
        }
        else if (i.customId === "autorole_preview_create") {
            // Create the reaction autorole system
            try {
                // Create the embed for the reaction message
                const reactionEmbed = new MessageEmbed()
                    .setTitle("🎭 Reaction Role System")
                    .setColor(interaction.client.config.embedColor)
                    .setDescription(configState.messageContent)
                    .setFooter({ 
                        text: `System created by ${interaction.user.tag}`,
                        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                    })
                    .setTimestamp();
                
                // Add roles and emojis to the embed
                let rolesAndEmojis = "";
                configState.roles.forEach((roleId, index) => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    const emoji = configState.emojis[index];
                    
                    if (role) {
                        rolesAndEmojis += `${emoji} <@&${roleId}>\n`;
                    }
                });
                
                reactionEmbed.addField("Available Roles", rolesAndEmojis);
                
                // Send the message in the selected channel
                const reactionMessage = await configState.channel.send({
                    embeds: [reactionEmbed]
                });
                
                // Add reactions to the message
                for (const emoji of configState.emojis) {
                    try {
                        // Extract the emoji ID or name for reaction
                        let reactionEmoji;
                        
                        // Check if it's a custom emoji
                        const customEmojiMatch = emoji.match(/<a?:(\w+):(\d+)>/);
                        if (customEmojiMatch) {
                            reactionEmoji = customEmojiMatch[2]; // Use the emoji ID
                        } else {
                            reactionEmoji = emoji; // Use the unicode emoji
                        }
                        
                        await reactionMessage.react(reactionEmoji);
                        // Small delay to avoid rate limiting
                        await new Promise(resolve => setTimeout(resolve, 750));
                    } catch (error) {
                        console.error(`Error adding reaction ${emoji}:`, error);
                    }
                }
                
                // Save the configuration to the database
                const reactionRoleConfig = {
                    messageId: reactionMessage.id,
                    channelId: configState.channel.id,
                    roles: configState.roles,
                    emojis: configState.emojis
                };
                
                if (!autoroleData.reactionRoles) {
                    autoroleData.reactionRoles = [];
                }
                
                autoroleData.reactionRoles.push(reactionRoleConfig);
                
                const success = saveGuildAutoroles(interaction.guild.id, autoroleData);
                
                if (success) {
                    // Display success message
                    const successEmbed = new MessageEmbed()
                        .setTitle("✅ Reaction Role System Created")
                        .setColor("#00FF00")
                        .setDescription(
                            `The reaction role system has been created successfully in the channel ${configState.channel}!\n\n` +
                            `[Click here to view the message](https://discord.com/channels/${interaction.guild.id}/${configState.channel.id}/${reactionMessage.id})`
                        );
                    
                    // Disable all buttons
                    const disabledButtonRow = new MessageActionRow().addComponents(
                        new MessageButton()
                            .setCustomId("autorole_preview_back")
                            .setLabel("Back to Emojis")
                            .setStyle("SECONDARY")
                            .setEmoji("⬅️")
                            .setDisabled(true),
                        new MessageButton()
                            .setCustomId("autorole_preview_create")
                            .setLabel("Create System")
                            .setStyle("SUCCESS")
                            .setEmoji("✅")
                            .setDisabled(true)
                    );
                    
                    await i.editReply({
                        embeds: [successEmbed],
                        components: [disabledButtonRow]
                    });
                    
                    // End the collectors
                    componentCollector.stop();
                    messageCollector.stop();
                    
                    // Set up the reaction event for this system
                    setupReactionRoleEvents(client);
                } else {
                    // Display error message
                    await interaction.followUp({
                        content: "❌ An error occurred while saving the configuration. The system was created, but it may not work correctly.",
                        ephemeral: true
                    });
                }
            } catch (error) {
                console.error("Error creating reaction role system:", error);
                
                await interaction.followUp({
                    content: `❌ An error occurred while creating the reaction role system: ${error.message}`,
                    ephemeral: true
                });
            }
        }
    });
    
    // Handle configurator timeout
    componentCollector.on("end", async (collected, reason) => {
        if (reason === "time") {
            // Display timeout message
            const timeoutEmbed = new MessageEmbed()
                .setTitle("⏱️ Time Out")
                .setColor("#FF0000")
                .setDescription("The autorole configuration has been canceled due to inactivity.");
            
            // Disable all components
            const components = [];
            
            await interaction.editReply({
                embeds: [timeoutEmbed],
                components: components
            }).catch(console.error);
            
            // Stop the message collector as well
            messageCollector.stop();
        }
    });
}

// Handler for listing autoroles
async function handleListAutoroles(interaction, autoroleData) {
    await interaction.deferReply({ ephemeral: true });
    
    const embed = new MessageEmbed()
        .setTitle("📋 Autorole Configurations")
        .setColor(interaction.client.config.embedColor)
        .setDescription("Here are all the active autorole configurations in this server.");
    
    // Check if there are join autoroles configured
    if (autoroleData.joinRoles && autoroleData.joinRoles.length > 0) {
        const joinRoles = autoroleData.joinRoles.map(roleId => {
            const role = interaction.guild.roles.cache.get(roleId);
            return role ? `<@&${roleId}>` : `Unknown role (${roleId})`;
        }).join(", ");
        
        embed.addField("🔄 Join Autorole", `The following roles are automatically assigned to new members:\n${joinRoles}`);
    } else {
        embed.addField("🔄 Join Autorole", "No join autorole configured.");
    }
    
    // Check if there are reaction systems configured
    if (autoroleData.reactionRoles && autoroleData.reactionRoles.length > 0) {
        let reactionRolesText = "";
        
        for (let i = 0; i < autoroleData.reactionRoles.length; i++) {
            const config = autoroleData.reactionRoles[i];
            const channel = interaction.guild.channels.cache.get(config.channelId);
            
            if (channel) {
                reactionRolesText += `**System #${i + 1}**: Channel: <#${config.channelId}> | [Message Link](https://discord.com/channels/${interaction.guild.id}/${config.channelId}/${config.messageId})\n`;
                
                // List the associated roles
                const rolesText = config.roles.map((roleId, index) => {
                    const role = interaction.guild.roles.cache.get(roleId);
                    const emoji = config.emojis[index];
                    return role ? `${emoji} <@&${roleId}>` : `${emoji} Unknown role (${roleId})`;
                }).join("\n");
                
                reactionRolesText += `${rolesText}\n\n`;
            }
        }
        
        if (reactionRolesText) {
            embed.addField("🎭 Reaction Systems", reactionRolesText);
        } else {
            embed.addField("🎭 Reaction Systems", "No valid reaction system found.");
        }
    } else {
        embed.addField("🎭 Reaction Systems", "No reaction system configured.");
    }
    
    // Buttons for additional actions
    const row = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId("autorole_list_remove")
            .setLabel("Remove Configuration")
            .setStyle("DANGER")
            .setEmoji("🗑️")
    );
    
    const message = await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
    
    // Collector for the buttons
    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000 // 1 minute
    });
    
    collector.on("collect", async i => {
        await i.deferUpdate().catch(console.error);
        
        if (i.customId === "autorole_list_remove") {
            // Redirect to the remove handler
            await handleRemoveAutorole(interaction, autoroleData);
            collector.stop();
        }
    });
    
    collector.on("end", async (collected, reason) => {
        if (reason === "time") {
            // Disable the buttons when the time expires
            const disabledRow = new MessageActionRow().addComponents(
                row.components.map(button => {
                    return new MessageButton()
                        .setCustomId(button.customId)
                        .setLabel(button.label)
                        .setStyle(button.style)
                        .setEmoji(button.emoji)
                        .setDisabled(true);
                })
            );
            
            await interaction.editReply({
                components: [disabledRow]
            }).catch(console.error);
        }
    });
}

// Handler for removing autoroles
async function handleRemoveAutorole(interaction, autoroleData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Check if there are any configurations to remove
    const hasJoinRoles = autoroleData.joinRoles && autoroleData.joinRoles.length > 0;
    const hasReactionRoles = autoroleData.reactionRoles && autoroleData.reactionRoles.length > 0;
    
    if (!hasJoinRoles && !hasReactionRoles) {
        return interaction.editReply("There are no autorole configurations to remove.");
    }
    
    // Create options for the select menu
    const options = [];
    
    if (hasJoinRoles) {
        options.push({
            label: "Join Autorole",
            description: "Remove the automatic role assignment for new members",
            value: "join",
            emoji: "🔄"
        });
    }
    
    if (hasReactionRoles) {
        for (let i = 0; i < autoroleData.reactionRoles.length; i++) {
            const config = autoroleData.reactionRoles[i];
            const channel = interaction.guild.channels.cache.get(config.channelId);
            
            if (channel) {
                options.push({
                    label: `Reaction System #${i + 1}`,
                    description: `Channel: ${channel.name}`,
                    value: `reaction_${i}`,
                    emoji: "🎭"
                });
            }
        }
    }
    
    // Create the select menu
    const row = new MessageActionRow().addComponents(
        new MessageSelectMenu()
            .setCustomId("autorole_remove_select")
            .setPlaceholder("Select the configuration to remove")
            .addOptions(options)
    );
    
    const embed = new MessageEmbed()
        .setTitle("🗑️ Remove Autorole Configuration")
        .setColor(interaction.client.config.embedColor)
        .setDescription("Select which autorole configuration you want to remove.")
        .setFooter({ text: "⚠️ Warning: This action cannot be undone!" });
    
    const message = await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
    
    // Collector for the select menu
    const collector = message.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id,
        time: 60000 // 1 minute
    });
    
    collector.on("collect", async i => {
        await i.deferUpdate().catch(console.error);
        
        if (i.customId === "autorole_remove_select") {
            const selectedValue = i.values[0];
            
            // Confirmation before removing
            const confirmRow = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("autorole_remove_confirm")
                    .setLabel("Confirm Removal")
                    .setStyle("DANGER")
                    .setEmoji("✅"),
                new MessageButton()
                    .setCustomId("autorole_remove_cancel")
                    .setLabel("Cancel")
                    .setStyle("SECONDARY")
                    .setEmoji("❌")
            );
            
            let confirmEmbed = new MessageEmbed()
                .setTitle("⚠️ Confirm Removal")
                .setColor("#FF0000")
                .setDescription("Are you sure you want to remove this configuration? This action cannot be undone.");
            
            if (selectedValue === "join") {
                confirmEmbed.addField("Configuration to be removed", "Join Autorole");
            } else if (selectedValue.startsWith("reaction_")) {
                const index = parseInt(selectedValue.split("_")[1]);
                const config = autoroleData.reactionRoles[index];
                const channel = interaction.guild.channels.cache.get(config.channelId);
                
                confirmEmbed.addField("Configuration to be removed", `Reaction System #${index + 1} in channel ${channel ? channel.name : "unknown"}`);
            }
            
            await i.editReply({
                embeds: [confirmEmbed],
                components: [confirmRow]
            });
            
            // Collector for confirmation
            const confirmCollector = message.createMessageComponentCollector({
                filter: j => j.user.id === interaction.user.id,
                time: 30000 // 30 seconds
            });
            
            confirmCollector.on("collect", async j => {
                await j.deferUpdate().catch(console.error);
                
                if (j.customId === "autorole_remove_confirm") {
                    // Remove the selected configuration
                    if (selectedValue === "join") {
                        autoroleData.joinRoles = [];
                    } else if (selectedValue.startsWith("reaction_")) {
                        const index = parseInt(selectedValue.split("_")[1]);
                        
                        // Try to remove reactions from the message before removing the configuration
                        try {
                            const config = autoroleData.reactionRoles[index];
                            const channel = interaction.guild.channels.cache.get(config.channelId);
                            
                            if (channel) {
                                const message = await channel.messages.fetch(config.messageId).catch(() => null);
                                if (message) {
                                    await message.reactions.removeAll().catch(() => null);
                                }
                            }
                        } catch (error) {
                            console.error("Error removing reactions:", error);
                        }
                        
                        // Remove the configuration
                        autoroleData.reactionRoles.splice(index, 1);
                    }
                    
                    // Save the changes
                    const success = saveGuildAutoroles(interaction.guild.id, autoroleData);
                    
                    if (success) {
                        const successEmbed = new MessageEmbed()
                            .setTitle("✅ Configuration Removed")
                            .setColor("#00FF00")
                            .setDescription("The autorole configuration has been removed successfully!");
                        
                        await j.editReply({
                            embeds: [successEmbed],
                            components: []
                        });
                    } else {
                        await j.editReply({
                            content: "❌ An error occurred while removing the configuration.",
                            embeds: [],
                            components: []
                        });
                    }
                } else if (j.customId === "autorole_remove_cancel") {
                    // Cancel the removal
                    const cancelEmbed = new MessageEmbed()
                        .setTitle("❌ Removal Canceled")
                        .setColor(interaction.client.config.embedColor)
                        .setDescription("The removal of the configuration has been canceled.");
                    
                    await j.editReply({
                        embeds: [cancelEmbed],
                        components: []
                    });
                }
                
                confirmCollector.stop();
            });
            
            confirmCollector.on("end", async (collected, reason) => {
                if (reason === "time" && collected.size === 0) {
                    try {
                        const timeoutEmbed = new MessageEmbed()
                            .setTitle("⏱️ Time Out")
                            .setColor("#FF0000")
                            .setDescription("The confirmation of removal expired.");
                        
                        await interaction.editReply({
                            embeds: [timeoutEmbed],
                            components: []
                        });
                    } catch (error) {
                        console.error("Error updating timeout message:", error);
                    }
                }
            });
            
            collector.stop();
        }
    });
    
    collector.on("end", async (collected, reason) => {
        if (reason === "time" && collected.size === 0) {
            try {
                const timeoutEmbed = new MessageEmbed()
                    .setTitle("⏱️ Time Out")
                    .setColor("#FF0000")
                    .setDescription("The selection of configuration for removal expired.");
                
                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: []
                });
            } catch (error) {
                console.error("Error updating timeout message:", error);
            }
        }
    });
}

// Set up events for autorole systems
function setupReactionRoleEvents(client) {
    console.log("Setting up autorole events...");

    // Event to assign role when a user adds a reaction
    client.on("messageReactionAdd", async (reaction, user) => {
        try {
            // Ignore bot reactions
            if (user.bot) return;
            
            // Fetch the complete reaction if it's partial
            if (reaction.partial) {
                await reaction.fetch();
            }
            
            // Fetch the complete message if it's partial
            if (reaction.message.partial) {
                await reaction.message.fetch();
            }
            
            // Check if the reaction is in a guild
            if (!reaction.message.guild) return;
            
            const guildId = reaction.message.guild.id;
            const messageId = reaction.message.id;
            
            // Load autorole settings
            const autoroleData = getGuildAutoroles(guildId);
            
            // Check if there are reaction systems configured
            if (!autoroleData.reactionRoles || autoroleData.reactionRoles.length === 0) return;
            
            // Find the system that matches the message
            const system = autoroleData.reactionRoles.find(s => s.messageId === messageId);
            if (!system) return;
            
            // Get the emoji from the reaction
            let emojiKey;
            if (reaction.emoji.id) {
                // Custom emoji
                emojiKey = reaction.emoji.id;
            } else {
                // Unicode emoji
                emojiKey = reaction.emoji.name;
            }
            
            // Find the index of the emoji in the system
            let roleIndex = -1;
            
            for (let i = 0; i < system.emojis.length; i++) {
                const configEmoji = system.emojis[i];
                
                // Check if the configured emoji contains the ID or name of the reaction emoji
                if (reaction.emoji.id && configEmoji.includes(reaction.emoji.id)) {
                    roleIndex = i;
                    break;
                } else if (!reaction.emoji.id && (configEmoji === reaction.emoji.name || configEmoji.includes(reaction.emoji.name))) {
                    roleIndex = i;
                    break;
                }
            }
            
            // If the emoji wasn't found, exit
            if (roleIndex === -1) return;
            
            // Get the role ID
            const roleId = system.roles[roleIndex];
            if (!roleId) return;
            
            // Get the member
            const member = await reaction.message.guild.members.fetch(user.id);
            if (!member) return;
            
            // Add the role
            try {
                await member.roles.add(roleId);
                console.log(`Role ${roleId} added to user ${user.tag}`);
            } catch (error) {
                console.error(`Error adding role: ${error.message}`);
            }
        } catch (error) {
            console.error("Error processing reaction:", error);
        }
    });
    
    // Event to remove role when a user removes a reaction
    client.on("messageReactionRemove", async (reaction, user) => {
        try {
            // Ignore bot reactions
            if (user.bot) return;
            
            // Fetch the complete reaction if it's partial
            if (reaction.partial) {
                await reaction.fetch();
            }
            
            // Fetch the complete message if it's partial
            if (reaction.message.partial) {
                await reaction.message.fetch();
            }
            
            // Check if the reaction is in a guild
            if (!reaction.message.guild) return;
            
            const guildId = reaction.message.guild.id;
            const messageId = reaction.message.id;
            
            // Load autorole settings
            const autoroleData = getGuildAutoroles(guildId);
            
            // Check if there are reaction systems configured
            if (!autoroleData.reactionRoles || autoroleData.reactionRoles.length === 0) return;
            
            // Find the system that matches the message
            const system = autoroleData.reactionRoles.find(s => s.messageId === messageId);
            if (!system) return;
            
            // Get the emoji from the reaction
            let emojiKey;
            if (reaction.emoji.id) {
                // Custom emoji
                emojiKey = reaction.emoji.id;
            } else {
                // Unicode emoji
                emojiKey = reaction.emoji.name;
            }
            
            // Find the index of the emoji in the system
            let roleIndex = -1;
            
            for (let i = 0; i < system.emojis.length; i++) {
                const configEmoji = system.emojis[i];
                
                // Check if the configured emoji contains the ID or name of the reaction emoji
                if (reaction.emoji.id && configEmoji.includes(reaction.emoji.id)) {
                    roleIndex = i;
                    break;
                } else if (!reaction.emoji.id && (configEmoji === reaction.emoji.name || configEmoji.includes(reaction.emoji.name))) {
                    roleIndex = i;
                    break;
                }
            }
            
            // If the emoji wasn't found, exit
            if (roleIndex === -1) return;
            
            // Get the role ID
            const roleId = system.roles[roleIndex];
            if (!roleId) return;
            
            // Get the member
            const member = await reaction.message.guild.members.fetch(user.id);
            if (!member) return;
            
            // Remove the role
            try {
                await member.roles.remove(roleId);
                console.log(`Role ${roleId} removed from user ${user.tag}`);
            } catch (error) {
                console.error(`Error removing role: ${error.message}`);
            }
        } catch (error) {
            console.error("Error processing reaction removal:", error);
        }
    });
    
    // Event to assign automatic roles to new members
    client.on("guildMemberAdd", async (member) => {
        try {
            // Ignore bots (optional)
            if (member.user.bot) return;
            
            // Load autorole settings
            const autoroleData = getGuildAutoroles(member.guild.id);
            
            // Check if there are join roles configured
            if (!autoroleData.joinRoles || autoroleData.joinRoles.length === 0) return;
            
            // Add each configured role
            for (const roleId of autoroleData.joinRoles) {
                try {
                    // Check if the role still exists
                    const role = member.guild.roles.cache.get(roleId);
                    if (!role) continue;
                    
                    // Check if the bot has permission to add the role
                    if (role.position >= member.guild.me.roles.highest.position) {
                        console.warn(`Could not add role ${role.name} to new member ${member.user.tag} because the role is above my highest role.`);
                        continue;
                    }
                    
                    // Add the role
                    await member.roles.add(roleId);
                    console.log(`Role ${role.name} added automatically to new member ${member.user.tag}`);
                } catch (error) {
                    console.error(`Error adding role ${roleId} to new member ${member.user.tag}:`, error);
                }
            }
        } catch (error) {
            console.error("Error processing new member:", error);
        }
    });
    
    console.log("Autorole events set up successfully!");
}

// Initialize the autorole events when the bot starts
function initialize(client) {
    setupReactionRoleEvents(client);
}

// Add the initialization function to the command
command.initialize = initialize;

module.exports = command;