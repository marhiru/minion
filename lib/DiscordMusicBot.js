const {
  Client,
  Intents,
  MessageEmbed,
  Collection,
  MessageActionRow,
  MessageButton,
} = require("discord.js");
const escapeMarkdown = require('discord.js').Util.escapeMarkdown;
const fs = require("fs");
const path = require("path");
const prettyMilliseconds = require("pretty-ms");
const jsoning = require("jsoning"); // Documentation: https://jsoning.js.org/
const { Manager } = require("erela.js");
const ConfigFetcher = require("../util/getConfig");
const Logger = require("./Logger");
const spotify = require("better-erela.js-spotify").default;
const { default: AppleMusic } = require("better-erela.js-apple");
const deezer = require("erela.js-deezer");
const facebook = require("erela.js-facebook");
const Server = require("../api");
const getLavalink = require("../util/getLavalink");
const getChannel = require("../util/getChannel");
const colors = require("colors");
const filters = require("erela.js-filters");
const { default: EpicPlayer } = require("./EpicPlayer");
const { clientSecret } = require("../config");
const LogManager = require('../events/logs');
const LavalinkMonitor = require('../util/LavalinkMonitor');
const createProgressBar = (current, total, barSize = 15) => {
  if (!total || total === 0 || isNaN(total)) return "🔴 LIVE";
  
  // Garantir que current não seja maior que total
  current = Math.min(current, total);
  
  // Garantir que current não seja negativo
  current = Math.max(current, 0);
  
  // Criar barra visual
  const progress = Math.round((current / total) * barSize);
  const progressText = "▬".repeat(progress);
  const remainingText = "▬".repeat(barSize - progress);
  
  // Retornar barra com formato simples de tempo
  return `${progressText}🔘${remainingText} \`${prettyMilliseconds(current, { colonNotation: true })}/${prettyMilliseconds(total, { colonNotation: true })}\``;
};

class DiscordMusicBot extends Client {
  /**
   * Create the music client
   * @param {import("discord.js").ClientOptions} props - Client options
   */
  constructor(
    props = {
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_MESSAGES,
      ],
      partials: ['MESSAGE', 'CHANNEL', 'REACTION']
    }
  ) {
    // Adiciona partials às propriedades padrão se não estiverem definidas
    if (!props.partials) {
      props.partials = ['MESSAGE', 'CHANNEL', 'REACTION'];
    }
    
    super(props);

    ConfigFetcher().then((conf) => {
      this.config = conf;
      
      // Adicionar configurações para crossfade e transição se não existirem
      if (!this.config.crossfadeDuration) this.config.crossfadeDuration = 3000; // 3 segundos de crossfade
      if (!this.config.transitionInterval) this.config.transitionInterval = 300; // 300ms de intervalo entre músicas
      if (!this.config.preloadTime) this.config.preloadTime = 0.85; // Pré-carregar quando 85% da música atual tiver sido reproduzida
      
      this.build();
    });

    //Load Events and stuff
    /**@type {Collection<string, import("./SlashCommand")} */
    this.slashCommands = new Collection();
    this.contextCommands = new Collection();

    this.logger = new Logger(path.join(__dirname, "..", "logs.log"));

    this.LoadCommands();
    this.LoadEvents();

    this.database = new jsoning("db.json");

    this.deletedMessages = new WeakSet();
    this.getLavalink = getLavalink;
    this.getChannel = getChannel;
    this.ms = prettyMilliseconds;
    this.commandsRan = 0;
    this.songsPlayed = 0;
    this.preloadCache = new Map(); // Cache para músicas pré-carregadas
  }

  /**
   * Send an info message
   * @param {string} text
   */
  log(text) {
    this.logger.log(text);
  }

  /**
   * Send an warning message
   * @param {string} text
   */
  warn(text) {
    this.logger.warn(text);
  }

  /**
   * Send an error message
   * @param {string} text
   */
  error(text) {
    this.logger.error(text);
  }

  /**
   * Pre-loads the next track to reduce transition time
   * @param {EpicPlayer} player - The player instance
   */
  async preloadNextTrack(player) {
    // Verifica se há uma próxima música na fila
    if (player.queue && player.queue.length > 0) {
      const nextTrack = player.queue[0];
      if (nextTrack) {
        this.warn(`Player: ${player.options.guild} | Preloading next track: ${nextTrack.title}`);
        
        // Se já temos a música em cache, não precisamos buscar novamente
        if (!this.preloadCache.has(nextTrack.identifier)) {
          try {
            // Pré-carrega a próxima música
            const searchResult = await player.search(
              nextTrack.uri || nextTrack.title,
              nextTrack.requester
            );
            
            if (searchResult && searchResult.tracks && searchResult.tracks.length > 0) {
              // Armazena o resultado em cache para uso rápido
              this.preloadCache.set(nextTrack.identifier, searchResult.tracks[0]);
              
              // Mantém o cache pequeno (máximo 20 músicas)
              if (this.preloadCache.size > 20) {
                // Remove o item mais antigo
                const firstKey = this.preloadCache.keys().next().value;
                this.preloadCache.delete(firstKey);
              }
            }
          } catch (error) {
            this.warn(`Failed to preload track: ${error.message}`);
          }
        }
      }
    }
  }


  /**
   * Implements crossfade between tracks
   * @param {EpicPlayer} player - The player instance
   * @param {object} nextTrack - The next track to play
   */
  async doCrossfade(player, nextTrack) {
    if (!player || !nextTrack) return;
    
    try {
      // Salva o volume original
      const originalVolume = player.volume;
      
      // Define a duração do crossfade em ms
      const fadeDuration = this.config.crossfadeDuration;
      const fadeSteps = 10; // Número de passos no fade
      const fadeInterval = fadeDuration / fadeSteps;
      
      // Inicia com um volume mais baixo para a próxima música
      player.setVolume(10); // 10% do volume
      
      // Inicia a próxima música
      player.play(nextTrack);
      
      // Cria o efeito de fade-in para a nova música
      let currentStep = 1;
      const fadeIn = setInterval(() => {
        if (currentStep >= fadeSteps) {
          clearInterval(fadeIn);
          player.setVolume(originalVolume);
        } else {
          // Aumenta o volume gradualmente
          const newVolume = 10 + Math.floor((originalVolume - 10) * (currentStep / fadeSteps));
          player.setVolume(newVolume);
          currentStep++;
        }
      }, fadeInterval);
      
      // Registra a conclusão do crossfade
      this.warn(`Crossfade completed for: ${nextTrack.title}`);
      
    } catch (error) {
      this.warn(`Crossfade error: ${error.message}`);
      // Fallback - reproduz a música normalmente se o crossfade falhar
      player.setVolume(player.options.volume || 100);
      player.play(nextTrack);
    }
  }

/**
 * Clean up resources for a player
 * @param {EpicPlayer} player - The player instance
 */
cleanupPlayer(player) {
  if (!player) return;
  
  // Limpa o intervalo de atualização de progresso
  const progressInterval = player.get("progressInterval");
  if (progressInterval) {
    clearInterval(progressInterval);
    player.set("progressInterval", null);
  }
  
  // Limpa intervalos de crossfade se existirem
  const fadeInterval = player.get("fadeInterval");
  if (fadeInterval) {
    clearInterval(fadeInterval);
    player.set("fadeInterval", null);
  }
  
  // Limpa temporizadores de pré-carregamento
  const preloadTimeout = player.get("preloadTimeout");
  if (preloadTimeout) {
    clearTimeout(preloadTimeout);
    player.set("preloadTimeout", null);
  }
  
  // Clear track timing info
  player.set("trackStartTime", null);
}

  /**
   * Build em
   */
  build() {
    this.warn("Started the bot...");
    this.login(this.config.token);
    this.server = this.config.website?.length ? new Server(this) : null; // constructing also starts it; Do not start server when no website configured
    
    // Inicializar o gerenciador de logs
    this.logManager = new LogManager(this);
    console.log('Log manager initialized');
    
    // Inicializar o sistema de monitoramento do Lavalink
    this.lavalinkMonitor = new LavalinkMonitor(this);
    console.log('Lavalink monitor initialized');
    
    // Configurar limpeza automática do sistema de monitoramento (a cada 1 hora)
    setInterval(() => {
      this.lavalinkMonitor?.cleanup();
    }, 60 * 60 * 1000); // 1 hora
    
    if (this.config.debug === true) {
      this.warn("Debug mode is enabled!");
      this.warn("Only enable this if you know what you are doing!");
      process.on("unhandledRejection", (error) => console.log(error));
      process.on("uncaughtException", (error) => console.log(error));
    } else {
      process.on("unhandledRejection", (error) => {
        return;
      });
      process.on("uncaughtException", (error) => {
        return;
      });
    }

    let client = this;

    /**
     * will hold at most 100 tracks, for the sake of autoqueue
     */
    let playedTracks = [];

    this.manager = new Manager({
      plugins: [
        new deezer(),
        new AppleMusic(),
        new spotify(),
        new facebook(),
        new filters(),
      ],
      autoPlay: true,
      nodes: this.config.nodes,
      retryDelay: this.config.retryDelay,
      retryAmount: this.config.retryAmount,
      clientName: `DiscordMusic/v${require("../package.json").version} (Bot: ${
        this.config.clientId
      })`,
      send: (id, payload) => {
        let guild = client.guilds.cache.get(id);
        if (guild) {
          guild.shard.send(payload);
        }
      },
    })
      .on("nodeConnect", (node) => {
        this.log(
          `Node: ${node.options.identifier} | Lavalink node is connected.`
        );
        // Notificar o sistema de monitoramento
        this.lavalinkMonitor?.handleLavalinkEvent('nodeConnect', node);
      })
      .on("nodeReconnect", (node) => {
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node is reconnecting.`
        );
        // Notificar o sistema de monitoramento
        this.lavalinkMonitor?.handleLavalinkEvent('nodeReconnect', node);
      })
      .on("nodeDestroy", (node) => {
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node is destroyed.`
        );
        // Notificar o sistema de monitoramento
        this.lavalinkMonitor?.handleLavalinkEvent('nodeDestroy', node);
      })
      .on("nodeDisconnect", (node) => {
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node is disconnected.`
        );
        // Notificar o sistema de monitoramento
        this.lavalinkMonitor?.handleLavalinkEvent('nodeDisconnect', node);
      })
      .on("nodeError", (node, err) => {
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node has an error: ${err.message}.`
        );
        // Notificar o sistema de monitoramento
        this.lavalinkMonitor?.handleLavalinkEvent('nodeError', node, err);
      })
      // on track error warn and create embed
      .on("trackError", (player, err) => {
        // Limpar recursos do player
        this.cleanupPlayer(player);
        
        this.warn(
          `Player: ${player.options.guild} | Track had an error: ${err.message}.`
        );
        //console.log(err);
        let song = player.queue.current;
        var title = escapeMarkdown(song.title)
        var title = title.replace(/\]/g,"")
        var title = title.replace(/\[/g,"")
        
        let errorEmbed = new MessageEmbed()
          .setColor("RED")
          .setTitle("Playback error!")
          .setDescription(`Failed to load track: \`${title}\``)
          .setFooter({
            text: "Oops! something went wrong but it's not your fault!",
          });
        client.channels.cache
          .get(player.textChannel)
          .send({ embeds: [errorEmbed] });
      })

      .on("trackStuck", (player, err) => {
        // Limpar recursos do player
        this.cleanupPlayer(player);
        
        this.warn(`Track has an error: ${err.message}`);
        //console.log(err);
        let song = player.queue.current;
        var title = escapeMarkdown(song.title)
        var title = title.replace(/\]/g,"")
        var title = title.replace(/\[/g,"")
        
        let errorEmbed = new MessageEmbed()
          .setColor("RED")
          .setTitle("Track error!")
          .setDescription(`Failed to load track: \`${title}\``)
          .setFooter({
            text: "Oops! something went wrong but it's not your fault!",
          });
        client.channels.cache
          .get(player.textChannel)
          .send({ embeds: [errorEmbed] });
      })
      .on("playerMove", (player, oldChannel, newChannel) => {
        const guild = client.guilds.cache.get(player.guild);
        if (!guild) {
          return;
        }
        const channel = guild.channels.cache.get(player.textChannel);
        if (oldChannel === newChannel) {
          return;
        }
        if (newChannel === null || !newChannel) {
          if (!player) {
            return;
          }
          if (channel) {
            channel.send({
              embeds: [
                new MessageEmbed()
                  .setColor(client.config.embedColor)
                  .setDescription(`Disconnected from <#${oldChannel}>`),
              ],
            });
          }
          return player.destroy();
        } else {
          player.voiceChannel = newChannel;
          setTimeout(() => player.pause(false), 1000);
          return undefined;
        }
      })
      .on("playerCreate", (player) => {
        player.set("twentyFourSeven", client.config.twentyFourSeven);
        player.set("autoQueue", client.config.autoQueue);
        player.set("autoPause", client.config.autoPause);
        player.set("autoLeave", client.config.autoLeave);
        this.warn(
          `Player: ${
            player.options.guild
          } | A wild player has been created in ${
            client.guilds.cache.get(player.options.guild)
              ? client.guilds.cache.get(player.options.guild).name
              : "a guild"
          }`
        );
      })
      .on("playerDestroy", (player) => {
        // Limpar recursos do player
        this.cleanupPlayer(player);
        
        this.warn(
          `Player: ${player.options.guild} | A wild player has been destroyed in ${client.guilds.cache.get(player.options.guild)
              ? client.guilds.cache.get(player.options.guild).name
              : "a guild"
          }`
        )
        player.setNowplayingMessage(client, null);
      })
      // on LOAD_FAILED send error message
      .on("loadFailed", (node, type, error) => {
        this.warn(
          `Node: ${node.options.identifier} | Failed to load ${type}: ${error.message}`
        );
        // Notificar o sistema de monitoramento
        this.lavalinkMonitor?.handleLavalinkEvent('loadFailed', node, error, `Type: ${type}`);
      })
      // on TRACK_START send message
      .on("trackStart", /** @param {EpicPlayer} player */ async (player, track) => {
        // Limpar qualquer intervalo de progresso existente
        this.cleanupPlayer(player);
        
        this.songsPlayed++;
        playedTracks.push(track.identifier);
        if (playedTracks.length >= 100) {
          playedTracks.shift();
        }
      
        this.warn(
          `Player: ${player.options.guild} | Track has been started playing [${colors.blue(track.title)}]`
        );
        
        var title = escapeMarkdown(track.title);
        var title = title.replace(/\]/g,"");
        var title = title.replace(/\[/g,"");
        
        let trackStartedEmbed = this.Embed()
          .setAuthor({ name: "Now playing", iconURL: this.config.iconURL })
          .setDescription(`[${title}](${track.uri})` || "No Descriptions")
          .addFields(
            {
              name: "Requested by",
              value: `${track.requester || `<@${client.user.id}>`}`,
              inline: true,
            },
            {
              name: "Duration",
              value: track.isStream
                ? `\`LIVE\``
                : `\`${prettyMilliseconds(track.duration, {
                    colonNotation: true,
                  })}\``,
              inline: true,
            }
          );
          
        // Adicionar campo de progresso da música com a barra
        if (!track.isStream) {
          // Calcular o tempo exato inicial
          const currentPosition = player.position || 0;
          trackStartedEmbed.addFields({
            name: "Progress",
            value: createProgressBar(currentPosition, track.duration),
            inline: false,
          });
        }
          
        try {
          trackStartedEmbed.setThumbnail(track.displayThumbnail("maxresdefault"));
        } catch (err) {
          trackStartedEmbed.setThumbnail(track.thumbnail);
        }
        
        let nowPlaying = await client.channels.cache
          .get(player.textChannel)
          .send({
            embeds: [trackStartedEmbed],
            components: client.createController(player.options.guild, player),
          })
          .catch(this.warn);
        
        player.setNowplayingMessage(client, nowPlaying);
        
        // Se a música não for stream e tiver duração, agendar o pré-carregamento próximo do final
        if (!track.isStream && track.duration) {
          // Programar o pré-carregamento para a % definida na config da duração da música atual
          const preloadTime = track.duration * this.config.preloadTime;
          const preloadTimeout = setTimeout(() => {
            if (player && player.playing && player.queue.current?.identifier === track.identifier) {
              this.preloadNextTrack(player);
            }
          }, preloadTime);
          
          // Guardar o ID do timeout para limpeza posterior
          player.set("preloadTimeout", preloadTimeout);
        }
          
        // Atualizar a barra de progresso a cada segundo
        if (!track.isStream && nowPlaying) {
          // Store the time when the track started
          const trackStartTime = Date.now() - player.position;
          player.set("trackStartTime", trackStartTime);
          
          // Update progress exactly every second
          const progressInterval = setInterval(async () => {
            if (!player || !player.playing || player.queue.current?.identifier !== track.identifier) {
              clearInterval(progressInterval);
              return;
            }
            
            // Calculate current position based on elapsed time since track started
            // This ensures more accurate timing than relying solely on player.position
            const currentPosition = Date.now() - player.get("trackStartTime");
            
            // Safety check to prevent progress from exceeding track duration
            const displayPosition = Math.min(currentPosition, track.duration);
            
            // Create updated embed with current progress bar
            let updatedEmbed = this.Embed()
              .setAuthor({ name: "Now playing", iconURL: this.config.iconURL })
              .setDescription(`[${title}](${track.uri})` || "No Descriptions")
              .addFields(
                {
                  name: "Requested by",
                  value: `${track.requester || `<@${client.user.id}>`}`,
                  inline: true,
                },
                {
                  name: "Duration",
                  value: track.isStream
                    ? `\`LIVE\``
                    : `\`${prettyMilliseconds(track.duration, {
                        colonNotation: true,
                      })}\``,
                  inline: true,
                },
                {
                  name: "Progress",
                  value: createProgressBar(displayPosition, track.duration),
                  inline: false,
                }
              );
              
            try {
              updatedEmbed.setThumbnail(track.displayThumbnail("maxresdefault"));
            } catch (err) {
              updatedEmbed.setThumbnail(track.thumbnail);
            }
            
            // Update the existing message if still available
            try {
              const message = player.nowPlayingMessage;
              if (message && !this.isMessageDeleted(message)) {
                await message.edit({
                  embeds: [updatedEmbed],
                  components: client.createController(player.options.guild, player),
                }).catch(() => {
                  // If edit fails, mark message as deleted to avoid further attempts
                  this.markMessageAsDeleted(message);
                  clearInterval(progressInterval);
                });
              } else {
                clearInterval(progressInterval);
              }
            } catch (err) {
              clearInterval(progressInterval);
              this.warn(`Error updating progress bar: ${err.message}`);
            }
          }, 1000); // Update exactly every second
          
          // Store the interval ID for cleanup when needed
          player.set("progressInterval", progressInterval);
        }
      })
      
      .on(
        "playerDisconnect",
        /** @param {EpicPlayer} */ async (player) => {
          // Limpar recursos do player
          this.cleanupPlayer(player);
          
          if (player.twentyFourSeven) {
            player.queue.clear();
            player.stop();
            player.set("autoQueue", false);
          } else {
            player.destroy();
          }
        }
      )
      
      .on(
        "queueEnd",
        /** @param {EpicPlayer} */ async (player, track) => {
          // Limpar recursos do player
          this.cleanupPlayer(player);
          
          const autoQueue = player.get("autoQueue");

          if (autoQueue) {
            // Reduzir o tempo de processamento para próxima música
            const requester = player.get("requester");
            const identifier = track.identifier;
            
            // Se já tivermos a próxima música em cache do autoQueue
            let nextTrack = null;
            const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
            
            // Usar Promise.race para aceitar o primeiro resultado com timeout reduzido
            const searchPromise = player.search(search, requester);
            const timeoutPromise = new Promise((resolve) => {
              setTimeout(() => {
                resolve({ tracks: [], exception: { severity: "COMMON", message: "Search timed out" } });
              }, 2000); // Timeout reduzido para 2 segundos
            });
            
            const res = await Promise.race([searchPromise, timeoutPromise]);
            let nextTrackIndex;

            // Encontrar a primeira faixa não reproduzida recentemente
            if (res.tracks && res.tracks.length > 0) {
              res.tracks.some((track, index) => {
                nextTrackIndex = index;
                return !playedTracks.includes(track.identifier);
              });
              
              nextTrack = res.tracks[nextTrackIndex];
            }

            if (!nextTrack || res.exception) {
              client.channels.cache.get(player.textChannel).send({
                embeds: [
                  new MessageEmbed()
                    .setColor("RED")
                    .setAuthor({
                      name: res.exception ? `${res.exception.severity}` : "Error",
                      iconURL: client.config.iconURL,
                    })
                    .setDescription(
                      `Could not load next track.\n**ERR:** ${res.exception ? res.exception.message : "No tracks found"}`
                    ),
                ],
              });
              return player.destroy();
            }

            // Aplicar crossfade se estiver habilitado
            if (this.config.crossfadeDuration > 0) {
              this.doCrossfade(player, nextTrack);
            } else {
              // Adicionar uma pequena pausa para permitir transições mais suaves
              setTimeout(() => {
                if (player && player.connected) {
                  player.play(nextTrack);
                  player.queue.previous = track;
                }
              }, this.config.transitionInterval);
            }
          } else {
            const twentyFourSeven = player.get("twentyFourSeven");

            let queueEmbed = new MessageEmbed()
              .setColor(client.config.embedColor)
              .setAuthor({
                name: "The queue has ended",
                iconURL: client.config.iconURL,
              })
              .setFooter({ text: "Queue ended" })
              .setTimestamp();
            let EndQueue = await client.channels.cache
              .get(player.textChannel)
              .send({ embeds: [queueEmbed] });
            setTimeout(() => EndQueue.delete(true), 5000);
            try {
              if (!player.playing && !twentyFourSeven) {
                setTimeout(async () => {
                  if (!player.playing && player.state !== "DISCONNECTED") {
                    let disconnectedEmbed = new MessageEmbed()
                      .setColor(client.config.embedColor)
                      .setAuthor({
                        name: "Disconnected!",
                        iconURL: client.config.iconURL,
                      })
                      .setDescription(
                        `The player has been disconnected due to inactivity.`
                      );
                    let Disconnected = await client.channels.cache
                      .get(player.textChannel)
                      .send({ embeds: [disconnectedEmbed] });
                    setTimeout(() => Disconnected.delete(true), 30000);
                    player.destroy();
                  } else if (player.playing) {
                    client.warn(
                      `Player: ${player.options.guild} | Still playing`
                    );
                  }
                }, client.config.disconnectTime);
              } else if (!player.playing && twentyFourSeven) {
                client.warn(
                  `Player: ${
                    player.options.guild
                  } | Queue has ended [${colors.blue("24/7 ENABLED")}]`
                );
              } else {
                client.warn(
                  `Something unexpected happened with player ${player.options.guild}`
                );
              }
              player.setNowplayingMessage(client, null);
            } catch (err) {
              client.error(err);
            }
          }
        }
      );
  }

  /**
   * Checks if a message has been deleted during the run time of the Bot
   * @param {Message} message
   * @returns
   */
  isMessageDeleted(message) {
    return this.deletedMessages.has(message);
  }

  /**
   * Marks (adds) a message on the client's `deletedMessages` WeakSet so it's
   * state can be seen through the code
   * @param {Message} message
   */
  markMessageAsDeleted(message) {
    this.deletedMessages.add(message);
  }

  /**
   *
   * @param {string} text
   * @returns {MessageEmbed}
   */
  Embed(text) {
    let embed = new MessageEmbed().setColor(this.config.embedColor);

    if (text) {
      embed.setDescription(text);
    }

    return embed;
  }

  /**
   *
   * @param {string} text
   * @returns {MessageEmbed}
   */
  ErrorEmbed(text) {
    let embed = new MessageEmbed()
      .setColor("RED")
      .setDescription("❌ | " + text);

    return embed;
  }

  LoadEvents() {
    let EventsDir = path.join(__dirname, "..", "events");
    fs.readdir(EventsDir, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          const event = require(EventsDir + "/" + file);
          this.on(file.split(".")[0], event.bind(null, this));
          this.warn("Event Loaded: " + file.split(".")[0]);
        });
      }
    });
  }

  LoadCommands() {
    let SlashCommandsDirectory = path.join(
      __dirname,
      "..",
      "commands",
      "slash"
    );
    fs.readdir(SlashCommandsDirectory, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          let cmd = require(SlashCommandsDirectory + "/" + file);

          if (!cmd || !cmd.run) {
            return this.warn(
              "Unable to load Command: " +
                file.split(".")[0] +
                ", File doesn't have an valid command with run function"
            );
          }
          this.slashCommands.set(file.split(".")[0].toLowerCase(), cmd);
          this.log("Slash Command Loaded: " + file.split(".")[0]);
        });
      }
    });

    let ContextCommandsDirectory = path.join(
      __dirname,
      "..",
      "commands",
      "context"
    );
    fs.readdir(ContextCommandsDirectory, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          let cmd = require(ContextCommandsDirectory + "/" + file);
          if (!cmd.command || !cmd.run) {
            return this.warn(
              "Unable to load Command: " +
                file.split(".")[0] +
                ", File doesn't have either command/run"
            );
          }
          this.contextCommands.set(file.split(".")[0].toLowerCase(), cmd);
          this.log("ContextMenu Loaded: " + file.split(".")[0]);
        });
      }
    });
  }

  /**
   *
   * @param {import("discord.js").TextChannel} textChannel
   * @param {import("discord.js").VoiceChannel} voiceChannel
   */
  createPlayer(textChannel, voiceChannel) {
    return this.manager.create({
      guild: textChannel.guild.id,
      voiceChannel: voiceChannel.id,
      textChannel: textChannel.id,
      selfDeafen: this.config.serverDeafen,
      volume: this.config.defaultVolume,
    });
  }

  createController(guild, player) {
    // Create the first row of buttons (existing controls)
    const row1 = new MessageActionRow().addComponents(
      new MessageButton()
        .setStyle("DANGER")
        .setCustomId(`controller:${guild}:Stop`)
        .setEmoji("⏹️"),

      new MessageButton()
        .setStyle("PRIMARY")
        .setCustomId(`controller:${guild}:Replay`)
        .setEmoji("⏮️"),

      new MessageButton()
        .setStyle(player.playing ? "PRIMARY" : "DANGER")
        .setCustomId(`controller:${guild}:PlayAndPause`)
        .setEmoji(player.playing ? "⏸️" : "▶️"),

      new MessageButton()
        .setStyle("PRIMARY")
        .setCustomId(`controller:${guild}:Next`)
        .setEmoji("⏭️"),

      new MessageButton()
        .setStyle(
          player.trackRepeat
            ? "SUCCESS"
            : player.queueRepeat
            ? "SUCCESS"
            : "DANGER"
        )
        .setCustomId(`controller:${guild}:Loop`)
        .setEmoji(player.trackRepeat ? "🔂" : player.queueRepeat ? "🔁" : "🔁")
    );
    
    // Create a second row of buttons for the new controls
    const row2 = new MessageActionRow().addComponents(
      new MessageButton()
        .setStyle("DANGER")
        .setCustomId(`controller:${guild}:Filters`)
        .setEmoji("🎛️"),
        
      new MessageButton()
        .setStyle("PRIMARY")
        .setCustomId(`controller:${guild}:NowPlaying`)
        .setEmoji("🎵"),
        
      new MessageButton()
        .setStyle("PRIMARY")
        .setCustomId(`controller:${guild}:Queue`)
        .setEmoji("📋"),
        
      new MessageButton()
        .setStyle("PRIMARY")
        .setCustomId(`controller:${guild}:Shuffle`)
        .setEmoji("🔀"),
        
      new MessageButton()
        .setStyle("SUCCESS")
        .setCustomId(`controller:${guild}:Volume`)
        .setEmoji("🔊")
    );

    return [row1, row2];
  }
}

module.exports = DiscordMusicBot;