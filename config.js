module.exports = {
    helpCmdPerPage: 10, //- Number of commands per page of help command
    lyricsMaxResults: 5, //- Number of results for lyrics command (Do not touch this value if you don't know what you are doing)
    adminId: "852599498323787838", //- Replace UserId with the Discord ID of the admin of the bot
    token: "asdok", //- Bot's Token
    clientId: process.env.clientId || "1200862192669577467", //- ID of the bot
    clientSecret: process.env.clientSecret || "hfsCSMMMq2Y84eiJD_hOk8acG3RL2-Y1", //- Client Secret of the bot
    port: 4200, //- Port of the API and Dashboard
    scopes: ["identify", "guilds", "applications.commands"], //- Discord OAuth2 Scopes
    inviteScopes: ["bot", "applications.commands"], // Invite link scopes
    serverDeafen: true, //- If you want bot to stay deafened
    defaultVolume: 100, //- Sets the default volume of the bot, You can change this number anywhere from 1 to 100
    supportServer: "https://discord.gg/mbqWNRHBrR", //- Support Server Link
    Issues: "https://discord.gg/mbqWNRHBrR", //- Bug Report Link
    permissions: 8, //- Bot Inviting Permissions
    disconnectTime: 300000, //- How long should the bot wait before disconnecting from the voice channel (in miliseconds). Set to 1 for instant disconnect.
    twentyFourSeven: false, //- When set to true, the bot will never disconnect from the voice channel
    autoQueue: false, //- When set to true, related songs will automatically be added to the queue
    autoPause: true, //- When set to true, music will automatically be paused if everyone leaves the voice channel
    autoLeave: true, //- When set to true, the bot will automatically leave when no one is in the voice channel (can be combined with 24/7 to always be in voice channel until everyone leaves; if 24/7 is on disconnectTime will add a disconnect delay after everyone leaves.)
    debug: false, //- Debug mode
    futebolApiKey: "live_ca83f39e735dff3d720c1d4d83d189",
    spotifyID: "3584abd95d3c41e0af208acbd7ca657e",
    spotifySecret: "dfab9be7e5da4ba2a73f60eaf8d8cc45",
    cookieSecret: "Coding", //- Cookie Secret
    website: "https://konbdemo.xyz", //- without the / at the end
    // You need a lavalink server for this bot to work!!!!
    // Lavalink server; public lavalink -> https://lavalink-list.darrennathanael.com/; create one yourself -> https://darrennathanael.com/post/how-to-lavalink
    nodes: [
        {
            identifier: "Main Node", //- Used for indentifier in stats commands.
            host: "lava-v3.ajieblogs.eu.org", //- The host name or IP of the lavalink server.
            port: 80, // The port that lavalink is listening to. This must be a number!
            password: "https://dsc.gg/ajidevserver", //- The password of the lavalink server.
            retryAmount: 9999, //- The amount of times to retry connecting to the node if connection got dropped.
            retryDelay: 1000, //- Delay between reconnect attempts if connection is lost.
            secure: false, //- Can be either true or false. Only use true if ssl is enabled!
        },
    ],
    embedColor: "#2f3136", //- Color of the embeds, hex supported
    presence: {
        // PresenceData object | https://discord.js.org/#/docs/main/stable/typedef/PresenceData
        status: "online", //- You can have online, idle, dnd and invisible (Note: invisible makes people think the bot is offline)
        activities: [
            {
                name: "o nascimento do filho da tigresa vip",
                type: "WATCHING",
                data: (client) => {
                    return {
                        someVariable: client.guilds.cache.size,
                    }
                }
            },
            {
                name: "o ploc ploc do pau entrando",
                type: "LISTENING",
            },
        ],
    },
    iconURL: "https://cdn.darrennathanael.com/icons/spinning_disk.gif", //- This icon will be in every embed's author field
    // Configurações de IA
    openrouterKey: process.env.OPENROUTER_KEY || "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",
    model: "deepseek/deepseek-chat-v3-0324:free", // Modelo padrão de IA
    lyricsApiUid: process.env.LYRICS_API_UID || "13251", // UID da API do Lyrics.com - Obtenha em https://www.lyrics.com/lyrics_api.php
    lyricsApiToken: process.env.LYRICS_API_TOKEN || "HT1CVLiyByfq0huz", // Token da API do Lyrics.com - Obtenha em https://www.lyrics.com/lyrics_api.php

    // Configurações do sistema de monitoramento do Lavalink
    lavalinkMonitoring: {
        enabled: true, // Habilitar monitoramento de erros do Lavalink
        webhook: {
            url: "https://discord.com/api/webhooks/1391839413603926036/1Dt5so3hIre-1iL0sQiFHnbe9pgpAW8Z9de36mhZGftBrSN_G8ERkoTDzcN0D6U6SQAH", // URL do webhook para notificações
            username: "Lavalink Monitor", // Nome de usuário do webhook
            avatar: "https://cdn.darrennathanael.com/icons/spinning_disk.gif", // Avatar do webhook
        },
        // Configurações de retry e alertas
        maxRetries: 2, // Máximo de tentativas de reconexão antes de alertar (reduzido para alertar mais rápido)
        alertCooldown: 180000, // 3 minutos de cooldown entre alertas do mesmo tipo (em ms)
        connectionTimeout: 30000, // Timeout para conexão (30 segundos)
        // Tipos de erros para monitorar
        monitorEvents: {
            nodeError: true, // Erros de node
            nodeDisconnect: true, // Desconexões
            nodeDestroy: true, // Destruição de nodes
            loadFailed: true, // Falhas de carregamento
            connectionFailed: true, // Falhas de conexão
        }
    }
};
