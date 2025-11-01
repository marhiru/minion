const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");
const escapeMarkdown = require("discord.js").Util.escapeMarkdown;
const db = require("../../util/db");

const command = new SlashCommand()
  .setName("play")
  .setDescription(
    "Searches and plays the requested song \nSupports: \nYoutube, Spotify, Deezer, Apple Music"
  )
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("What am I looking for?")
      .setAutocomplete(true)
      .setRequired(true)
  )
  .setRun(async (client, interaction, options) => {
    let channel = await client.getChannel(client, interaction);
    if (!channel) {
      return;
    }

    let node = await client.getLavalink(client);
    if (!node) {
      return interaction.reply({
        embeds: [client.ErrorEmbed("Lavalink node is not connected")],
      });
    }

    let player = client.createPlayer(interaction.channel, channel);

    if (player.state !== "CONNECTED") {
      player.connect();
    }

    if (channel.type == "GUILD_STAGE_VOICE") {
      setTimeout(() => {
        if (interaction.guild.members.me.voice.suppress == true) {
          try {
            interaction.guild.members.me.voice.setSuppressed(false);
          } catch (e) {
            interaction.guild.members.me.voice.setRequestToSpeak(true);
          }
        }
      }, 2000); // Need this because discord api is buggy asf, and without this the bot will not request to speak on a stage - Darren
    }

    const ret = await interaction.reply({
      embeds: [
        new MessageEmbed()
          .setColor(client.config.embedColor)
          .setDescription(":mag_right: **Searching...**"),
      ],
      fetchReply: true,
    });

    let query = options.getString("query", true);
    let res = await player.search(query, interaction.user).catch((err) => {
      client.error(err);
      return {
        loadType: "LOAD_FAILED",
      };
    });

    if (res.loadType === "LOAD_FAILED") {
      if (!player.queue.current) {
        player.destroy();
      }
      await interaction
        .editReply({
          embeds: [
            new MessageEmbed()
              .setColor("RED")
              .setDescription("There was an error while searching"),
          ],
        })
        .catch(this.warn);
    }

    if (res.loadType === "NO_MATCHES") {
      if (!player.queue.current) {
        player.destroy();
      }
      await interaction
        .editReply({
          embeds: [
            new MessageEmbed()
              .setColor("RED")
              .setDescription("No results were found"),
          ],
        })
        .catch(this.warn);
    }

    if (res.loadType === "TRACK_LOADED" || res.loadType === "SEARCH_RESULT") {
      player.queue.add(res.tracks[0]);

      // Salvar no histórico do usuário para o comando Jump Back In
      try {
        let globalDb;
        try {
          globalDb = db.get("global");
        } catch {
          globalDb = {};
        }

        const userId = interaction.user.id;
        const userHistoryKey = `userHistory_${userId}`;
        
        if (!globalDb[userHistoryKey]) {
          globalDb[userHistoryKey] = [];
        }

        const trackData = {
          title: res.tracks[0].title,
          author: res.tracks[0].author,
          uri: res.tracks[0].uri,
          duration: res.tracks[0].duration,
          thumbnail: res.tracks[0].thumbnail,
          addedAt: new Date().toISOString(),
          addedBy: interaction.user.id
        };

        // Adicionar ao histórico (máximo 100 músicas por usuário)
        globalDb[userHistoryKey].push(trackData);
        if (globalDb[userHistoryKey].length > 100) {
          globalDb[userHistoryKey] = globalDb[userHistoryKey].slice(-100);
        }

        db.set("global", globalDb);
      } catch (error) {
        console.error("Error saving to user history:", error);
      }

      if (!player.playing && !player.paused && !player.queue.size) {
        player.play();
      }
      var title = escapeMarkdown(res.tracks[0].title);
      var title = title.replace(/\]/g, "");
      var title = title.replace(/\[/g, "");
      let addQueueEmbed = new MessageEmbed()
        .setColor(client.config.embedColor)
        .setAuthor({ name: "Added to queue", iconURL: client.config.iconURL })
        .setDescription(`[${title}](${res.tracks[0].uri})` || "No Title")
        .setURL(res.tracks[0].uri)
        .addFields(
          {
            name: "Added by",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: "Duration",
            value: res.tracks[0].isStream
              ? `\`LIVE 🔴 \``
              : `\`${client.ms(res.tracks[0].duration, {
                  colonNotation: true,
                  secondsDecimalDigits: 0,
                })}\``,
            inline: true,
          }
        );

      try {
        addQueueEmbed.setThumbnail(
          res.tracks[0].displayThumbnail("maxresdefault")
        );
      } catch (err) {
        addQueueEmbed.setThumbnail(res.tracks[0].thumbnail);
      }

      if (player.queue.totalSize > 1) {
        addQueueEmbed.addFields({
          name: "Position in queue",
          value: `${player.queue.size}`,
          inline: true,
        });
      } else {
        player.queue.previous = player.queue.current;
      }

      await interaction.editReply({ embeds: [addQueueEmbed] }).catch(this.warn);
    }

    if (res.loadType === "PLAYLIST_LOADED") {
      player.queue.add(res.tracks);

      // Salvar playlist no histórico do usuário
      try {
        let globalDb;
        try {
          globalDb = db.get("global");
        } catch {
          globalDb = {};
        }

        const userId = interaction.user.id;
        const userHistoryKey = `userHistory_${userId}`;
        
        if (!globalDb[userHistoryKey]) {
          globalDb[userHistoryKey] = [];
        }

        // Adicionar todas as músicas da playlist ao histórico
        res.tracks.forEach(track => {
          const trackData = {
            title: track.title,
            author: track.author,
            uri: track.uri,
            duration: track.duration,
            thumbnail: track.thumbnail,
            addedAt: new Date().toISOString(),
            addedBy: interaction.user.id,
            fromPlaylist: res.playlist.name
          };

          globalDb[userHistoryKey].push(trackData);
        });

        // Manter apenas as últimas 100 músicas
        if (globalDb[userHistoryKey].length > 100) {
          globalDb[userHistoryKey] = globalDb[userHistoryKey].slice(-100);
        }

        db.set("global", globalDb);
      } catch (error) {
        console.error("Error saving playlist to user history:", error);
      }

      if (
        !player.playing &&
        !player.paused &&
        player.queue.totalSize === res.tracks.length
      ) {
        player.play();
      }

      let playlistEmbed = new MessageEmbed()
        .setColor(client.config.embedColor)
        .setAuthor({
          name: "Playlist added to queue",
          iconURL: client.config.iconURL,
        })
        .setThumbnail(res.tracks[0].thumbnail)
        .setDescription(`[${res.playlist.name}](${query})`)
        .addFields(
          {
            name: "Enqueued",
            value: `\`${res.tracks.length}\` songs`,
            inline: true,
          },
          {
            name: "Playlist duration",
            value: `\`${client.ms(res.playlist.duration, {
              colonNotation: true,
              secondsDecimalDigits: 0,
            })}\``,
            inline: true,
          }
        );

      await interaction.editReply({ embeds: [playlistEmbed] }).catch(this.warn);
    }

    if (ret) setTimeout(() => ret.delete().catch(this.warn), 20000);
    return ret;
  });

module.exports = command;
