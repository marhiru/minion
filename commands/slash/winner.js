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

// Database functions for giveaways
function getDBPath() {
    return path.join(process.cwd(), "db.json");
}

function loadDB() {
    try {
        const dbPath = getDBPath();
        if (!fs.existsSync(dbPath)) {
            return { giveaways: {} };
        }
        const data = fs.readFileSync(dbPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading database:", error);
        return { giveaways: {} };
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

function getGuildGiveaways(guildId) {
    const db = loadDB();
    if (!db.giveaways) db.giveaways = {};
    if (!db.giveaways[guildId]) db.giveaways[guildId] = {
        activeGiveaways: {},
        pastGiveaways: {},
        giveawayCounter: 0
    };
    return db.giveaways[guildId];
}

function saveGuildGiveaways(guildId, giveawayData) {
    const db = loadDB();
    if (!db.giveaways) db.giveaways = {};
    db.giveaways[guildId] = giveawayData;
    return saveDB(db);
}

const command = new SlashCommand()
    .setName("winner")
    .setDescription("Manage giveaway winners")
    .addSubcommand(subcommand =>
        subcommand
            .setName("add")
            .setDescription("Add a winner manually to a giveaway")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addUserOption(option =>
                option
                    .setName("user")
                    .setDescription("User to add as a winner")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("remove")
            .setDescription("Remove a winner from a giveaway")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addUserOption(option =>
                option
                    .setName("user")
                    .setDescription("User to remove from winners")
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("list")
            .setDescription("List all winners of a giveaway")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("clear")
            .setDescription("Remove all winners from a giveaway")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("announce")
            .setDescription("Announce the winners of a giveaway again")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("Channel to announce winners (default: original giveaway channel)")
                    .setRequired(false)
            )
    )
    .setRun(async (client, interaction) => {
        // Set up autocomplete for this command (only once)
        if (!client.winnerAutocompleteSetup) {
            client.on("interactionCreate", async autocompleteInteraction => {
                if (!autocompleteInteraction.isAutocomplete()) return;
                
                // Check if it's a winner command
                if (autocompleteInteraction.commandName === "winner") {
                    // Get current value typed by user
                    const focusedOption = autocompleteInteraction.options.getFocused(true);
                    
                    if (focusedOption.name === "giveaway_id") {
                        // Load giveaway data for the server
                        const giveawayData = getGuildGiveaways(autocompleteInteraction.guild.id);
                        
                        // Prepare autocomplete options
                        const activeChoices = Object.entries(giveawayData.activeGiveaways || {}).map(([id, giveaway]) => ({
                            name: `#${id}: ${giveaway.prize} (Active)`,
                            value: id
                        }));
                        
                        const pastChoices = Object.entries(giveawayData.pastGiveaways || {}).map(([id, giveaway]) => ({
                            name: `#${id}: ${giveaway.prize} (Ended)`,
                            value: id
                        }));
                        
                        const choices = [...activeChoices, ...pastChoices];
                        
                        // Filter options based on typed value
                        const filtered = choices.filter(choice => 
                            choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                            choice.value.includes(focusedOption.value)
                        );
                        
                        // Limit to 25 options (Discord limit)
                        await autocompleteInteraction.respond(filtered.slice(0, 25));
                    }
                }
            });
            
            client.winnerAutocompleteSetup = true;
        }
        
        // Check permissions
        if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
            return interaction.reply({
                content: "You need Manage Server permission to manage giveaway winners.",
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        // Load giveaway data for the server
        const guildId = interaction.guild.id;
        const giveawayData = getGuildGiveaways(guildId);
        
        switch (subcommand) {
            case "add":
                await handleWinnerAdd(interaction, giveawayData);
                break;
                
            case "remove":
                await handleWinnerRemove(interaction, giveawayData);
                break;
                
            case "list":
                await handleWinnerList(interaction, giveawayData);
                break;
                
            case "clear":
                await handleWinnerClear(interaction, giveawayData);
                break;
                
            case "announce":
                await handleWinnerAnnounce(interaction, giveawayData);
                break;
        }
    });

// Handler to add a winner manually
async function handleWinnerAdd(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID and user
    const giveawayId = interaction.options.getString("giveaway_id");
    const user = interaction.options.getUser("user");
    
    // Check if the giveaway exists
    const giveaway = giveawayData.activeGiveaways?.[giveawayId] || giveawayData.pastGiveaways?.[giveawayId];
    
    if (!giveaway) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found.`);
    }
    
    // Check if user is already a winner
    if (giveaway.winners && giveaway.winners.includes(user.id)) {
        return interaction.editReply(`❌ ${user} is already a winner of this giveaway.`);
    }
    
    // Add user to winners
    if (!giveaway.winners) giveaway.winners = [];
    giveaway.winners.push(user.id);
    
    // Save changes
    saveGuildGiveaways(interaction.guild.id, giveawayData);
    
    await interaction.editReply(`✅ ${user} has been added as a winner of giveaway #${giveawayId}.`);
}

// Handler to remove a winner
async function handleWinnerRemove(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID and user
    const giveawayId = interaction.options.getString("giveaway_id");
    const user = interaction.options.getUser("user");
    
    // Check if the giveaway exists
    const giveaway = giveawayData.activeGiveaways?.[giveawayId] || giveawayData.pastGiveaways?.[giveawayId];
    
    if (!giveaway) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found.`);
    }
    
    // Check if user is a winner
    if (!giveaway.winners || !giveaway.winners.includes(user.id)) {
        return interaction.editReply(`❌ ${user} is not a winner of this giveaway.`);
    }
    
    // Remove user from winners
    giveaway.winners = giveaway.winners.filter(id => id !== user.id);
    
    // Save changes
    saveGuildGiveaways(interaction.guild.id, giveawayData);
    
    await interaction.editReply(`✅ ${user} has been removed from the winners of giveaway #${giveawayId}.`);
}

// Handler to list winners
async function handleWinnerList(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID
    const giveawayId = interaction.options.getString("giveaway_id");
    
    // Check if the giveaway exists
    const giveaway = giveawayData.activeGiveaways?.[giveawayId] || giveawayData.pastGiveaways?.[giveawayId];
    
    if (!giveaway) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found.`);
    }
    
    // Check if there are winners
    if (!giveaway.winners || giveaway.winners.length === 0) {
        return interaction.editReply(`Giveaway #${giveawayId} has no winners.`);
    }
    
    // Create embed with winner list
    const embed = new MessageEmbed()
        .setTitle(`🏆 Winners of Giveaway #${giveawayId}`)
        .setColor(interaction.client.config.embedColor)
        .setDescription(`**Prize:** ${giveaway.prize}\n**Total Winners:** ${giveaway.winners.length}`);
    
    // Add winners to embed
    const winnersText = giveaway.winners.map(id => `<@${id}>`).join("\n");
    embed.addField("Winners", winnersText);
    
    await interaction.editReply({ embeds: [embed] });
}

// Handler to clear all winners
async function handleWinnerClear(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID
    const giveawayId = interaction.options.getString("giveaway_id");
    
    // Check if the giveaway exists
    const giveaway = giveawayData.activeGiveaways?.[giveawayId] || giveawayData.pastGiveaways?.[giveawayId];
    
    if (!giveaway) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found.`);
    }
    
    // Check if there are winners
    if (!giveaway.winners || giveaway.winners.length === 0) {
        return interaction.editReply(`Giveaway #${giveawayId} has no winners to remove.`);
    }
    
    // Confirm action
    const confirmRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId("winner_clear_confirm")
            .setLabel("Confirm")
            .setStyle("DANGER")
            .setEmoji("✅"),
        new MessageButton()
            .setCustomId("winner_clear_cancel")
            .setLabel("Cancel")
            .setStyle("SECONDARY")
            .setEmoji("❌")
    );
    
    const confirmMsg = await interaction.editReply({
        content: `Are you sure you want to remove all ${giveaway.winners.length} winners from giveaway #${giveawayId}?`,
        components: [confirmRow]
    });
    
    // Collector for confirmation buttons
    const collector = confirmMsg.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && 
                    (i.customId === "winner_clear_confirm" || i.customId === "winner_clear_cancel"),
        time: 30000, // 30 seconds
        max: 1
    });
    
    collector.on("collect", async i => {
        if (i.customId === "winner_clear_confirm") {
            // Clear winners
            giveaway.winners = [];
            
            // Save changes
            saveGuildGiveaways(interaction.guild.id, giveawayData);
            
            await i.update({
                content: `✅ All winners of giveaway #${giveawayId} have been removed.`,
                components: []
            });
        } else if (i.customId === "winner_clear_cancel") {
            await i.update({
                content: "❌ Operation cancelled.",
                components: []
            });
        }
    });
    
    collector.on("end", async (collected, reason) => {
        if (reason === "time" && collected.size === 0) {
            await interaction.editReply({
                content: "⏱️ Time expired. The operation was cancelled.",
                components: []
            });
        }
    });
}

// Handler to announce winners again
async function handleWinnerAnnounce(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID and optional channel
    const giveawayId = interaction.options.getString("giveaway_id");
    const customChannel = interaction.options.getChannel("channel");
    
    // Check if the giveaway exists
    const giveaway = giveawayData.activeGiveaways?.[giveawayId] || giveawayData.pastGiveaways?.[giveawayId];
    
    if (!giveaway) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found.`);
    }
    
    // Check if there are winners
    if (!giveaway.winners || giveaway.winners.length === 0) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} has no winners to announce.`);
    }
    
    // Determine channel for announcement
    const channel = customChannel || interaction.guild.channels.cache.get(giveaway.channelId);
    
    if (!channel) {
        return interaction.editReply("❌ Channel not found. Please specify a valid channel.");
    }
    
    // Check permissions in channel
    if (!channel.permissionsFor(interaction.guild.me).has(Permissions.FLAGS.SEND_MESSAGES) || 
        !channel.permissionsFor(interaction.guild.me).has(Permissions.FLAGS.EMBED_LINKS)) {
        return interaction.editReply(`I don't have permission to send messages or embeds in ${channel}. Please adjust my permissions.`);
    }
    
    // Create winners text
    const winnersText = giveaway.winners.map(id => `<@${id}>`).join(", ");
    
    // Create announcement embed
    const announceEmbed = new MessageEmbed()
        .setTitle(`🎉 GIVEAWAY WINNERS: ${giveaway.prize}`)
        .setColor(interaction.client.config.embedColor)
        .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winnersText}\n**Announced by:** ${interaction.user}`)
        .setFooter({ 
            text: `Giveaway #${giveawayId}`, 
            iconURL: interaction.guild.iconURL({ dynamic: true }) 
        })
        .setTimestamp();
    
    // Send announcement
    await channel.send({
        content: `Congratulations ${winnersText}! You won **${giveaway.prize}**!`,
        embeds: [announceEmbed],
        allowedMentions: { users: giveaway.winners }
    });
    
    await interaction.editReply(`✅ Winners of giveaway #${giveawayId} announced successfully in ${channel}!`);
}

module.exports = command;