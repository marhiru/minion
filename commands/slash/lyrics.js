const SlashCommand = require("../../lib/SlashCommand");
const {
	MessageActionRow,
	MessageSelectMenu,
	MessageButton,
	MessageEmbed
} = require("discord.js");
const axios = require("axios");

const command = new SlashCommand()
	.setName("lyrics")
	.setDescription("Get the lyrics of a song")
	.addStringOption((option) =>
		option
			.setName("song")
			.setDescription("The song to get lyrics for")
			.setRequired(false),
	)
	.addStringOption((option) =>
		option
			.setName("artist")
			.setDescription("Artist of the song (optional)")
			.setRequired(false),
	)
	.setRun(async (client, interaction, options) => {
		await interaction.reply({
			embeds: [
				new MessageEmbed()
					.setColor(client.config.embedColor)
					.setDescription("🔎 | **Searching...**"),
			],
		});

		let player;
		if (client.manager) {
			player = client.manager.players.get(interaction.guild.id);
		} else {
			return interaction.editReply({
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription("Lavalink node is not connected"),
				],
			});
		}

		const songArg = interaction.options.getString("song");
		const artistArg = interaction.options.getString("artist");
		
		if (!songArg && !player) {
			return interaction.editReply({
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription("There's nothing playing"),
				],
			});
		}

		let currentTitle = ``;
		let currentArtist = ``;
		const phrasesToRemove = [
			"Full Video", "Full Audio", "Official Music Video", "Lyrics", "Lyrical Video",
			"Feat.", "Ft.", "Official", "Audio", "Video", "HD", "4K", "Remix", "Lyric Video", "Lyrics Video", "8K", 
			"High Quality", "Animation Video", "\\(Official Video\\. .*\\)", "\\(Music Video\\. .*\\)", "\\[NCS Release\\]",
			"Extended", "DJ Edit", "with Lyrics", "Lyrics", "Karaoke",
			"Instrumental", "Live", "Acoustic", "Cover", "\\(feat\\. .*\\)"
		];
		
		if (!songArg) {
			currentTitle = player.queue.current.title;
			currentTitle = currentTitle
				.replace(new RegExp(phrasesToRemove.join('|'), 'gi'), '')
				.replace(/\s*([\[\(].*?[\]\)])?\s*(\|.*)?\s*(\*.*)?$/, '');
			
			// Try to extract artist from title if it's in "Artist - Title" format
			const titleParts = currentTitle.split(' - ');
			if (titleParts.length > 1) {
				currentArtist = titleParts[0].trim();
				currentTitle = titleParts[1].trim();
			}
		}
		
		let query = songArg || currentTitle;
		let artist = artistArg || currentArtist;

		try {
			// Check if Lyrics.com API credentials are configured
			if (!client.config.lyricsApiUid || !client.config.lyricsApiToken) {
				return interaction.editReply({
					embeds: [
						new MessageEmbed()
							.setColor("RED")
							.setDescription("Lyrics.com API credentials are not configured. Please set them up in the config.js file."),
					],
				});
			}

			// Build API URL with parameters
			let apiUrl = `https://www.stands4.com/services/v2/lyrics.php?uid=${client.config.lyricsApiUid}&tokenid=${client.config.lyricsApiToken}&term=${encodeURIComponent(query)}&format=json`;
			
			// Add artist to query if available
			if (artist) {
				apiUrl += `&artist=${encodeURIComponent(artist)}`;
			}
			
			// Make request to Lyrics.com API
			const response = await axios.get(apiUrl);
			
			// Check if response has results
			if (!response.data.results || !response.data.results.result) {
				throw new Error("No lyrics found");
			}
			
			const result = response.data.results.result;
			const songTitle = result.song.trim();
			const artistName = result.artist.trim();
			const songLink = result["song-link"];
			const albumName = result.album?.trim() || "Unknown album";
			
			// Get lyrics page using direct link provided by API
			const lyricsResponse = await axios.get(songLink);
			
			// Use regex to extract lyrics from HTML page
			const lyricsMatch = lyricsResponse.data.match(/<div id="lyric-body-text"[^>]*>([\s\S]*?)<\/div>/i);
			let lyricsText = "";
			
			if (lyricsMatch && lyricsMatch[1]) {
				// Clean HTML and formatting
				lyricsText = lyricsMatch[1]
					.replace(/<br\s*\/?>/gi, '\n') // Replace <br> with line breaks
					.replace(/<[^>]*>/g, '')       // Remove other HTML tags
					.replace(/&nbsp;/g, ' ')       // Replace &nbsp; with spaces
					.replace(/&amp;/g, '&')        // Replace &amp; with &
					.replace(/&lt;/g, '<')         // Replace &lt; with <
					.replace(/&gt;/g, '>')         // Replace &gt; with >
					.trim();
			}
			
			if (!lyricsText) {
				throw new Error("Could not extract lyrics");
			}

			const button = new MessageActionRow()
				.addComponents(
					new MessageButton()
						.setCustomId('tipsbutton')
						.setLabel('Tips')
						.setEmoji(`📌`)
						.setStyle('SECONDARY')
				);

			let lyricsEmbed = new MessageEmbed()
				.setColor(client.config.embedColor)
				.setTitle(`${songTitle} - ${artistName}`)
				.setURL(songLink)
				.setFooter({
					text: `Lyrics provided by Lyrics.com | Album: ${albumName}`,
				})
				.setDescription(lyricsText);

			if (lyricsText.length > 4096) {
				const truncatedText = lyricsText.substring(0, 4050) + "\n\n[...]";
				lyricsEmbed.setDescription(truncatedText + `\nTruncated, the lyrics were too long.`);
			}

			return interaction.editReply({
				embeds: [lyricsEmbed],
				components: [button],
			});

		} catch (error) {
			console.error(error);
			const button = new MessageActionRow()
				.addComponents(
					new MessageButton()
						.setEmoji(`📌`)
						.setCustomId('tipsbutton')
						.setLabel('Tips')
						.setStyle('SECONDARY'),
				);
			return interaction.editReply({
				embeds: [
					new MessageEmbed()
						.setColor("RED")
						.setDescription(
							`No lyrics found for \`${query}\`${artist ? ` by \`${artist}\`` : ''}!\nMake sure you typed your search correctly.`,
						),
				], components: [button],
			});
		}

		const collector = interaction.channel.createMessageComponentCollector({
			time: 1000 * 3600
		});

		collector.on('collect', async interaction => {
			if (interaction.customId === 'tipsbutton') {
				await interaction.deferUpdate();
				await interaction.followUp({
					embeds: [
						new MessageEmbed()
							.setTitle(`Lyrics Tips`)
							.setColor(client.config.embedColor)
							.setDescription(
								`Here are some tips to get your song lyrics correctly \n\n\
                                1. Try to add the artist name using the artist parameter.\n\
                                2. Use the exact song name without additional words like "lyrics" or "official".\n\
                                3. Check the spelling of artists and song names.\n\
                                4. For less known songs, try searching only for the most famous part of the lyrics.`,
							),
					], ephemeral: true, components: []
				});
			};
		});
	});

module.exports = command;
