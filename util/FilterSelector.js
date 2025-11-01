const { MessageEmbed } = require("discord.js");

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").SelectMenuInteraction} interaction
 */
module.exports = async (client, interaction) => {
	if (!interaction.isSelectMenu()) return;
	
	if (interaction.customId.startsWith("filters:")) {
		const guildId = interaction.customId.split(":")[1];
		const player = client.manager.players.get(guildId);
		
		if (!player) {
			return interaction.reply({
				embeds: [
					client.Embed("❌ | **There is no player to control in this server.**"),
				],
				ephemeral: true
			});
		}
		
		const filter = interaction.values[0];
		
		// Função para resetar todos os filtros antes de aplicar um novo
		const resetFilters = () => {
			// Reset all filters first
			player.reset();
			
			// Reset all filter properties
			player.bassboost_low = false;
			player.bassboost_medium = false;
			player.bassboost_high = false;
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
		
		// Reset all filters
		if (filter === "off") {
			resetFilters();
			return interaction.update({
				embeds: [
					new MessageEmbed()
						.setColor(client.config.embedColor)
						.setDescription("✅ | All filters have been reset!")
				],
				components: []
			});
		}
		
		// Reset filters before applying a new one
		resetFilters();
		
		// Apply the selected filter based on type
		switch (filter) {
			case "nightcore":
				player.nightcore = true;
				break;
			case "bassboost_low":
				player.setEQ([
					{ band: 0, gain: 0.3 },
					{ band: 1, gain: 0.3 },
					{ band: 2, gain: 0.2 },
					{ band: 3, gain: 0.1 },
					{ band: 4, gain: 0 },
				]);
				break;
			case "bassboost_medium":
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
				break;
			case "bassboost_high":
				player.setEQ([
					{ band: 0, gain: 0.9 },
					{ band: 1, gain: 0.8 },
					{ band: 2, gain: 0.7 },
					{ band: 3, gain: 0.5 },
					{ band: 4, gain: 0.3 },
				]);
				break;
			case "vaporwave":
				player.vaporwave = true;
				break;
			case "pop":
				player.pop = true;
				break;
			case "soft":
				player.soft = true;
				break;
			case "treblebass":
				player.treblebass = true;
				break;
			case "eightD":
				player.eightD = true;
				break;
			case "karaoke":
				player.karaoke = true;
				break;
			case "vibrato":
				player.vibrato = true;
				break;
			case "tremolo":
				player.tremolo = true;
				break;
		}
		
		// Format the filter name for display (e.g., "bassboost_medium" -> "BASSBOOST MEDIUM")
		const displayName = filter.replace('_', ' ').toUpperCase();
		
		return interaction.update({
			embeds: [
				new MessageEmbed()
					.setColor(client.config.embedColor)
					.setDescription(`✅ | ${displayName} filter is now active!`)
			],
			components: []
		});
	}
};