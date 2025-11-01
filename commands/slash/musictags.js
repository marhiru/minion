const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const db = require("../../util/db");

const command = new SlashCommand()
  .setName("musictags")
  .setDescription("🏷️ Explore music by genres and tags like Trap, Brazilian Funk, etc.")
  .addStringOption((option) =>
    option
      .setName("genre")
      .setDescription("Select a music genre to explore")
      .setRequired(false)
      .addChoices(
        { name: "🎵 Trap", value: "trap" },
        { name: "🔥 Rage Trap", value: "rage_trap" },
        { name: "🇧🇷 Brazilian Funk", value: "brazilian_funk" },
        { name: "🇧🇷 Brazilian Trap", value: "brazilian_trap" },
        { name: "🎤 Hip Hop", value: "hip_hop" },
        { name: "🎸 Rock", value: "rock" },
        { name: "🎹 Pop", value: "pop" },
        { name: "🎵 Electronic", value: "electronic" }
      )
  )
  .setRun(async (client, interaction, options) => {
    try {
      const selectedGenre = options.getString("genre");

      // Obter histórico do usuário para recomendações personalizadas
      let globalDb;
      try {
        globalDb = db.get("global");
      } catch {
        globalDb = {};
      }

      const userId = interaction.user.id;
      const userHistory = globalDb[`userHistory_${userId}`] || [];

      // Mapeamento de gêneros para termos de busca
      const genreQueries = {
        trap: ["trap", "travis scott", "future", "lil baby", "roddy ricch"],
        rage_trap: ["playboi carti", "lil uzi vert", "trippie redd", "yeat", "ken carson"],
        brazilian_funk: ["MC Ryan SP", "MC Hariel", "MC Paiva", "funk brasileiro", "baile funk"],
        brazilian_trap: ["trap brasileiro", "MC Davi", "MC Cabelinho", "Veigh", "Teto"],
        hip_hop: ["hip hop", "rap", "kendrick lamar", "drake", "j cole"],
        rock: ["rock", "metal", "alternative rock", "indie rock"],
        pop: ["pop", "taylor swift", "ariana grande", "dua lipa"],
        electronic: ["electronic", "edm", "house", "techno", "dubstep"]
      };

      if (selectedGenre && genreQueries[selectedGenre]) {
        // Mostrar recomendações para o gênero específico
        await showGenreRecommendations(client, interaction, selectedGenre, genreQueries[selectedGenre], userHistory);
      } else {
        // Mostrar interface principal com todos os gêneros
        await showMainTagsInterface(client, interaction, userHistory);
      }

    } catch (error) {
      console.error("Error in musictags command:", error);
      
      const errorEmbed = new MessageEmbed()
        .setColor("RED")
        .setTitle("❌ Error")
        .setDescription("An error occurred while loading music tags.")
        .setFooter({ text: "Please try again later." });

      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errorEmbed], components: [] });
      } else {
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  });

async function showMainTagsInterface(client, interaction, userHistory) {
  const tagsEmbed = new MessageEmbed()
    .setColor(client.config.embedColor || "#FF6B6B")
    .setAuthor({ 
      name: "🏷️ Music Tags & Genres", 
      iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
    })
    .setDescription("**Explore music by genres and discover new sounds!**\n\n" +
      "Click on any genre button below to get personalized recommendations based on your listening history.")
    .addFields(
      {
        name: "🎵 Available Genres",
        value: "**🎵 Trap** • **🔥 Rage Trap** • **🇧🇷 Brazilian Funk**\n" +
               "**🇧🇷 Brazilian Trap** • **🎤 Hip Hop** • **🎸 Rock**\n" +
               "**🎹 Pop** • **🎵 Electronic**",
        inline: false
      }
    )
    .setFooter({ 
      text: `Based on ${userHistory.length} songs in your history`,
      iconURL: client.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  // Criar botões de gênero
  const row1 = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId("genre_trap")
        .setLabel("Trap")
        .setStyle("PRIMARY")
        .setEmoji("🎵"),
      new MessageButton()
        .setCustomId("genre_rage_trap")
        .setLabel("Rage Trap")
        .setStyle("DANGER")
        .setEmoji("🔥"),
      new MessageButton()
        .setCustomId("genre_brazilian_funk")
        .setLabel("Brazilian Funk")
        .setStyle("SUCCESS")
        .setEmoji("🇧🇷"),
      new MessageButton()
        .setCustomId("genre_brazilian_trap")
        .setLabel("Brazilian Trap")
        .setStyle("SUCCESS")
        .setEmoji("🇧🇷")
    );

  const row2 = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId("genre_hip_hop")
        .setLabel("Hip Hop")
        .setStyle("SECONDARY")
        .setEmoji("🎤"),
      new MessageButton()
        .setCustomId("genre_rock")
        .setLabel("Rock")
        .setStyle("SECONDARY")
        .setEmoji("🎸"),
      new MessageButton()
        .setCustomId("genre_pop")
        .setLabel("Pop")
        .setStyle("PRIMARY")
        .setEmoji("🎹"),
      new MessageButton()
        .setCustomId("genre_electronic")
        .setLabel("Electronic")
        .setStyle("PRIMARY")
        .setEmoji("🎵")
    );

  const row3 = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId("surprise_genre")
        .setLabel("✨ Surprise Me")
        .setStyle("SUCCESS")
        .setEmoji("🎲"),
      new MessageButton()
        .setCustomId("my_top_genres")
        .setLabel("📊 My Top Genres")
        .setStyle("SECONDARY")
        .setEmoji("📊")
    );

  const reply = await interaction.reply({
    embeds: [tagsEmbed],
    components: [row1, row2, row3],
    fetchReply: true
  });

  // Collector para interações
  const collector = reply.createMessageComponentCollector({
    time: 300000 // 5 minutos
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      return i.reply({
        content: "❌ Only the command user can interact with this menu!",
        ephemeral: true
      });
    }

    await i.deferUpdate();

    const genreQueries = {
      trap: ["trap", "travis scott", "future", "lil baby", "roddy ricch"],
      rage_trap: ["playboi carti", "lil uzi vert", "trippie redd", "yeat", "ken carson"],
      brazilian_funk: ["MC Ryan SP", "MC Hariel", "MC Paiva", "funk brasileiro", "baile funk"],
      brazilian_trap: ["trap brasileiro", "MC Davi", "MC Cabelinho", "Veigh", "Teto"],
      hip_hop: ["hip hop", "rap", "kendrick lamar", "drake", "j cole"],
      rock: ["rock", "metal", "alternative rock", "indie rock"],
      pop: ["pop", "taylor swift", "ariana grande", "dua lipa"],
      electronic: ["electronic", "edm", "house", "techno", "dubstep"]
    };

    if (i.customId.startsWith("genre_")) {
      const genre = i.customId.replace("genre_", "");
      await showGenreRecommendations(client, i, genre, genreQueries[genre], userHistory);
    } else if (i.customId === "surprise_genre") {
      const genres = Object.keys(genreQueries);
      const randomGenre = genres[Math.floor(Math.random() * genres.length)];
      await showGenreRecommendations(client, i, randomGenre, genreQueries[randomGenre], userHistory);
    } else if (i.customId === "my_top_genres") {
      await showTopGenres(client, i, userHistory);
    }
  });

  collector.on("end", () => {
    const disabledComponents = [row1, row2, row3].map(row => {
      row.components.forEach(component => component.setDisabled(true));
      return row;
    });

    interaction.editReply({
      components: disabledComponents
    }).catch(() => {});
  });
}

async function showGenreRecommendations(client, interaction, genre, queries, userHistory) {
  const genreNames = {
    trap: "🎵 Trap",
    rage_trap: "🔥 Rage Trap", 
    brazilian_funk: "🇧🇷 Brazilian Funk",
    brazilian_trap: "🇧🇷 Brazilian Trap",
    hip_hop: "🎤 Hip Hop",
    rock: "🎸 Rock",
    pop: "🎹 Pop",
    electronic: "🎵 Electronic"
  };

  // Filtrar histórico por gênero (busca básica por palavras-chave)
  const genreHistory = userHistory.filter(track => {
    const trackText = `${track.title} ${track.author}`.toLowerCase();
    return queries.some(query => trackText.includes(query.toLowerCase()));
  });

  const embed = new MessageEmbed()
    .setColor(client.config.embedColor || "#9B59B6")
    .setAuthor({ 
      name: `${genreNames[genre]} Recommendations`, 
      iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
    })
    .setDescription(`**Discover amazing ${genreNames[genre]} music!**\n\n` +
      (genreHistory.length > 0 ? 
        `Found **${genreHistory.length}** ${genreNames[genre]} tracks in your history.` :
        `Start exploring ${genreNames[genre]} to build your personalized recommendations!`
      ))
    .setFooter({ 
      text: `Genre: ${genreNames[genre]} • Click buttons to explore`,
      iconURL: client.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  if (genreHistory.length > 0) {
    let tracksList = "";
    genreHistory.slice(0, 5).forEach((track, index) => {
      const duration = track.duration ? client.ms(track.duration, { colonNotation: true, secondsDecimalDigits: 0 }) : "Unknown";
      tracksList += `**${index + 1}.** ${track.title}\n`;
      tracksList += `👤 ${track.author} • ⏱️ ${duration}\n\n`;
    });

    embed.addField(`🎶 Your ${genreNames[genre]} History`, tracksList, false);
  }

  // Adicionar sugestões de busca
  const suggestions = queries.slice(0, 3).map(q => `\`${q}\``).join(" • ");
  embed.addField("💡 Try searching for", suggestions, false);

  const actionRow = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId(`play_genre_${genre}`)
        .setLabel(`Play ${genreNames[genre]}`)
        .setStyle("PRIMARY")
        .setEmoji("▶️"),
      new MessageButton()
        .setCustomId(`shuffle_genre_${genre}`)
        .setLabel("🔀 Shuffle Genre")
        .setStyle("SECONDARY")
        .setEmoji("🔀"),
      new MessageButton()
        .setCustomId("back_to_genres")
        .setLabel("⬅️ Back")
        .setStyle("SECONDARY")
        .setEmoji("⬅️")
    );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow]
  });
}

async function showTopGenres(client, interaction, userHistory) {
  // Analisar gêneros mais ouvidos baseado no histórico
  const genreCount = {};
  const genreQueries = {
    "🎵 Trap": ["trap", "travis scott", "future"],
    "🔥 Rage Trap": ["playboi carti", "lil uzi", "yeat"],
    "🇧🇷 Brazilian Funk": ["MC", "funk", "baile"],
    "🇧🇷 Brazilian Trap": ["trap brasileiro", "Veigh", "Teto"],
    "🎤 Hip Hop": ["hip hop", "rap", "kendrick"],
    "🎸 Rock": ["rock", "metal", "alternative"],
    "🎹 Pop": ["pop", "taylor", "ariana"],
    "🎵 Electronic": ["electronic", "edm", "house"]
  };

  Object.keys(genreQueries).forEach(genre => {
    genreCount[genre] = userHistory.filter(track => {
      const trackText = `${track.title} ${track.author}`.toLowerCase();
      return genreQueries[genre].some(query => trackText.includes(query.toLowerCase()));
    }).length;
  });

  const sortedGenres = Object.entries(genreCount)
    .sort(([,a], [,b]) => b - a)
    .filter(([,count]) => count > 0)
    .slice(0, 5);

  const embed = new MessageEmbed()
    .setColor("#FFD700")
    .setAuthor({ 
      name: "📊 Your Top Genres", 
      iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
    })
    .setDescription("**Your most listened music genres based on your history:**")
    .setFooter({ 
      text: `Analyzed ${userHistory.length} tracks from your history`,
      iconURL: client.user.displayAvatarURL({ dynamic: true })
    })
    .setTimestamp();

  if (sortedGenres.length > 0) {
    let genresList = "";
    sortedGenres.forEach(([genre, count], index) => {
      const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
      genresList += `${medals[index]} **${genre}** - ${count} tracks\n`;
    });

    embed.addField("🏆 Your Top 5 Genres", genresList, false);
  } else {
    embed.setDescription("**No genre data available yet!**\n\nStart playing music to build your genre statistics.");
  }

  const backButton = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId("back_to_genres")
        .setLabel("⬅️ Back to Genres")
        .setStyle("SECONDARY")
        .setEmoji("⬅️")
    );

  await interaction.editReply({
    embeds: [embed],
    components: [backButton]
  });
}

module.exports = command;
