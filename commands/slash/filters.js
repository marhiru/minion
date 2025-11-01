const { MessageEmbed } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");

const command = new SlashCommand()
	.setName("filters")
	.setDescription("add or remove filters")
	.addStringOption((option) =>
		option
			.setName("preset")
			.setDescription("the preset to add")
			.setRequired(true)
			.addChoices(
				{ name: "Nightcore", value: "nightcore" },
				{ name: "BassBoost Low", value: "bassboost_low" },
				{ name: "BassBoost Medium", value: "bassboost_medium" },
				{ name: "BassBoost High", value: "bassboost_high" },
				{ name: "Vaporwave", value: "vaporwave" },
				{ name: "Pop", value: "pop" },
				{ name: "Soft", value: "soft" },
				{ name: "Treblebass", value: "treblebass" },
				{ name: "Eight Dimension", value: "eightD" },
				{ name: "Karaoke", value: "karaoke" },
				{ name: "Vibrato", value: "vibrato" },
				{ name: "Tremolo", value: "tremolo" },
				{ name: "Reset", value: "off" },
			),
	)
	
	.setRun(async (client, interaction, options) => {
		const args = interaction.options.getString("preset");
		
		let channel = await client.getChannel(client, interaction);
		if (!channel) {
			return;
		}
		
		let player;
		if (client.manager) {
			player = client.manager.players.get(interaction.guild.id);
		} else {
			return interaction.reply({
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription("Lavalink node is not connected"),
				],
			});
		}
		
		if (!player) {
			return interaction.reply({
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription("There's no music playing."),
				],
				ephemeral: true,
			});
		}
		
		// Função para resetar todos os filtros antes de aplicar um novo
		const resetFilters = () => {
			// Reset all filters first
			player.reset();
			
			// Reset all filter properties
			player.nightcore = false;
			player.vaporwave = false;
			player.pop = false;
			player.soft = false;
			player.treblebass = false;
			player.eightD = false;
			player.karaoke = false;
			player.vibrato = false;
			player.tremolo = false;
			
			// Clear EQ
			player.clearEQ();
		};
		
		// create a new embed
		let filtersEmbed = new MessageEmbed().setColor(client.config.embedColor);
		
		if (args == "off") {
			filtersEmbed.setDescription("✅ | All filters have been reset!");
			resetFilters();
		} else {
			// Reset filters before applying a new one
			resetFilters();
			
			if (args == "nightcore") {
				filtersEmbed.setDescription("✅ | Nightcore filter is now active!");
				player.nightcore = true;
			} else if (args == "bassboost_low") {
				filtersEmbed.setDescription("✅ | BassBoost Low filter is now on!");
				player.setEQ([
					{ band: 0, gain: 0.3 },
					{ band: 1, gain: 0.3 },
					{ band: 2, gain: 0.2 },
					{ band: 3, gain: 0.1 },
					{ band: 4, gain: 0 },
				]);
			} else if (args == "bassboost_medium") {
				filtersEmbed.setDescription("✅ | BassBoost Medium filter is now on!");
				player.setEQ([
					{ band: 0, gain: 0.6 },  // 32Hz: 6dB
					{ band: 1, gain: 0.5 },  // 63Hz: 5dB
					{ band: 2, gain: 0.3 },  // 125Hz: 3dB
					{ band: 3, gain: 0.06 }, // 250Hz: 0.6dB
					{ band: 4, gain: 0.06 }, // 500Hz: 0.6dB
					{ band: 5, gain: 0.23 }, // 1kHz: 2.3dB
					{ band: 6, gain: 0.12 }, // 2kHz: 1.2dB
					{ band: 7, gain: 0.2 },  // 4kHz: 2dB
					{ band: 8, gain: 0.2 },  // 8kHz: 2dB
					{ band: 9, gain: 0.2 },  // 16kHz: 2dB
				]);
			} else if (args == "bassboost_high") {
				filtersEmbed.setDescription("✅ | BassBoost High filter is now on!");
				player.setEQ([
					{ band: 0, gain: 0.9 },
					{ band: 1, gain: 0.8 },
					{ band: 2, gain: 0.7 },
					{ band: 3, gain: 0.5 },
					{ band: 4, gain: 0.3 },
				]);
			} else if (args == "vaporwave") {
				filtersEmbed.setDescription("✅ | Vaporwave filter is now on!");
				player.vaporwave = true;
			} else if (args == "pop") {
				filtersEmbed.setDescription("✅ | Pop filter is now on!");
				player.pop = true;
			} else if (args == "soft") {
				filtersEmbed.setDescription("✅ | Soft filter is now on!");
				player.soft = true;
			} else if (args == "treblebass") {
				filtersEmbed.setDescription("✅ | Treblebass filter is now on!");
				player.treblebass = true;
			} else if (args == "eightD") {
				filtersEmbed.setDescription("✅ | Eight Dimension filter is now on!");
				player.eightD = true;
			} else if (args == "karaoke") {
				filtersEmbed.setDescription("✅ | Karaoke filter is now on!");
				player.karaoke = true;
			} else if (args == "vibrato") {
				filtersEmbed.setDescription("✅ | Vibrato filter is now on!");
				player.vibrato = true;
			} else if (args == "tremolo") {
				filtersEmbed.setDescription("✅ | Tremolo filter is now on!");
				player.tremolo = true;
			} else {
				filtersEmbed.setDescription("❌ | Invalid filter!");
			}
		}
		
		return interaction.reply({ embeds: [filtersEmbed] });
	});

module.exports = command;