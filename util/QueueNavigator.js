const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const escapeMarkdown = require('discord.js').Util.escapeMarkdown;

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").ButtonInteraction} interaction
 */
module.exports = async (client, interaction) => {
	if (!interaction.isButton()) return;
	
	// Para navegação da fila
	if (interaction.customId.startsWith("queue:")) {
		const [, guildId, action, pageString] = interaction.customId.split(":");
		const player = client.manager.get(guildId);
		let page = parseInt(pageString);
		
		if (!player) {
			return interaction.reply({
				embeds: [
					client.Embed("❌ | **There is no player to control in this server.**"),
				],
				ephemeral: true
			});
		}
		
		const totalPages = Math.ceil(player.queue.length / 5);
		
		if (action === "next") {
			page = page + 1 < totalPages ? page + 1 : 0;
		} else if (action === "prev") {
			page = page > 0 ? page - 1 : totalPages - 1;
		}
		
		// Obter a lista de músicas para a página atual
		const startIndex = page * 5;
		const queueList = player.queue.map(
			(t, i) => `\` ${i + 1} \` [${t.title}](${t.uri}) [${t.requester}]`
		).slice(startIndex, startIndex + 5).join("\n");
		
		let song = player.queue.current;
		var title = escapeMarkdown(song.title)
		var title = title.replace(/\]/g,"")
		var title = title.replace(/\[/g,"")
		
		const queueEmbed = new MessageEmbed()
			.setColor(client.config.embedColor)
			.setDescription(`**♪ | Now playing:** [${title}](${song.uri})\n\n**Queued Tracks**\n${queueList}`)
			.addFields(
				{
					name: "Duration",
					value: song.isStream
						? `\`LIVE\``
						: `\`${client.ms(player.position, { colonNotation: true })} / ${client.ms(
							player.queue.current.duration,
							{ colonNotation: true },
						)}\``,
					inline: true,
				},
				{
					name: "Volume",
					value: `\`${player.volume}\``,
					inline: true,
				},
				{
					name: "Total Tracks",
					value: `\`${player.queue.totalSize - 1}\``,
					colonNotation: true,
					inline: true,
				},
			)
			.setFooter({ text: `Page ${page + 1}/${totalPages}` });
		
		const navigationRow = new MessageActionRow().addComponents(
			new MessageButton()
				.setCustomId(`queue:${guildId}:prev:${page}`)
				.setEmoji("⬅️")
				.setStyle("PRIMARY")
				.setDisabled(page === 0),
			new MessageButton()
				.setCustomId(`queue:${guildId}:next:${page}`)
				.setEmoji("➡️")
				.setStyle("PRIMARY")
				.setDisabled(page === totalPages - 1)
		);
		
		await interaction.update({ 
			embeds: [queueEmbed], 
			components: [navigationRow]
		});
		return;
	}
	
	// Para ajuste de volume
	if (interaction.customId.startsWith("volume:")) {
		const [, guildId, volumeLevel] = interaction.customId.split(":");
		const player = client.manager.get(guildId);
		
		if (!player) {
			return interaction.reply({
				embeds: [
					client.Embed("❌ | **There is no player to control in this server.**"),
				],
				ephemeral: true
			});
		}
		
		player.setVolume(parseInt(volumeLevel));
		
		return interaction.update({
			embeds: [
				new MessageEmbed()
					.setColor(client.config.embedColor)
					.setDescription(`🔊 | **Volume set to ${volumeLevel}%**`)
			],
			components: []
		});
	}
};