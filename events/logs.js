const { MessageEmbed } = require('discord.js');

// Classe principal para gerenciar logs
class LogManager {
    constructor(client) {
        this.client = client;
        this.database = client.database;

        // Inicializar eventos de log
        this.initLogEvents();
        console.log('Log events initialized');
    }

    // Obter configurações de log para um servidor
    async getGuildLogSettings(guildId) {
        try {
            const logsSettings = await this.database.get("logs") || {};
            let settings = logsSettings[guildId];

            if (!settings) {
                settings = {
                    guildId: guildId,
                    modLogChannel: null,
                    serverLogChannel: null,
                    memberLogChannel: null,
                    messageLogChannel: null,
                    voiceLogChannel: null,
                    profileLogChannel: null,
                    roleLogChannel: null,
                    enabledLogs: ['MOD', 'SERVER', 'MEMBER', 'MESSAGE', 'VOICE']
                };

                logsSettings[guildId] = settings;
                await this.database.set("logs", logsSettings);
            }

            return settings;
        } catch (error) {
            console.error(`Error getting log settings for guild ${guildId}:`, error);
            return null;
        }
    }

    // Atualizar configurações de log para um servidor
    async updateGuildLogSettings(guildId, settings) {
        try {
            const logsSettings = await this.database.get("logs") || {};
            logsSettings[guildId] = settings;
            await this.database.set("logs", logsSettings);
            return true;
        } catch (error) {
            console.error(`Error updating log settings for guild ${guildId}:`, error);
            return false;
        }
    }

    // Enviar log para o canal apropriado
    async sendLog(guildId, logType, embed) {
        try {
            const settings = await this.getGuildLogSettings(guildId);
            if (!settings || !settings.enabledLogs || !settings.enabledLogs.includes(logType)) return;

            let channelId;
            switch (logType) {
                case 'MOD':
                    channelId = settings.modLogChannel;
                    break;
                case 'SERVER':
                    channelId = settings.serverLogChannel;
                    break;
                case 'MEMBER':
                    channelId = settings.memberLogChannel;
                    break;
                case 'MESSAGE':
                    channelId = settings.messageLogChannel;
                    break;
                case 'VOICE':
                    channelId = settings.voiceLogChannel;
                    break;
                case 'PROFILE':
                    channelId = settings.profileLogChannel;
                    break;
                case 'ROLE':
                    channelId = settings.roleLogChannel;
                    break;
                default:
                    return;
            }

            // Se não houver canal específico, tenta usar o canal de mod log
            if (!channelId) {
                channelId = settings.modLogChannel;
            }

            // Se ainda não houver canal, não envia log
            if (!channelId) return;

            const guild = this.client.guilds.cache.get(guildId);
            if (!guild) return;

            const channel = guild.channels.cache.get(channelId);
            if (!channel) return;

            // Adiciona footer com timestamp e tipo de log
            if (!embed.timestamp) {
                embed.setTimestamp();
            }

            if (!embed.footer) {
                embed.setFooter({
                    text: `${logType} Log | ID: ${this.generateLogId()}`,
                    iconURL: guild.iconURL({ dynamic: true })
                });
            }

            await channel.send({ embeds: [embed] });
            return true;
        } catch (error) {
            console.error(`Error sending ${logType} log for guild ${guildId}:`, error);
            return false;
        }
    }

    // Gerar ID único para logs
    generateLogId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Inicializar eventos de log
    initLogEvents() {
        try {
            // Eventos de moderação são tratados diretamente nos comandos

            // Eventos de servidor
            this.client.on('channelCreate', channel => {
                try { this.logChannelCreate(channel); } catch (error) {
                    console.error('Error in channelCreate log:', error);
                }
            });

            this.client.on('channelDelete', channel => {
                try { this.logChannelDelete(channel); } catch (error) {
                    console.error('Error in channelDelete log:', error);
                }
            });

            this.client.on('channelUpdate', (oldChannel, newChannel) => {
                try { this.logChannelUpdate(oldChannel, newChannel); } catch (error) {
                    console.error('Error in channelUpdate log:', error);
                }
            });

            this.client.on('roleCreate', role => {
                try { this.logRoleCreate(role); } catch (error) {
                    console.error('Error in roleCreate log:', error);
                }
            });

            this.client.on('roleDelete', role => {
                try { this.logRoleDelete(role); } catch (error) {
                    console.error('Error in roleDelete log:', error);
                }
            });

            this.client.on('roleUpdate', (oldRole, newRole) => {
                try { this.logRoleUpdate(oldRole, newRole); } catch (error) {
                    console.error('Error in roleUpdate log:', error);
                }
            });

            this.client.on('guildUpdate', (oldGuild, newGuild) => {
                try { this.logGuildUpdate(oldGuild, newGuild); } catch (error) {
                    console.error('Error in guildUpdate log:', error);
                }
            });

            // Eventos de membros
            this.client.on('guildMemberAdd', member => {
                try { this.logMemberJoin(member); } catch (error) {
                    console.error('Error in guildMemberAdd log:', error);
                }
            });

            this.client.on('guildMemberRemove', member => {
                try { this.logMemberLeave(member); } catch (error) {
                    console.error('Error in guildMemberRemove log:', error);
                }
            });

            this.client.on('guildBanAdd', ban => {
                try { this.logMemberBan(ban); } catch (error) {
                    console.error('Error in guildBanAdd log:', error);
                }
            });

            this.client.on('guildBanRemove', ban => {
                try { this.logMemberUnban(ban); } catch (error) {
                    console.error('Error in guildBanRemove log:', error);
                }
            });

            // Eventos de mensagens
            this.client.on('messageDelete', message => {
                try { this.logMessageDelete(message); } catch (error) {
                    console.error('Error in messageDelete log:', error);
                }
            });

            this.client.on('messageUpdate', (oldMessage, newMessage) => {
                try { this.logMessageUpdate(oldMessage, newMessage); } catch (error) {
                    console.error('Error in messageUpdate log:', error);
                }
            });

            this.client.on('messageDeleteBulk', messages => {
                try { this.logMessageBulkDelete(messages); } catch (error) {
                    console.error('Error in messageDeleteBulk log:', error);
                }
            });

            // Eventos de voz
            this.client.on('voiceStateUpdate', (oldState, newState) => {
                try { this.logVoiceStateUpdate(oldState, newState); } catch (error) {
                    console.error('Error in voiceStateUpdate log:', error);
                }
            });

            // Eventos de perfil
            this.client.on('userUpdate', (oldUser, newUser) => {
                try { this.logUserProfileUpdate(oldUser, newUser); } catch (error) {
                    console.error('Error in userUpdate log:', error);
                }
            });

            // Evento de membro com tratamento especial para nickname e roles
            this.client.on('guildMemberUpdate', (oldMember, newMember) => {
                try {
                    // Se o nickname mudou
                    if (oldMember.nickname !== newMember.nickname) {
                        this.logGuildMemberNicknameUpdate(oldMember, newMember);
                    }

                    // Se os cargos mudaram
                    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
                        // Detecta cargos adicionados
                        const addedRoles = newMember.roles.cache.filter(role =>
                            !oldMember.roles.cache.has(role.id)
                        );

                        // Detecta cargos removidos
                        const removedRoles = oldMember.roles.cache.filter(role =>
                            !newMember.roles.cache.has(role.id)
                        );

                        // Loga cada cargo adicionado individualmente
                        addedRoles.forEach(role => {
                            this.logGuildMemberRoleAdd(newMember, role);
                        });

                        // Loga cada cargo removido individualmente
                        removedRoles.forEach(role => {
                            this.logGuildMemberRoleRemove(newMember, role);
                        });
                    }

                    // Chama a função existente para outras mudanças
                    this.logMemberUpdate(oldMember, newMember);
                } catch (error) {
                    console.error('Error in guildMemberUpdate log:', error);
                }
            });

            console.log('Log events initialized successfully');
        } catch (error) {
            console.error('Failed to initialize log events:', error);
        }
    }

    // Métodos de log para cada tipo de evento

    // LOGS DE MODERAÇÃO

    async logModAction(guildId, action, moderator, target, reason, additionalInfo = {}) {
        try {
            const embed = new MessageEmbed()
                .setTitle(`Moderator Action: ${action}`)
                .setColor(this.getActionColor(action))
                .addField('Moderator', `${moderator.tag} (${moderator.id})`, true)
                .setTimestamp();

            if (target) {
                if (typeof target === 'object') {
                    embed.addField('Target', `${target.tag || target.user?.tag || 'Unknown'} (${target.id})`, true);

                    if (target.user && target.user.displayAvatarURL) {
                        embed.setThumbnail(target.user.displayAvatarURL({ dynamic: true }));
                    } else if (target.displayAvatarURL) {
                        embed.setThumbnail(target.displayAvatarURL({ dynamic: true }));
                    }
                } else {
                    embed.addField('Target ID', target, true);
                }
            }

            if (reason) {
                embed.addField('Reason', reason);
            }

            // Adiciona campos adicionais
            for (const [key, value] of Object.entries(additionalInfo)) {
                if (value !== undefined && value !== null) {
                    embed.addField(key, String(value), true);
                }
            }

            return this.sendLog(guildId, 'MOD', embed);
        } catch (error) {
            console.error(`Error in logModAction:`, error);
            return false;
        }
    }

    getActionColor(action) {
        switch (action.toUpperCase()) {
            case 'BAN':
                return '#FF0000'; // Vermelho
            case 'UNBAN':
                return '#00FF00'; // Verde
            case 'KICK':
                return '#FFA500'; // Laranja
            case 'MUTE':
                return '#FFFF00'; // Amarelo
            case 'UNMUTE':
                return '#00FFFF'; // Ciano
            case 'WARN':
                return '#FF00FF'; // Magenta
            case 'TIMEOUT':
                return '#FF7F00'; // Âmbar
            default:
                return '#7289DA'; // Cor padrão do Discord
        }
    }

    // LOGS DE SERVIDOR

    async logChannelCreate(channel) {
        if (!channel.guild) return;

        try {
            const embed = new MessageEmbed()
                .setTitle('Channel Created')
                .setColor('#00FF00')
                .addField('Channel', `${channel.name} (${channel.id})`)
                .addField('Type', this.getChannelType(channel.type));

            if (channel.parent) {
                embed.addField('Category', channel.parent.name);
            }

            return this.sendLog(channel.guild.id, 'SERVER', embed);
        } catch (error) {
            console.error(`Error in logChannelCreate:`, error);
            return false;
        }
    }

    async logChannelDelete(channel) {
        if (!channel.guild) return;

        try {
            const embed = new MessageEmbed()
                .setTitle('Channel Deleted')
                .setColor('#FF0000')
                .addField('Channel', `${channel.name} (${channel.id})`)
                .addField('Type', this.getChannelType(channel.type));

            if (channel.parent) {
                embed.addField('Category', channel.parent.name);
            }

            return this.sendLog(channel.guild.id, 'SERVER', embed);
        } catch (error) {
            console.error(`Error in logChannelDelete:`, error);
            return false;
        }
    }

    async logChannelUpdate(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        try {
            // Ignora se nada importante mudou
            if (oldChannel.name === newChannel.name &&
                oldChannel.type === newChannel.type &&
                oldChannel.parentId === newChannel.parentId) {
                return;
            }

            const embed = new MessageEmbed()
                .setTitle('Channel Updated')
                .setColor('#FFFF00')
                .addField('Channel', `${newChannel.name} (${newChannel.id})`);

            if (oldChannel.name !== newChannel.name) {
                embed.addField('Name Changed', `${oldChannel.name} → ${newChannel.name}`);
            }

            if (oldChannel.type !== newChannel.type) {
                embed.addField('Type Changed', `${this.getChannelType(oldChannel.type)} → ${this.getChannelType(newChannel.type)}`);
            }

            if (oldChannel.parentId !== newChannel.parentId) {
                const oldCategory = oldChannel.parent ? oldChannel.parent.name : 'None';
                const newCategory = newChannel.parent ? newChannel.parent.name : 'None';
                embed.addField('Category Changed', `${oldCategory} → ${newCategory}`);
            }

            return this.sendLog(newChannel.guild.id, 'SERVER', embed);
        } catch (error) {
            console.error(`Error in logChannelUpdate:`, error);
            return false;
        }
    }

    getChannelType(type) {
        switch (type) {
            case 'GUILD_TEXT': return 'Text Channel';
            case 'GUILD_VOICE': return 'Voice Channel';
            case 'GUILD_CATEGORY': return 'Category';
            case 'GUILD_NEWS': return 'Announcement Channel';
            case 'GUILD_STORE': return 'Store Channel';
            case 'GUILD_NEWS_THREAD': return 'News Thread';
            case 'GUILD_PUBLIC_THREAD': return 'Public Thread';
            case 'GUILD_PRIVATE_THREAD': return 'Private Thread';
            case 'GUILD_STAGE_VOICE': return 'Stage Channel';
            default: return 'Unknown';
        }
    }

    async logRoleCreate(role) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Role Created')
                .setColor(role.color || '#00FF00')
                .addField('Role', `${role.name} (${role.id})`)
                .addField('Color', role.hexColor)
                .addField('Hoisted', role.hoist ? 'Yes' : 'No', true)
                .addField('Mentionable', role.mentionable ? 'Yes' : 'No', true)
                .addField('Position', role.position.toString(), true);

            return this.sendLog(role.guild.id, 'SERVER', embed);
        } catch (error) {
            console.error(`Error in logRoleCreate:`, error);
            return false;
        }
    }

    async logRoleDelete(role) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Role Deleted')
                .setColor(role.color || '#FF0000')
                .addField('Role', `${role.name} (${role.id})`)
                .addField('Color', role.hexColor)
                .addField('Hoisted', role.hoist ? 'Yes' : 'No', true)
                .addField('Mentionable', role.mentionable ? 'Yes' : 'No', true)
                .addField('Position', role.position.toString(), true);

            return this.sendLog(role.guild.id, 'SERVER', embed);
        } catch (error) {
            console.error(`Error in logRoleDelete:`, error);
            return false;
        }
    }

    async logRoleUpdate(oldRole, newRole) {
        try {
            // Ignora se nada importante mudou
            if (oldRole.name === newRole.name &&
                oldRole.color === newRole.color &&
                oldRole.hoist === newRole.hoist &&
                oldRole.mentionable === newRole.mentionable) {
                return;
            }

            const embed = new MessageEmbed()
                .setTitle('Role Updated')
                .setColor(newRole.color || '#FFFF00')
                .addField('Role', `${newRole.name} (${newRole.id})`);

            if (oldRole.name !== newRole.name) {
                embed.addField('Name Changed', `${oldRole.name} → ${newRole.name}`);
            }

            if (oldRole.color !== newRole.color) {
                embed.addField('Color Changed', `${oldRole.hexColor} → ${newRole.hexColor}`);
            }

            if (oldRole.hoist !== newRole.hoist) {
                embed.addField('Hoisted Changed', `${oldRole.hoist ? 'Yes' : 'No'} → ${newRole.hoist ? 'Yes' : 'No'}`);
            }

            if (oldRole.mentionable !== newRole.mentionable) {
                embed.addField('Mentionable Changed', `${oldRole.mentionable ? 'Yes' : 'No'} → ${newRole.mentionable ? 'Yes' : 'No'}`);
            }

            return this.sendLog(newRole.guild.id, 'SERVER', embed);
        } catch (error) {
            console.error(`Error in logRoleUpdate:`, error);
            return false;
        }
    }

    async logGuildUpdate(oldGuild, newGuild) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Server Updated')
                .setColor('#FFFF00');

            let changed = false;

            if (oldGuild.name !== newGuild.name) {
                embed.addField('Name Changed', `${oldGuild.name} → ${newGuild.name}`);
                changed = true;
            }

            if (oldGuild.iconURL() !== newGuild.iconURL()) {
                embed.addField('Icon Changed', 'Server icon has been updated');
                embed.setThumbnail(newGuild.iconURL({ dynamic: true }));
                changed = true;
            }

            if (oldGuild.bannerURL() !== newGuild.bannerURL()) {
                embed.addField('Banner Changed', 'Server banner has been updated');
                changed = true;
            }

            if (oldGuild.description !== newGuild.description) {
                const oldDesc = oldGuild.description || 'None';
                const newDesc = newGuild.description || 'None';
                embed.addField('Description Changed', `${oldDesc} → ${newDesc}`);
                changed = true;
            }

            if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
                embed.addField('Verification Level Changed',
                    `${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`);
                changed = true;
            }

            if (!changed) return;

            return this.sendLog(newGuild.id, 'SERVER', embed);
        } catch (error) {
            console.error(`Error in logGuildUpdate:`, error);
            return false;
        }
    }

    // LOGS DE MEMBROS

    async logMemberJoin(member) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Member Joined')
                .setColor('#00FF00')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addField('Member', `${member.user.tag} (${member.id})`)
                .addField('Account Created', `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`);

            return this.sendLog(member.guild.id, 'MEMBER', embed);
        } catch (error) {
            console.error(`Error in logMemberJoin:`, error);
            return false;
        }
    }

    async logMemberLeave(member) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Member Left')
                .setColor('#FF0000')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addField('Member', `${member.user.tag} (${member.id})`)
                .addField('Joined Server', `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`)
                .addField('Roles', member.roles.cache.size > 1
                    ? member.roles.cache.filter(r => r.id !== member.guild.id).map(r => r.name).join(', ')
                    : 'None');

            return this.sendLog(member.guild.id, 'MEMBER', embed);
        } catch (error) {
            console.error(`Error in logMemberLeave:`, error);
            return false;
        }
    }

    async logMemberUpdate(oldMember, newMember) {
        try {
            // Ignora mudanças de nickname e cargos, pois agora temos logs específicos para eles
            // Só continua se houver outras mudanças

            const embed = new MessageEmbed()
                .setTitle('Member Updated')
                .setColor('#FFFF00')
                .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }))
                .addField('Member', `${newMember.user.tag} (${newMember.id})`);

            // Verifica outras mudanças que não sejam nickname ou cargos
            let hasOtherChanges = false;

            // Exemplo: Verificar mudança de status de booster
            if (oldMember.premiumSince !== newMember.premiumSince) {
                if (newMember.premiumSince) {
                    embed.addField('Server Boost', `Started boosting <t:${Math.floor(newMember.premiumSince.getTime() / 1000)}:R>`);
                } else {
                    embed.addField('Server Boost', 'Stopped boosting');
                }
                hasOtherChanges = true;
            }

            // Exemplo: Verificar mudança de status de pendente
            if (oldMember.pending !== newMember.pending) {
                embed.addField('Member Screening', newMember.pending ? 'Now pending' : 'Completed screening');
                hasOtherChanges = true;
            }

            // Adicione aqui outras verificações para mudanças específicas

            // Se não houver outras mudanças, não envia o log
            if (!hasOtherChanges) return;

            return this.sendLog(newMember.guild.id, 'MEMBER', embed);
        } catch (error) {
            console.error(`Error in logMemberUpdate:`, error);
            return false;
        }
    }

    async logMemberBan(ban) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Member Banned')
                .setColor('#FF0000')
                .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
                .addField('Member', `${ban.user.tag} (${ban.user.id})`)
                .addField('Reason', ban.reason || 'No reason provided');

            return this.sendLog(ban.guild.id, 'MEMBER', embed);
        } catch (error) {
            console.error(`Error in logMemberBan:`, error);
            return false;
        }
    }

    async logMemberUnban(ban) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Member Unbanned')
                .setColor('#00FF00')
                .setThumbnail(ban.user.displayAvatarURL({ dynamic: true }))
                .addField('Member', `${ban.user.tag} (${ban.user.id})`);

            return this.sendLog(ban.guild.id, 'MEMBER', embed);
        } catch (error) {
            console.error(`Error in logMemberUnban:`, error);
            return false;
        }
    }

    // LOGS DE MENSAGENS

    async logMessageDelete(message) {
        try {
            // Ignora mensagens de bots e DMs
            if (message.author?.bot || !message.guild) return;

            // Verifica se message.author existe
            if (!message.author) {
                console.log('Message without author detected in delete event');
                return false;
            }

            const embed = new MessageEmbed()
                .setTitle('Message Deleted')
                .setColor('#FF0000')
                .addField('Author', `${message.author} (${message.author.id})`)
                .addField('Channel', `${message.channel.name} (${message.channel.id})`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

            if (message.content) {
                // Limita o conteúdo a 1024 caracteres (limite do Discord para campos)
                const content = message.content.length > 1024
                    ? message.content.substring(0, 1021) + '...'
                    : message.content;

                embed.addField('Content', content);
            }

            if (message.attachments.size > 0) {
                embed.addField('Attachments', message.attachments.map(a => a.name).join(', '));
            }

            return this.sendLog(message.guild.id, 'MESSAGE', embed);
        } catch (error) {
            console.error(`Error in logMessageDelete:`, error);
            return false;
        }
    }

    async logMessageUpdate(oldMessage, newMessage) {
        try {
            // Ignora mensagens de bots, DMs e se o conteúdo não mudou
            if (newMessage.author?.bot || !newMessage.guild || oldMessage.content === newMessage.content) return;

            const embed = new MessageEmbed()
                .setTitle('Message Edited')
                .setColor('#FFFF00')
                .addField('Author', `${newMessage.author.tag} (${newMessage.author.id})`)
                .addField('Channel', `${newMessage.channel.name} (${newMessage.channel.id})`)
                .addField('Jump to Message', `[Click Here](${newMessage.url})`)
                .setThumbnail(newMessage.author.displayAvatarURL({ dynamic: true }));

            if (oldMessage.content) {
                // Limita o conteúdo a 1024 caracteres
                const content = oldMessage.content.length > 1024
                    ? oldMessage.content.substring(0, 1021) + '...'
                    : oldMessage.content;

                embed.addField('Before', content);
            }

            if (newMessage.content) {
                // Limita o conteúdo a 1024 caracteres
                const content = newMessage.content.length > 1024
                    ? newMessage.content.substring(0, 1021) + '...'
                    : newMessage.content;

                embed.addField('After', content);
            }

            return this.sendLog(newMessage.guild.id, 'MESSAGE', embed);
        } catch (error) {
            console.error(`Error in logMessageUpdate:`, error);
            return false;
        }
    }

    async logMessageBulkDelete(messages) {
        try {
            if (!messages.first() || !messages.first().guild) return;

            const embed = new MessageEmbed()
                .setTitle('Bulk Messages Deleted')
                .setColor('#FF0000')
                .addField('Channel', `${messages.first().channel.name} (${messages.first().channel.id})`)
                .addField('Count', messages.size.toString());

            return this.sendLog(messages.first().guild.id, 'MESSAGE', embed);
        } catch (error) {
            console.error(`Error in logMessageBulkDelete:`, error);
            return false;
        }
    }

    // LOGS DE VOZ

    async logVoiceStateUpdate(oldState, newState) {
        try {
            if (!oldState.guild && !newState.guild) return;

            const guildId = (oldState.guild || newState.guild).id;
            const member = newState.member || oldState.member;

            if (!member) return;

            // Membro entrou em um canal de voz
            if (!oldState.channel && newState.channel) {
                const embed = new MessageEmbed()
                    .setTitle('Member Joined Voice Channel')
                    .setColor('#00FF00')
                    .addField('Member', `${member.user.tag} (${member.id})`)
                    .addField('Channel', `${newState.channel.name} (${newState.channel.id})`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

                return this.sendLog(guildId, 'VOICE', embed);
            }

            // Membro saiu de um canal de voz
            if (oldState.channel && !newState.channel) {
                const embed = new MessageEmbed()
                    .setTitle('Member Left Voice Channel')
                    .setColor('#FF0000')
                    .addField('Member', `${member.user.tag} (${member.id})`)
                    .addField('Channel', `${oldState.channel.name} (${oldState.channel.id})`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

                return this.sendLog(guildId, 'VOICE', embed);
            }

            // Membro mudou de canal de voz
            if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
                const embed = new MessageEmbed()
                    .setTitle('Member Moved Voice Channels')
                    .setColor('#FFFF00')
                    .addField('Member', `${member.user.tag} (${member.id})`)
                    .addField('From', `${oldState.channel.name} (${oldState.channel.id})`)
                    .addField('To', `${newState.channel.name} (${newState.channel.id})`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

                return this.sendLog(guildId, 'VOICE', embed);
            }

            // Membro foi silenciado/dessilenciado pelo servidor
            if (oldState.serverMute !== newState.serverMute) {
                const embed = new MessageEmbed()
                    .setTitle(newState.serverMute ? 'Member Server Muted' : 'Member Server Unmuted')
                    .setColor(newState.serverMute ? '#FF0000' : '#00FF00')
                    .addField('Member', `${member.user.tag} (${member.id})`)
                    .addField('Channel', `${newState.channel.name} (${newState.channel.id})`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

                return this.sendLog(guildId, 'VOICE', embed);
            }

            // Membro foi ensurdecido/desensurdecido pelo servidor
            if (oldState.serverDeaf !== newState.serverDeaf) {
                const embed = new MessageEmbed()
                    .setTitle(newState.serverDeaf ? 'Member Server Deafened' : 'Member Server Undeafened')
                    .setColor(newState.serverDeaf ? '#FF0000' : '#00FF00')
                    .addField('Member', `${member.user.tag} (${member.id})`)
                    .addField('Channel', `${newState.channel.name} (${newState.channel.id})`)
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

                return this.sendLog(guildId, 'VOICE', embed);
            }
        } catch (error) {
            console.error(`Error in logVoiceStateUpdate:`, error);
            return false;
        }
    }

    // LOGS DE MUDANÇAS DE PERFIL

    async logUserProfileUpdate(oldUser, newUser) {
        try {
            // Lista de todos os servidores onde o usuário está presente
            const mutualGuilds = newUser.client.guilds.cache.filter(guild =>
                guild.members.cache.has(newUser.id)
            );

            // Se não estiver em nenhum servidor, não faz nada
            if (mutualGuilds.size === 0) return;

            // Verifica se algo importante mudou
            if (oldUser.username === newUser.username &&
                oldUser.discriminator === newUser.discriminator &&
                oldUser.avatar === newUser.avatar &&
                oldUser.banner === newUser.banner) {
                return;
            }

            // Cria o embed base
            const embed = new MessageEmbed()
                .setTitle('User Profile Updated')
                .setColor('#9B59B6') // Roxo
                .addField('User', `${newUser.tag} (${newUser.id})`)
                .setThumbnail(newUser.displayAvatarURL({ dynamic: true }));

            // Verifica mudanças específicas
            if (oldUser.username !== newUser.username || oldUser.discriminator !== newUser.discriminator) {
                embed.addField('Username Changed', `${oldUser.tag} → ${newUser.tag}`);
            }

            if (oldUser.avatar !== newUser.avatar) {
                embed.addField('Avatar Changed', 'User changed their profile picture');
                // Adiciona imagem antiga como thumbnail se disponível
                if (oldUser.avatarURL()) {
                    embed.setThumbnail(newUser.displayAvatarURL({ dynamic: true }));
                    embed.setImage(oldUser.displayAvatarURL({ dynamic: true }));
                }
            }

            if (oldUser.banner !== newUser.banner) {
                embed.addField('Banner Changed', 'User changed their profile banner');
            }

            // Envia logs para cada servidor que o usuário está
            for (const [guildId, guild] of mutualGuilds) {
                await this.sendLog(guildId, 'PROFILE', embed);
            }
        } catch (error) {
            console.error(`Error in logUserProfileUpdate:`, error);
            return false;
        }
    }

    async logGuildMemberNicknameUpdate(oldMember, newMember) {
        try {
            // Ignora se o nickname não mudou
            if (oldMember.nickname === newMember.nickname) return;

            const oldNick = oldMember.nickname || 'None';
            const newNick = newMember.nickname || 'None';

            const embed = new MessageEmbed()
                .setTitle('Member Nickname Changed')
                .setColor('#3498DB') // Azul
                .addField('Member', `${newMember.user.tag} (${newMember.user.id})`)
                .addField('Old Nickname', oldNick)
                .addField('New Nickname', newNick)
                .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true }));

            return this.sendLog(newMember.guild.id, 'MEMBER', embed);
        } catch (error) {
            console.error(`Error in logGuildMemberNicknameUpdate:`, error);
            return false;
        }
    }

    async logGuildMemberRoleAdd(member, role) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Member Role Added')
                .setColor(role.color || '#2ECC71') // Verde
                .addField('Member', `${member.user.tag} (${member.user.id})`)
                .addField('Role', `${role.name} (${role.id})`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

            return this.sendLog(member.guild.id, 'ROLE', embed);
        } catch (error) {
            console.error(`Error in logGuildMemberRoleAdd:`, error);
            return false;
        }
    }

    async logGuildMemberRoleRemove(member, role) {
        try {
            const embed = new MessageEmbed()
                .setTitle('Member Role Removed')
                .setColor(role.color || '#E74C3C') // Vermelho
                .addField('Member', `${member.user.tag} (${member.user.id})`)
                .addField('Role', `${role.name} (${role.id})`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

            return this.sendLog(member.guild.id, 'ROLE', embed);
        } catch (error) {
            console.error(`Error in logGuildMemberRoleRemove:`, error);
            return false;
        }
    }
}

module.exports = LogManager;
