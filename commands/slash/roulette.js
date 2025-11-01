const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu } = require("discord.js");

const command = new SlashCommand()
    .setName("roulette")
    .setDescription("Creates a roulette to randomly select someone")
    .addStringOption((option) =>
        option
            .setName("names")
            .setDescription("List of names separated by comma (optional)")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        // Respond immediately to avoid timeout
        await interaction.deferReply();
        
        // Initialize the roulette with provided names or empty
        const initialNames = interaction.options.getString("names");
        let names = [];
        
        if (initialNames) {
            names = initialNames.split(",").map(name => name.trim()).filter(name => name.length > 0);
        }
        
        // Object to store the current state of the roulette
        const rouletteState = {
            names: names,
            spinning: false,
            winner: null,
            message: null,
            collector: null,
            timeout: null
        };
        
        // Function to create the roulette embed
        function createRouletteEmbed() {
            const embed = new MessageEmbed()
                .setTitle("🎡 Lucky Roulette 🎡")
                .setColor(client.config.embedColor);
            
            if (rouletteState.spinning) {
                embed.setDescription("**The roulette is spinning!**\n\n*Wait to see who will be chosen...*");
                // Don't show the list during spin to create suspense
            } else if (rouletteState.winner) {
                embed.setDescription(`**🎉 The winner is: ${rouletteState.winner} 🎉**`);
                embed.addField("Participants", names.join("\n") || "No participants", true);
            } else {
                embed.setDescription(
                    names.length > 0
                        ? "Add more names to the roulette and spin to randomly choose someone!"
                        : "Add names to the roulette and spin to randomly choose someone!"
                );
                
                if (names.length > 0) {
                    embed.addField("Participants", names.join("\n"), true);
                }
            }
            
            // Add a roulette image or statistics
            if (names.length > 0) {
                embed.setFooter({ 
                    text: `Total participants: ${names.length} | Chance for each: ${(100 / names.length).toFixed(2)}%` 
                });
            } else {
                embed.setFooter({ text: "Add participants to start the roulette!" });
            }
            
            return embed;
        }
        
        // Function to create the roulette buttons
        function createRouletteButtons(isSpinning = false) {
            const row1 = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("roulette_add")
                    .setLabel("Add Name")
                    .setStyle("PRIMARY")
                    .setEmoji("➕")
                    .setDisabled(isSpinning),
                new MessageButton()
                    .setCustomId("roulette_spin")
                    .setLabel("Spin Roulette")
                    .setStyle("SUCCESS")
                    .setEmoji("🎯")
                    .setDisabled(isSpinning || names.length < 2)
            );
            
            const row2 = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("roulette_clear")
                    .setLabel("Clear All")
                    .setStyle("DANGER")
                    .setEmoji("🗑️")
                    .setDisabled(isSpinning || names.length === 0),
                new MessageButton()
                    .setCustomId("roulette_remove")
                    .setLabel("Remove Name")
                    .setStyle("SECONDARY")
                    .setEmoji("➖")
                    .setDisabled(isSpinning || names.length === 0)
            );
            
            return [row1, row2];
        }
        
        // Function to simulate spinning the roulette with animation
        async function spinRoulette() {
            if (names.length < 2) {
                return interaction.followUp({
                    content: "Add at least 2 names to spin the roulette!",
                    ephemeral: true
                });
            }
            
            rouletteState.spinning = true;
            rouletteState.winner = null;
            
            // Update the message to show it's spinning
            await rouletteState.message.edit({
                embeds: [createRouletteEmbed()],
                components: createRouletteButtons(true)
            });
            
            // Simulate the spin with a "rolling" animation
            const spinningTime = 2000; // Spin time in ms
            const updateInterval = 250; // Update interval in ms
            const totalUpdates = spinningTime / updateInterval;
            
            let currentUpdate = 0;
            let spinningEmbed = new MessageEmbed()
                .setTitle("🎡 Lucky Roulette 🎡")
                .setColor(client.config.embedColor)
                .setDescription("**The roulette is spinning!**\n");
            
            const spinInterval = setInterval(async () => {
                currentUpdate++;
                
                // Choose a random name to show during the spin
                const randomIndex = Math.floor(Math.random() * names.length);
                const currentName = names[randomIndex];
                
                // Create an animated visualization of the roulette
                let rouletteVisual = "";
                for (let i = 0; i < names.length; i++) {
                    if (i === randomIndex) {
                        rouletteVisual += `> 🎯 **${names[i]}** 🎯\n`;
                    } else {
                        rouletteVisual += `> ${names[i]}\n`;
                    }
                }
                
                // Update the embed with the current visualization
                spinningEmbed.setDescription(
                    `**The roulette is spinning!**\n\n${rouletteVisual}\n*Choosing...*`
                );
                
                // Add a progress indicator
                const progressBar = "🟦".repeat(Math.floor(currentUpdate / totalUpdates * 10)) + 
                                   "⬜".repeat(10 - Math.floor(currentUpdate / totalUpdates * 10));
                
                spinningEmbed.setFooter({ 
                    text: `Progress: ${progressBar} ${Math.floor(currentUpdate / totalUpdates * 100)}%` 
                });
                
                // Update the message with the new roulette state
                await rouletteState.message.edit({ embeds: [spinningEmbed] });
                
                // When the spin is finished, choose the winner
                if (currentUpdate >= totalUpdates) {
                    clearInterval(spinInterval);
                    
                    // Choose the final winner
                    const winnerIndex = Math.floor(Math.random() * names.length);
                    rouletteState.winner = names[winnerIndex];
                    rouletteState.spinning = false;
                    
                    // Create a special embed for the winner
                    const winnerEmbed = new MessageEmbed()
                        .setTitle("🎡 Lucky Roulette 🎡")
                        .setColor("#FFD700") // Gold for the winner
                        .setDescription(`**🎉 The winner is: ${rouletteState.winner} 🎉**`)
                        .addField("Participants", names.join("\n"), true)
                        .setFooter({ 
                            text: `Total participants: ${names.length} | Chance: ${(100 / names.length).toFixed(2)}%` 
                        });
                    
                    // Add a visual effect to highlight the winner
                    let winnerAnnouncementText = "";
                    for (let i = 0; i < names.length; i++) {
                        if (i === winnerIndex) {
                            winnerAnnouncementText += `> 🏆 **${names[i]}** 🏆\n`;
                        } else {
                            winnerAnnouncementText += `> ${names[i]}\n`;
                        }
                    }
                    
                    winnerEmbed.setDescription(
                        `**🎉 WE HAVE A WINNER! 🎉**\n\n${winnerAnnouncementText}\n` +
                        `**Congratulations, ${rouletteState.winner}!**`
                    );
                    
                    // Update the message with the final result
                    await rouletteState.message.edit({
                        embeds: [winnerEmbed],
                        components: createRouletteButtons()
                    });
                }
            }, updateInterval);
        }
        
        // Function to add a name to the roulette
        async function addNameToRoulette(user) {
            // Create a modal for the user to type the name
            const modal = {
                title: "Add Name to Roulette",
                custom_id: "roulette_add_modal",
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 4,
                                custom_id: "roulette_name_input",
                                label: "Name to add",
                                style: 1,
                                min_length: 1,
                                max_length: 100,
                                placeholder: "Type a name to add to the roulette",
                                required: true
                            }
                        ]
                    }
                ]
            };
            
            try {
                // Try to show the modal
                await interaction.showModal(modal);
            } catch (error) {
                // If can't use modal (older Discord.js version), use a follow-up message
                console.error("Modal not supported, using follow-up message:", error);
                
                const followUp = await interaction.followUp({
                    content: "Type the name you want to add to the roulette (send a message in the channel):",
                    ephemeral: true
                });
                
                // Create a message collector for the user to type the name
                const filter = m => m.author.id === user.id;
                const nameCollector = interaction.channel.createMessageCollector({ 
                    filter, 
                    time: 30000,
                    max: 1
                });
                
                nameCollector.on('collect', async msg => {
                    // Add the name to the roulette
                    const newName = msg.content.trim();
                    if (newName && newName.length > 0) {
                        names.push(newName);
                        
                        // Update the roulette message
                        await rouletteState.message.edit({
                            embeds: [createRouletteEmbed()],
                            components: createRouletteButtons()
                        });
                        
                        // Confirm the addition
                        await followUp.edit({
                            content: `✅ Name "${newName}" added to the roulette!`,
                            ephemeral: true
                        });
                        
                        // Try to delete the user's message to keep the chat clean
                        try {
                            await msg.delete();
                        } catch (err) {
                            // Ignore if no permission to delete
                        }
                    }
                });
                
                nameCollector.on('end', async (collected, reason) => {
                    if (reason === 'time' && collected.size === 0) {
                        await followUp.edit({
                            content: "⏱️ Time expired. No name was added.",
                            ephemeral: true
                        });
                    }
                });
            }
        }
        
        // Function to remove a name from the roulette
        async function removeNameFromRoulette() {
            if (names.length === 0) {
                return interaction.followUp({
                    content: "There are no names to remove from the roulette!",
                    ephemeral: true
                });
            }
            
            // Create a selection menu with the current names
            const options = names.map((name, index) => ({
                label: name.length > 25 ? name.substring(0, 22) + "..." : name,
                description: `Remove "${name}" from the roulette`,
                value: index.toString()
            }));
            
            const row = new MessageActionRow().addComponents(
                new MessageSelectMenu()
                    .setCustomId("roulette_remove_select")
                    .setPlaceholder("Select a name to remove")
                    .addOptions(options)
            );
            
            // Send the selection menu as a follow-up message
            const removeMessage = await interaction.followUp({
                content: "Select the name you want to remove from the roulette:",
                components: [row],
                ephemeral: true
            });
            
            // Create a collector for the selection menu
            const filter = i => i.customId === "roulette_remove_select" && i.user.id === interaction.user.id;
            const collector = removeMessage.createMessageComponentCollector({ 
                filter, 
                time: 30000,
                max: 1
            });
            
            collector.on('collect', async i => {
                // Get the index of the selected name
                const selectedIndex = parseInt(i.values[0]);
                const removedName = names[selectedIndex];
                
                // Remove the name from the roulette
                names.splice(selectedIndex, 1);
                
                // Update the roulette message
                await rouletteState.message.edit({
                    embeds: [createRouletteEmbed()],
                    components: createRouletteButtons()
                });
                
                // Confirm the removal
                await i.update({
                    content: `✅ Name "${removedName}" removed from the roulette!`,
                    components: []
                });
            });
            
            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    await removeMessage.edit({
                        content: "⏱️ Time expired. No name was removed.",
                        components: []
                    });
                }
            });
        }
        
        // Send the initial roulette message
        rouletteState.message = await interaction.editReply({
            embeds: [createRouletteEmbed()],
            components: createRouletteButtons()
        });
        
        // Create a collector for the roulette buttons
        const filter = i => i.customId.startsWith("roulette_") && i.user.id === interaction.user.id;
        rouletteState.collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 300000 // 5 minutes
        });
        
        // Process interactions with the buttons
        rouletteState.collector.on('collect', async i => {
            // Respond immediately to avoid interaction errors
            await i.deferUpdate().catch(() => {});
            
            // Process the interaction based on the clicked button
            switch (i.customId) {
                case "roulette_add":
                    // Add a name to the roulette
                    await addNameToRoulette(i.user);
                    break;
                    
                case "roulette_spin":
                    // Spin the roulette
                    await spinRoulette();
                    break;
                    
                case "roulette_clear":
                    // Clear all names from the roulette
                    names = [];
                    rouletteState.winner = null;
                    
                    // Update the roulette message
                    await rouletteState.message.edit({
                        embeds: [createRouletteEmbed()],
                        components: createRouletteButtons()
                    });
                    break;
                    
                case "roulette_remove":
                    // Remove a name from the roulette
                    await removeNameFromRoulette();
                    break;
                    
                case "roulette_remove_select":
                    // This case is handled by the specific collector for the selection menu
                    break;
            }
        });
        
        // Process the modal submission to add a name
        interaction.client.on('interactionCreate', async interaction => {
            if (!interaction.isModalSubmit()) return;
            if (interaction.customId !== "roulette_add_modal") return;
            
            // Get the name typed in the modal
            const name = interaction.fields.getTextInputValue("roulette_name_input");
            
            // Add the name to the roulette
            if (name && name.length > 0) {
                names.push(name);
                
                // Update the roulette message
                await rouletteState.message.edit({
                    embeds: [createRouletteEmbed()],
                    components: createRouletteButtons()
                });
                
                // Confirm the addition
                await interaction.reply({
                    content: `✅ Name "${name}" added to the roulette!`,
                    ephemeral: true
                });
            }
        });
        
        // Finalize the collector after the time limit
        rouletteState.collector.on('end', async () => {
            // Disable all buttons
            const disabledButtons = createRouletteButtons().map(row => {
                const newRow = new MessageActionRow();
                row.components.forEach(button => {
                    newRow.addComponents(
                        new MessageButton()
                            .setCustomId(button.customId)
                            .setLabel(button.label)
                            .setStyle(button.style)
                            .setEmoji(button.emoji)
                            .setDisabled(true)
                    );
                });
                return newRow;
            });
            
            // Update the embed with a closing message
            const finalEmbed = createRouletteEmbed();
            finalEmbed.setFooter({ 
                text: `Roulette closed | ${finalEmbed.footer.text}` 
            });
            
            // Update the final message
            await rouletteState.message.edit({
                embeds: [finalEmbed],
                components: disabledButtons
            }).catch(() => {});
        });
    });

module.exports = command;