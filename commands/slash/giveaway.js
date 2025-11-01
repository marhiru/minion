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

// Function to format duration
function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    const parts = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
    
    return parts.join(', ');
}

// Function to convert duration to ms
function parseDuration(duration) {
    const regex = /(\d+)([dhms])/g;
    let ms = 0;
    let match;
    
    while ((match = regex.exec(duration)) !== null) {
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 'd': ms += value * 24 * 60 * 60 * 1000; break;
            case 'h': ms += value * 60 * 60 * 1000; break;
            case 'm': ms += value * 60 * 1000; break;
            case 's': ms += value * 1000; break;
        }
    }
    
    return ms;
}

const command = new SlashCommand()
    .setName("giveaway")
    .setDescription("Giveaway system")
    .addSubcommand(subcommand =>
        subcommand
            .setName("create")
            .setDescription("Create a new giveaway")
            .addStringOption(option =>
                option
                    .setName("prize")
                    .setDescription("The giveaway prize")
                    .setRequired(true)
            )
            .addStringOption(option =>
                option
                    .setName("duration")
                    .setDescription("Giveaway duration (e.g. 1d, 12h, 30m, 10s)")
                    .setRequired(true)
            )
            .addIntegerOption(option =>
                option
                    .setName("winners")
                    .setDescription("Number of winners")
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(10)
            )
            .addChannelOption(option =>
                option
                    .setName("channel")
                    .setDescription("Channel where the giveaway will be hosted")
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("list")
            .setDescription("List all active giveaways")
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("end")
            .setDescription("End a giveaway immediately")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway to end")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("reroll")
            .setDescription("Reroll winners for an ended giveaway")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway to reroll")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
            .addIntegerOption(option =>
                option
                    .setName("winners")
                    .setDescription("Number of new winners (default: same as original giveaway)")
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(10)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName("participants")
            .setDescription("Show participants of a giveaway")
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
            .setName("cancel")
            .setDescription("Cancel an active giveaway")
            .addStringOption(option =>
                option
                    .setName("giveaway_id")
                    .setDescription("ID of the giveaway to cancel")
                    .setRequired(true)
                    .setAutocomplete(true)
            )
    )
    .setRun(async (client, interaction) => {
        // Set up giveaway system events (only once)
        if (!client.giveawayEventsSetup) {
            setupGiveawayEvents(client);
            client.giveawayEventsSetup = true;
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        // Load giveaway data for the server
        const guildId = interaction.guild.id;
        const giveawayData = getGuildGiveaways(guildId);
        
        switch (subcommand) {
            case "create":
                // Check permissions
                if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
                    return interaction.reply({
                        content: "You need Manage Server permission to create giveaways.",
                        ephemeral: true
                    });
                }
                await handleGiveawayCreate(interaction, giveawayData);
                break;
                
            case "list":
                await handleGiveawayList(interaction, giveawayData);
                break;
                
            case "end":
                // Check permissions
                if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
                    return interaction.reply({
                        content: "You need Manage Server permission to end giveaways.",
                        ephemeral: true
                    });
                }
                await handleGiveawayEnd(interaction, giveawayData);
                break;
                
            case "reroll":
                // Check permissions
                if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
                    return interaction.reply({
                        content: "You need Manage Server permission to reroll winners.",
                        ephemeral: true
                    });
                }
                await handleGiveawayReroll(interaction, giveawayData);
                break;
                
            case "participants":
                await handleGiveawayParticipants(interaction, giveawayData);
                break;
                
            case "cancel":
                // Check permissions
                if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_GUILD)) {
                    return interaction.reply({
                        content: "You need Manage Server permission to cancel giveaways.",
                        ephemeral: true
                    });
                }
                await handleGiveawayCancel(interaction, giveawayData);
                break;
        }
    });

// Handler to create a new giveaway
async function handleGiveawayCreate(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway parameters
    const prize = interaction.options.getString("prize");
    const durationStr = interaction.options.getString("duration");
    const winnersCount = interaction.options.getInteger("winners");
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    
    // Check if the channel is a text channel
    if (channel.type !== "GUILD_TEXT") {
        return interaction.editReply("❌ Giveaways can only be created in text channels.");
    }
    
    // Check if the bot has permission to send messages in the channel
    if (!channel.permissionsFor(interaction.guild.me).has(Permissions.FLAGS.SEND_MESSAGES) || 
        !channel.permissionsFor(interaction.guild.me).has(Permissions.FLAGS.EMBED_LINKS)) {
        return interaction.editReply(`I don't have permission to send messages or embeds in ${channel}. Please adjust my permissions.`);
    }
    
    // Convert duration to milliseconds
    const duration = parseDuration(durationStr);
    if (duration <= 0) {
        return interaction.editReply("❌ Invalid duration. Use formats like 1d, 12h, 30m, 10s.");
    }
    


    // Calculate end time
    const endTime = Date.now() + duration;
    
    // Increment giveaway counter
    giveawayData.giveawayCounter = (giveawayData.giveawayCounter || 0) + 1;
    const giveawayId = giveawayData.giveawayCounter.toString();
    
    // Create giveaway embed
    // Create giveaway embed
    const giveawayEmbed = new MessageEmbed()
        .setTitle(`🎉 GIVEAWAY: ${prize}`)
        .setColor(interaction.client.config.embedColor)
        .setDescription(`Click the button below to enter!\n\n**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Participants:** 0\n**Ends:** <t:${Math.floor(endTime/1000)}:R>\n**Hosted by:** ${interaction.user}`)
        .setFooter({ 
            text: `Giveaway #${giveawayId} | Ends`, 
            iconURL: interaction.guild.iconURL({ dynamic: true }) 
        })
        .setTimestamp(new Date(endTime));
    
    // Create button to enter
    const row = new MessageActionRow().addComponents(
        new MessageButton()
            .setCustomId(`giveaway_enter_${giveawayId}`)
            .setLabel("Enter Giveaway")
            .setStyle("PRIMARY")
            .setEmoji("🎉")
    );
    
    // Send giveaway message
    try {
        const giveawayMessage = await channel.send({
            embeds: [giveawayEmbed],
            components: [row]
        });
        
        // Save giveaway information
        giveawayData.activeGiveaways[giveawayId] = {
            messageId: giveawayMessage.id,
            channelId: channel.id,
            prize: prize,
            winnersCount: winnersCount,
            endTime: endTime,
            hostId: interaction.user.id,
            participants: [],
            ended: false,
            winners: []
        };
        
        saveGuildGiveaways(interaction.guild.id, giveawayData);
        
        // Schedule giveaway end
        setTimeout(() => {
            endGiveaway(interaction.client, interaction.guild.id, giveawayId);
        }, duration);
        
        await interaction.editReply(`✅ Giveaway created successfully in ${channel}!`);
    } catch (error) {
        console.error("Error creating giveaway:", error);
        await interaction.editReply(`❌ An error occurred while creating the giveaway: ${error.message}`);
    }
}

// Handler to list active giveaways
async function handleGiveawayList(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Check if there are active giveaways
    const activeGiveaways = Object.entries(giveawayData.activeGiveaways || {});
    
    if (activeGiveaways.length === 0) {
        return interaction.editReply("There are no active giveaways at the moment.");
    }
    
    // Create embed with giveaway list
    const embed = new MessageEmbed()
        .setTitle("🎉 Active Giveaways")
        .setColor(interaction.client.config.embedColor)
        .setDescription("List of all active giveaways in this server.");
    
    // Add each giveaway to the embed
    for (const [id, giveaway] of activeGiveaways) {
        const channel = interaction.guild.channels.cache.get(giveaway.channelId);
        const channelName = channel ? `#${channel.name}` : "Unknown channel";
        const timeLeft = giveaway.endTime - Date.now();
        
        embed.addField(
            `Giveaway #${id}: ${giveaway.prize}`,
            `**Channel:** ${channelName}\n**Winners:** ${giveaway.winnersCount}\n**Ends:** <t:${Math.floor(giveaway.endTime/1000)}:R>\n**Participants:** ${giveaway.participants.length}\n**ID:** \`${id}\``
        );
    }
    
    await interaction.editReply({ embeds: [embed] });
}

// Handler to end a giveaway immediately
async function handleGiveawayEnd(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID
    const giveawayId = interaction.options.getString("giveaway_id");
    
    // Check if the giveaway exists
    if (!giveawayData.activeGiveaways || !giveawayData.activeGiveaways[giveawayId]) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found or already ended.`);
    }
    
    // End the giveaway
    try {
        await endGiveaway(interaction.client, interaction.guild.id, giveawayId);
        await interaction.editReply(`✅ Giveaway #${giveawayId} ended successfully!`);
    } catch (error) {
        console.error("Error ending giveaway:", error);
        await interaction.editReply(`❌ An error occurred while ending the giveaway: ${error.message}`);
    }
}

// Handler to reroll winners
async function handleGiveawayReroll(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID
    const giveawayId = interaction.options.getString("giveaway_id");
    
    // Check if the giveaway exists in past giveaways
    if (!giveawayData.pastGiveaways || !giveawayData.pastGiveaways[giveawayId]) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found or still active.`);
    }
    
    const giveaway = giveawayData.pastGiveaways[giveawayId];
    
    // Check if there are enough participants
    if (!giveaway.participants || giveaway.participants.length === 0) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} had no participants.`);
    }
    
    // Get number of winners (use original if not specified)
    const winnersCount = interaction.options.getInteger("winners") || giveaway.winnersCount;
    
    // Select new winners randomly
    const newWinners = selectWinners(giveaway.participants, winnersCount);
    
    // Update winners in database
    giveaway.winners = newWinners;
    saveGuildGiveaways(interaction.guild.id, giveawayData);
    
    // Try to get channel and message
    const channel = interaction.guild.channels.cache.get(giveaway.channelId);
    
    if (!channel) {
        return interaction.editReply(`✅ New winners selected for giveaway #${giveawayId}, but the channel was not found to send notification.`);
    }
    
    // Create winners text
    const winnersText = newWinners.length > 0 
        ? newWinners.map(id => `<@${id}>`).join(", ")
        : "No valid winner";
    
    const rerollEmbed = new MessageEmbed()
        .setTitle(`🎉 NEW WINNERS: ${giveaway.prize}`)
        .setColor(interaction.client.config.embedColor)
        .setDescription(`**Prize:** ${giveaway.prize}\n**New Winners:** ${winnersText}\n**Rerolled by:** ${interaction.user}`)
        .setFooter({ 
            text: `Giveaway #${giveawayId} | Rerolled`, 
            iconURL: interaction.guild.iconURL({ dynamic: true }) 
        })
        .setTimestamp();
    
    // Send new winners message
    await channel.send({
        content: newWinners.length > 0 ? `Congratulations ${winnersText}! You won **${giveaway.prize}**!` : "Could not determine a valid winner.",
        embeds: [rerollEmbed]
    });
    
    await interaction.editReply(`✅ New winners selected for giveaway #${giveawayId}!`);
}

// Handler to show participants
async function handleGiveawayParticipants(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID
    const giveawayId = interaction.options.getString("giveaway_id");
    
    // Check if the giveaway exists
    const giveaway = giveawayData.activeGiveaways?.[giveawayId] || giveawayData.pastGiveaways?.[giveawayId];
    
    if (!giveaway) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found.`);
    }
    
    // Check if there are participants
    if (!giveaway.participants || giveaway.participants.length === 0) {
        return interaction.editReply(`Giveaway #${giveawayId} has no participants.`);
    }
    
    // Create embed with participant list
    const embed = new MessageEmbed()
        .setTitle(`🎉 Participants of Giveaway #${giveawayId}`)
        .setColor(interaction.client.config.embedColor)
        .setDescription(`**Prize:** ${giveaway.prize}\n**Total Participants:** ${giveaway.participants.length}`);
    
    // Add participants to embed (in groups of 20 to not exceed limit)
    const participantsChunks = [];
    for (let i = 0; i < giveaway.participants.length; i += 20) {
        participantsChunks.push(giveaway.participants.slice(i, i + 20));
    }
    
    for (let i = 0; i < participantsChunks.length; i++) {
        const participantsText = participantsChunks[i].map(id => `<@${id}>`).join(", ");
        embed.addField(`Participants ${i * 20 + 1}-${Math.min((i + 1) * 20, giveaway.participants.length)}`, participantsText);
    }
    
    // Add winners if the giveaway has ended
    if (giveaway.ended && giveaway.winners && giveaway.winners.length > 0) {
        const winnersText = giveaway.winners.map(id => `<@${id}>`).join(", ");
        embed.addField("Winners", winnersText);
    }
    
    await interaction.editReply({ embeds: [embed] });
}

// Handler to cancel a giveaway
async function handleGiveawayCancel(interaction, giveawayData) {
    await interaction.deferReply({ ephemeral: true });
    
    // Get giveaway ID
    const giveawayId = interaction.options.getString("giveaway_id");
    
    // Check if the giveaway exists
    if (!giveawayData.activeGiveaways || !giveawayData.activeGiveaways[giveawayId]) {
        return interaction.editReply(`❌ Giveaway #${giveawayId} not found or already ended.`);
    }
    
    const giveaway = giveawayData.activeGiveaways[giveawayId];
    
    // Try to get channel and message
    const channel = interaction.guild.channels.cache.get(giveaway.channelId);
    
    if (channel) {
        try {
            const message = await channel.messages.fetch(giveaway.messageId);
            
            if (message) {
                // Update embed to show giveaway was cancelled
                const cancelledEmbed = new MessageEmbed()
                    .setTitle(`🚫 GIVEAWAY CANCELLED: ${giveaway.prize}`)
                    .setColor("RED")
                    .setDescription(`This giveaway was cancelled by ${interaction.user}.\n\n**Prize:** ${giveaway.prize}\n**Winners:** ${giveaway.winnersCount}\n**Participants:** ${giveaway.participants.length}`)
                    .setFooter({ 
                        text: `Giveaway #${giveawayId} | Cancelled`, 
                        iconURL: interaction.guild.iconURL({ dynamic: true }) 
                    })
                    .setTimestamp();
                
                // Disable button
                const disabledRow = new MessageActionRow().addComponents(
                    new MessageButton()
                        .setCustomId(`giveaway_enter_${giveawayId}`)
                        .setLabel("Giveaway Cancelled")
                        .setStyle("DANGER")
                        .setEmoji("🚫")
                        .setDisabled(true)
                );
                
                await message.edit({
                    embeds: [cancelledEmbed],
                    components: [disabledRow]
                });
            }
        } catch (error) {
            console.error("Error updating giveaway message:", error);
        }
    }
    
    // Move giveaway to past giveaways
    if (!giveawayData.pastGiveaways) giveawayData.pastGiveaways = {};
    
    giveaway.ended = true;
    giveaway.cancelled = true;
    giveaway.winners = [];
    
    giveawayData.pastGiveaways[giveawayId] = giveaway;
    delete giveawayData.activeGiveaways[giveawayId];
    
    saveGuildGiveaways(interaction.guild.id, giveawayData);
    
    await interaction.editReply(`✅ Giveaway #${giveawayId} cancelled successfully!`);
}

// Function to end a giveaway
async function endGiveaway(client, guildId, giveawayId) {
    // Carrega os dados do sorteio
    const giveawayData = getGuildGiveaways(guildId);
    
    // Verifica se o sorteio existe e ainda está ativo
    if (!giveawayData.activeGiveaways || !giveawayData.activeGiveaways[giveawayId] || giveawayData.activeGiveaways[giveawayId].ended) {
        return;
    }
    
    const giveaway = giveawayData.activeGiveaways[giveawayId];
    
    // Marca o sorteio como encerrado
    giveaway.ended = true;
    
    // Verifica se já existem vencedores adicionados manualmente
    if (!giveaway.winners || giveaway.winners.length === 0) {
        // Se não houver vencedores, seleciona aleatoriamente
        const winners = selectWinners(giveaway.participants, giveaway.winnersCount);
        giveaway.winners = winners;
    } else {
        // Se já existirem vencedores, mantém os existentes
        console.log(`Keeping ${giveaway.winners.length} manually added winners for giveaway #${giveawayId}`);
    }
    
    const guild = client.guilds.cache.get(guildId);
    
    if (!guild) {
        console.error(`Guild ${guildId} not found when ending giveaway ${giveawayId}`);
        return;
    }
    
    const channel = guild.channels.cache.get(giveaway.channelId);
    
    if (!channel) {
        console.error(`Channel ${giveaway.channelId} not found when ending giveaway ${giveawayId}`);
        
        // Move o sorteio para os sorteios passados mesmo assim
        if (!giveawayData.pastGiveaways) giveawayData.pastGiveaways = {};
        giveawayData.pastGiveaways[giveawayId] = giveaway;
        delete giveawayData.activeGiveaways[giveawayId];
        saveGuildGiveaways(guildId, giveawayData);
        
        return;
    }
    
    try {
        const message = await channel.messages.fetch(giveaway.messageId);
        
        if (message) {
            // Cria o texto dos vencedores
            const winnersText = giveaway.winners.length > 0 
                ? giveaway.winners.map(id => `<@${id}>`).join(", ")
                : "No valid winner";
            
            // Atualiza o embed para mostrar os vencedores
            const endedEmbed = new MessageEmbed()
                .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize}`)
                .setColor(giveaway.winners.length > 0 ? "GREEN" : "RED")
                .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winnersText}\n**Participants:** ${giveaway.participants.length}`)
                .setFooter({ 
                    text: `Giveaway #${giveawayId} | Ended`, 
                    iconURL: guild.iconURL({ dynamic: true }) 
                })
                .setTimestamp();
            
            // Desativa o botão
            const disabledRow = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId(`giveaway_enter_${giveawayId}`)
                    .setLabel("Giveaway Ended")
                    .setStyle("SECONDARY")
                    .setEmoji("🎉")
                    .setDisabled(true)
            );
            
            await message.edit({
                embeds: [endedEmbed],
                components: [disabledRow]
            });
            
            // Anuncia os vencedores
            if (giveaway.winners.length > 0) {
                await channel.send({
                    content: `Congratulations ${winnersText}! You won **${giveaway.prize}**!`,
                    allowedMentions: { users: giveaway.winners }
                });
            } else {
                await channel.send(`Could not determine a valid winner for the giveaway **${giveaway.prize}**.`);
            }
        }
    } catch (error) {
        console.error("Error updating giveaway message:", error);
    }
    
    // Move o sorteio para os sorteios passados
    if (!giveawayData.pastGiveaways) giveawayData.pastGiveaways = {};
    giveawayData.pastGiveaways[giveawayId] = giveaway;
    delete giveawayData.activeGiveaways[giveawayId];
    
    saveGuildGiveaways(guildId, giveawayData);
}

// Function to select winners randomly
function selectWinners(participants, count) {
    if (!participants || participants.length === 0) {
        return [];
    }
    
    // Limit number of winners to number of participants
    const winnersCount = Math.min(count, participants.length);
    
    // Create a copy of participants list to not modify the original
    const participantsCopy = [...participants];
    const winners = [];
    
    // Select winners randomly
    for (let i = 0; i < winnersCount; i++) {
        if (participantsCopy.length === 0) break;
        
        // Select a random index
        const randomIndex = Math.floor(Math.random() * participantsCopy.length);
        
        // Add participant to winners
        winners.push(participantsCopy[randomIndex]);
        
        // Remove participant from list to avoid duplicates
        participantsCopy.splice(randomIndex, 1);
    }
    
    return winners;
}

// Set up giveaway system events
function setupGiveawayEvents(client) {
    // Handler for giveaway button clicks
    client.on("interactionCreate", async interaction => {
        if (!interaction.isButton()) return;
        
        // Check if it's a giveaway entry button
        if (interaction.customId.startsWith("giveaway_enter_")) {
            await interaction.deferReply({ ephemeral: true });
            
            // Extract giveaway ID
            const giveawayId = interaction.customId.split("_")[2];
            
            // Load giveaway data
            const giveawayData = getGuildGiveaways(interaction.guild.id);
            
            // Check if the giveaway exists and is still active
            if (!giveawayData.activeGiveaways || !giveawayData.activeGiveaways[giveawayId]) {
                return interaction.editReply("❌ This giveaway doesn't exist or has already ended.");
            }
            
            const giveaway = giveawayData.activeGiveaways[giveawayId];
            
            // Check if the giveaway has ended
            if (giveaway.ended) {
                return interaction.editReply("❌ This giveaway has already ended.");
            }
            
            // Check if user is already participating
            if (giveaway.participants.includes(interaction.user.id)) {
                // Remove o usuário da lista de participantes
                giveaway.participants = giveaway.participants.filter(id => id !== interaction.user.id);
                saveGuildGiveaways(interaction.guild.id, giveawayData);
                
                // Atualiza a embed com o novo número de participantes
                try {
                    const channel = interaction.guild.channels.cache.get(giveaway.channelId);
                    if (channel) {
                        const message = await channel.messages.fetch(giveaway.messageId);
                        if (message) {
                            const embed = message.embeds[0];
                            const description = embed.description.replace(/\*\*Participants:\*\* \d+/, `**Participants:** ${giveaway.participants.length}`);
                            
                            const updatedEmbed = new MessageEmbed()
                                .setTitle(embed.title)
                                .setColor(embed.color)
                                .setDescription(description)
                                .setFooter(embed.footer)
                                .setTimestamp(embed.timestamp);
                                
                            await message.edit({ embeds: [updatedEmbed] });
                        }
                    }
                } catch (error) {
                    console.error("Error updating giveaway embed:", error);
                }
                
                return interaction.editReply("✅ You have left the giveaway.");
            } else {
                // Adiciona o usuário à lista de participantes
                giveaway.participants.push(interaction.user.id);
                saveGuildGiveaways(interaction.guild.id, giveawayData);
                
                // Atualiza a embed com o novo número de participantes
                try {
                    const channel = interaction.guild.channels.cache.get(giveaway.channelId);
                    if (channel) {
                        const message = await channel.messages.fetch(giveaway.messageId);
                        if (message) {
                            const embed = message.embeds[0];
                            const description = embed.description.replace(/\*\*Participants:\*\* \d+/, `**Participants:** ${giveaway.participants.length}`);
                            
                            const updatedEmbed = new MessageEmbed()
                                .setTitle(embed.title)
                                .setColor(embed.color)
                                .setDescription(description)
                                .setFooter(embed.footer)
                                .setTimestamp(embed.timestamp);
                                
                            await message.edit({ embeds: [updatedEmbed] });
                        }
                    }
                } catch (error) {
                    console.error("Error updating giveaway embed:", error);
                }
                
                return interaction.editReply("✅ You have entered the giveaway! Good luck!");
            }
        }
    });
    client.on("interactionCreate", async interaction => {
        if (!interaction.isAutocomplete()) return;
        
        // Check if it's a giveaway command
        if (interaction.commandName === "giveaway") {
            // Get subcommand
            const subcommand = interaction.options.getSubcommand();
            
            // Check if it's one of the subcommands that use giveaway_id
            if (["end", "reroll", "participants", "cancel"].includes(subcommand)) {
                // Get current value typed by user
                const focusedOption = interaction.options.getFocused(true);
                
                if (focusedOption.name === "giveaway_id") {
                    // Load giveaway data for the server
                    const giveawayData = getGuildGiveaways(interaction.guild.id);
                    
                    // Prepare autocomplete options
                    let choices = [];
                    
                    // For end and cancel, show active giveaways
                    if (subcommand === "end" || subcommand === "cancel") {
                        choices = Object.entries(giveawayData.activeGiveaways || {}).map(([id, giveaway]) => ({
                            name: `#${id}: ${giveaway.prize} (${giveaway.participants.length} participants)`,
                            value: id
                        }));
                    }
                    // For reroll, show ended giveaways
                    else if (subcommand === "reroll") {
                        choices = Object.entries(giveawayData.pastGiveaways || {}).map(([id, giveaway]) => ({
                            name: `#${id}: ${giveaway.prize} (${giveaway.participants.length} participants)`,
                            value: id
                        }));
                    }
                    // For participants, show all giveaways
                    else if (subcommand === "participants") {
                        const activeChoices = Object.entries(giveawayData.activeGiveaways || {}).map(([id, giveaway]) => ({
                            name: `#${id}: ${giveaway.prize} (Active - ${giveaway.participants.length} participants)`,
                            value: id
                        }));
                        
                        const pastChoices = Object.entries(giveawayData.pastGiveaways || {}).map(([id, giveaway]) => ({
                            name: `#${id}: ${giveaway.prize} (Ended - ${giveaway.participants.length} participants)`,
                            value: id
                        }));
                        
                        choices = [...activeChoices, ...pastChoices];
                    }
                    
                    // Filter options based on typed value
                    const filtered = choices.filter(choice => 
                        choice.name.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                        choice.value.includes(focusedOption.value)
                    );
                    
                    // Limit to 25 options (Discord limit)
                    await interaction.respond(filtered.slice(0, 25));
                }
            }
        }
    });
    
    // Check giveaways every minute to end those that have finished
    setInterval(() => {
        checkGiveaways(client);
    }, 60000); // 1 minute
    
    // Check giveaways when bot starts
    checkGiveaways(client);
    
    console.log("Giveaway system events set up successfully!");
}
// Function to check for ended giveaways
async function checkGiveaways(client) {
    // Get all servers where the bot is
    for (const guild of client.guilds.cache.values()) {
        // Load giveaway data for the server
        const giveawayData = getGuildGiveaways(guild.id);
        
        // Check if there are active giveaways
        if (!giveawayData.activeGiveaways) continue;
        
        // Check each giveaway
        for (const [giveawayId, giveaway] of Object.entries(giveawayData.activeGiveaways)) {
            // Check if the giveaway has ended
            if (giveaway.endTime <= Date.now() && !giveaway.ended) {
                // End the giveaway
                await endGiveaway(client, guild.id, giveawayId);
            }
        }
    }
}

module.exports = command;