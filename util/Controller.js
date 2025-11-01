const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require("discord.js");
const escapeMarkdown = require('discord.js').Util.escapeMarkdown;

/**
 *
 * @param {import("../lib/DiscordMusicBot")} client
 * @param {import("discord.js").ButtonInteraction} interaction
 */
module.exports = async (client, interaction) => {
	let guild = client.guilds.cache.get(interaction.customId.split(":")[1]);
	let property = interaction.customId.split(":")[2];
	let player = client.manager.get(guild.id);

	if (!player) {
		await interaction.reply({
			embeds: [
				client.Embed("❌ | **There is no player to control in this server.**"),
			],
		});
		setTimeout(() => {
			interaction.deleteReply();
		}, 5000);
		return;
	}
	if (!interaction.member.voice.channel) {
		const joinEmbed = new MessageEmbed()
			.setColor(client.config.embedColor)
			.setDescription(
				"❌ | **You must be in a voice channel to use this action!**",
			);
		return interaction.reply({ embeds: [joinEmbed], ephemeral: true });
	}

	if (
		interaction.guild.members.me.voice.channel &&
		!interaction.guild.members.me.voice.channel.equals(interaction.member.voice.channel)
	) {
		const sameEmbed = new MessageEmbed()
			.setColor(client.config.embedColor)
			.setDescription(
				"❌ | **You must be in the same voice channel as me to use this action!**",
			);
		return await interaction.reply({ embeds: [sameEmbed], ephemeral: true });
	}

	if (property === "Stop") {
		player.queue.clear();
		player.stop();
		player.set("autoQueue", false);
		client.warn(`Player: ${ player.options.guild } | Successfully stopped the player`);
		const msg = await interaction.channel.send({
			embeds: [
				client.Embed(
					"⏹️ | **Successfully stopped the player**",
				),
			],
		});
		setTimeout(() => {
			msg.delete();
		}, 5000);

		interaction.update({
			components: client.createController(player.options.guild, player),
		});
		return;
	}

	// if theres no previous song, return an error.
	if (property === "Replay") {
		const previousSong = player.queue.previous;
		const currentSong = player.queue.current;
		const nextSong = player.queue[0]
        if (!player.queue.previous ||
            player.queue.previous === player.queue.current ||
            player.queue.previous === player.queue[0]) {
            
           return interaction.reply({
                        ephemeral: true,
			embeds: [
				new MessageEmbed()
					.setColor("RED")
					.setDescription(`There is no previous song played.`),
			],
		});
    }
		if (previousSong !== currentSong && previousSong !== nextSong) {
			player.queue.splice(0, 0, currentSong)
			player.play(previousSong);
			return interaction.deferUpdate();
		}
	}

	if (property === "PlayAndPause") {
		if (!player || (!player.playing && player.queue.totalSize === 0)) {
			const msg = await interaction.channel.send({
                ephemeral: true,
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription("There is no song playing right now."),
				],
			});
			setTimeout(() => {
				msg.delete();
			}, 5000);
			return interaction.deferUpdate();
		} else {

			if (player.paused) {
				player.pause(false);
			} else {
				player.pause(true);
			}
			client.warn(`Player: ${ player.options.guild } | Successfully ${ player.paused? "paused" : "resumed" } the player`);

			return interaction.update({
				components: client.createController(player.options.guild, player),
			});
		}
	}

	if (property === "Next") {
        const song = player.queue.current;
	    const autoQueue = player.get("autoQueue");
        if (player.queue[0] == undefined && (!autoQueue || autoQueue === false)) {
		    return interaction.reply({
                ephemeral: true,
			    embeds: [
				    new MessageEmbed()
					    .setColor("RED")
					    .setDescription(`There is nothing after [${ song.title }](${ song.uri }) in the queue.`),
			    ],
		    });
        } else {
            player.stop();
            return interaction.deferUpdate();
        }
    }

	if (property === "Loop") {
		if (player.trackRepeat) {
			player.setTrackRepeat(false);
			player.setQueueRepeat(true);
		} else if (player.queueRepeat) {
			player.setQueueRepeat(false);
		} else {
			player.setTrackRepeat(true);
		}
		client.warn(`Player: ${player.options.guild} | Successfully toggled loop ${player.trackRepeat ? "on" : player.queueRepeat ? "queue on" : "off"} the player`);

		interaction.update({
			components: client.createController(player.options.guild, player),
		});
		return;
	}

	// Novos controles com menus interativos
	if (property === "Filters") {
		// Criar um menu de seleção para os filtros
		const filtersMenu = new MessageActionRow().addComponents(
			new MessageSelectMenu()
				.setCustomId(`filters:${guild.id}`)
				.setPlaceholder('Select a filter')
				.addOptions([
					{ label: 'Nightcore', value: 'nightcore', emoji: '🎛️' },
					{ label: 'BassBoost Low', value: 'bassboost_low', emoji: '🔈' },
					{ label: 'BassBoost Medium', value: 'bassboost_medium', emoji: '🔉' },
					{ label: 'BassBoost High', value: 'bassboost_high', emoji: '🔊'  },
					{ label: 'Vaporwave', value: 'vaporwave', emoji: '🌊' },
					{ label: 'Pop', value: 'pop', emoji: '🎵' },
					{ label: 'Soft', value: 'soft', emoji: '🔉' },
					{ label: 'Treblebass', value: 'treblebass', emoji: '🎚️' },
					{ label: 'Eight Dimension', value: 'eightD', emoji: '🎧' },
					{ label: 'Karaoke', value: 'karaoke', emoji: '🎤' },
					{ label: 'Vibrato', value: 'vibrato', emoji: '📳' },
					{ label: 'Tremolo', value: 'tremolo', emoji: '📳' },
					{ label: 'Reset', value: 'off', emoji: '🔄' },
				]),
		);

		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setColor(client.config.embedColor)
					.setDescription("🎛️ | **Select a filter to apply**")
			],
			components: [filtersMenu],
			ephemeral: true
		});
		return;
	}

	if (property === "NowPlaying") {
		let song = player.queue.current;
		if (!song) {
			return interaction.reply({
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription("There is no song playing right now."),
				],
				ephemeral: true
			});
		}
		
		var title = escapeMarkdown(song.title)
		var title = title.replace(/\]/g,"")
		var title = title.replace(/\[/g,"")
		
		const embed = new MessageEmbed()
			.setColor(client.config.embedColor)
			.setAuthor({ name: "Now Playing", iconURL: client.config.iconURL })
			.setDescription(`[${title}](${song.uri})`)
			.addFields(
				{
					name: "Requested by",
					value: `${song.requester || `<@${client.user.id}>`}`,
					inline: true,
				},
				{
					name: "Duration",
					value: song.isStream
						? `\`LIVE\``
						: `\`${client.ms(player.position, {
								colonNotation: true,
							})} / ${client.ms(song.duration, {
								colonNotation: true,
							})}\``,
					inline: true,
				}
			);
		
		try {
			embed.setThumbnail(song.displayThumbnail("maxresdefault"));
		} catch (err) {
			embed.setThumbnail(song.thumbnail);
		}
		
		await interaction.reply({ embeds: [embed], ephemeral: true });
		return;
	}

	if (property === "Queue") {
		if (!player.queue || !player.queue.length) {
			let song = player.queue.current;
			if (!song) {
				return interaction.reply({
					embeds: [
						new MessageEmbed()
							.setColor("RED")
							.setDescription("There is no song playing right now."),
					],
					ephemeral: true
				});
			}
			
			var title = escapeMarkdown(song.title)
			var title = title.replace(/\]/g,"")
			var title = title.replace(/\[/g,"")
			
			const queueEmbed = new MessageEmbed()
				.setColor(client.config.embedColor)
				.setDescription(`**♪ | Now playing:** [${title}](${song.uri})`)
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
				);
			
			return interaction.reply({ embeds: [queueEmbed], ephemeral: true });
		}
		
		// Se houver músicas na fila, mostrar as primeiras 5 com botões para navegar
		let queueList = player.queue.map(
			(t, i) => `\` ${++i} \` [${t.title}](${t.uri}) [${t.requester}]`
		).slice(0, 5).join("\n");
		
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
			.setFooter({ text: `Page 1/${Math.ceil(player.queue.length/5)}` });
		
		// Só adicionar botões de navegação se houver mais de 5 músicas
		let components = [];
		if (player.queue.length > 5) {
			const navigationRow = new MessageActionRow().addComponents(
				new MessageButton()
					.setCustomId(`queue:${guild.id}:prev:0`)
					.setEmoji("⬅️")
					.setStyle("PRIMARY")
					.setDisabled(true),
				new MessageButton()
					.setCustomId(`queue:${guild.id}:next:0`)
					.setEmoji("➡️")
					.setStyle("PRIMARY")
			);
			components.push(navigationRow);
		}
		
		await interaction.reply({ 
			embeds: [queueEmbed], 
			components: components,
			ephemeral: true 
		});
		return;
	}

	if (property === "Shuffle") {
		if (!player.queue || player.queue.length < 2) {
			return interaction.reply({
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription("There are not enough songs in the queue to shuffle."),
				],
				ephemeral: true
			});
		}
		
		player.queue.shuffle();
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setColor(client.config.embedColor)
					.setDescription("🔀 | **Successfully shuffled the queue.**"),
			],
			ephemeral: true
		});
		return;
	}

	if (property === "Volume") {
		// Criar botões para ajuste rápido de volume
		const volumeRow = new MessageActionRow().addComponents(
			new MessageButton()
				.setCustomId(`volume:${guild.id}:10`)
				.setLabel("10%")
				.setStyle("SECONDARY"),
			new MessageButton()
				.setCustomId(`volume:${guild.id}:50`)
				.setLabel("50%")
				.setStyle("SECONDARY"),
			new MessageButton()
				.setCustomId(`volume:${guild.id}:100`)
				.setLabel("100%")
				.setStyle("SECONDARY"),
			new MessageButton()
				.setCustomId(`volume:${guild.id}:150`)
				.setLabel("150%")
				.setStyle("SECONDARY")
		);
		
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setColor(client.config.embedColor)
					.setDescription(`🔊 | **Current volume: ${player.volume}%**\nSelect a preset volume or use \`/volume\` for custom values.`)
			],
			components: [volumeRow],
			ephemeral: true
		});
		return;
	}

	return interaction.reply({
		ephemeral: true,
		content: "❌ | **Unknown controller option**",
	});
};