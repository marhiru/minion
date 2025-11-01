const SlashCommand = require("../../lib/SlashCommand");
const { 
    MessageEmbed, 
    MessageActionRow, 
    MessageButton
} = require("discord.js");
const fetch = require("node-fetch");
const moment = require("moment");

// IDs dos campeonatos brasileiros mais populares (baseados nos IDs da ESPN)
const BRAZILIAN_LEAGUES = {
    "bra.1": "Brasileirão Série A",
    "bra.2": "Brasileirão Série B",
    "bra.copa": "Copa do Brasil",
    "bra.3": "Brasileirão Série C",
    "bra.4": "Brasileirão Série D",
    "bra.sp": "Campeonato Paulista",
    "bra.rj": "Campeonato Carioca",
    "bra.mg": "Campeonato Mineiro",
    "bra.rs": "Campeonato Gaúcho"
};

// Principais ligas internacionais
const MAJOR_LEAGUES = {
    "eng.1": "Premier League",
    "esp.1": "La Liga",
    "ita.1": "Serie A",
    "ger.1": "Bundesliga",
    "fra.1": "Ligue 1",
    "uefa.champions": "Champions League",
    "uefa.europa": "Europa League",
    "mex.1": "Liga MX",
    "arg.1": "Primera División",
    "usa.1": "MLS"
};

// Combina todas as ligas para opções do comando
const ALL_LEAGUES = {
    ...BRAZILIAN_LEAGUES,
    ...MAJOR_LEAGUES
};

const command = new SlashCommand()
    .setName("matches")
    .setDescription("Mostra partidas de futebol com detalhes (EM TESTE!!!!!!!!!!!)")
    .addStringOption(option => 
        option
            .setName("date")
            .setDescription("Data para verificar partidas (formato YYYY-MM-DD). Padrão: hoje")
            .setRequired(false)
    )
    .addStringOption(option => 
        option
            .setName("team")
            .setDescription("Nome do time para ver jogos dos próximos 14 dias")
            .setRequired(false)
    )
    .setRun(async (client, interaction) => {
        await interaction.deferReply();
        
        // Verifica se um time foi especificado
        const teamName = interaction.options.getString("team");
        
        // Obtém a data dos parâmetros ou usa a data atual
        const dateParam = interaction.options.getString("date");
        let date = dateParam ? dateParam : moment().format("YYYY-MM-DD");
        
        // Se tiver time especificado, ignora a data e busca jogos futuros
        if (teamName) {
            try {
                // Busca jogos dos próximos 14 dias
                const matches = await fetchTeamMatches(teamName);
                
                if (!matches || matches.length === 0) {
                    return interaction.editReply(`Nenhuma partida encontrada para ${teamName} nos próximos 14 dias.`);
                }
                
                // Cria um único embed com todos os jogos do time
                const embed = createTeamGamesEmbed(matches, teamName);
                
                // Envia o embed
                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error("Error fetching team matches:", error);
                return interaction.editReply("❌ Ocorreu um erro ao buscar os jogos do time. Por favor, tente novamente mais tarde.");
            }
        } else {
            // Fluxo normal - busca jogos de uma data específica
            
            // Verifica se a data está no formato correto
            if (!moment(date, "YYYY-MM-DD", true).isValid()) {
                return interaction.editReply("⚠️ Formato de data inválido. Por favor, use o formato YYYY-MM-DD.");
            }
            
            try {
                // Busca os jogos da API
                let matches = await fetchMatches(date);
                
                if (!matches || matches.length === 0) {
                    return interaction.editReply(`Nenhuma partida encontrada para ${date}.`);
                }
                
                // Cria um único embed com todos os jogos destacados
                const embed = createDailyGamesEmbed(matches, date);
                
                // Envia o embed
                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error("Error fetching matches:", error);
                return interaction.editReply("❌ Ocorreu um erro ao buscar dados das partidas. Por favor, tente novamente mais tarde.");
            }
        }
    });

// Função para buscar os jogos de um time específico para os próximos 14 dias
async function fetchTeamMatches(teamName) {
    try {
        const results = [];
        // Busca jogos para os próximos 14 dias
        const today = moment();
        
        for (let i = 0; i < 14; i++) {
            const date = moment(today).add(i, 'days').format("YYYYMMDD");
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${date}`);
            const data = await response.json();
            
            if (data.events && data.events.length > 0) {
                // Filtra jogos que incluem o time especificado
                const teamMatches = data.events.filter(match => {
                    if (!match.competitions || !match.competitions[0] || !match.competitions[0].competitors) {
                        return false;
                    }
                    
                    const competitors = match.competitions[0].competitors;
                    return competitors.some(competitor => {
                        const team = competitor.team;
                        if (!team || !team.displayName) return false;
                        
                        // Verifica se o nome do time contém o texto buscado (case insensitive)
                        return team.displayName.toLowerCase().includes(teamName.toLowerCase());
                    });
                });
                
                results.push(...teamMatches);
            }
        }
        
        return results;
    } catch (error) {
        console.error("Error fetching team matches:", error);
        throw error;
    }
}

// Função para criar embed com todos os jogos do time
function createTeamGamesEmbed(matches, teamName) {
    // Ordena os jogos por data
    matches.sort((a, b) => moment(a.date).valueOf() - moment(b.date).valueOf());
    
    // Título da embed
    const title = `⚽ Próximos jogos de ${teamName}`;
    
    // Cria a embed
    const embed = new MessageEmbed()
        .setTitle(title)
        .setColor("#3498DB")
        .setDescription(`Mostrando ${Math.min(matches.length, 25)} partidas dos próximos 14 dias.`)
        .setFooter({ text: `Dados da ESPN • Atualizado em ${moment().format("DD/MM/YYYY HH:mm")}` })
        .setTimestamp();
    
    // Adiciona até 25 jogos (limite do Discord)
    matches.slice(0, 25).forEach(match => {
        const competition = match.competitions[0];
        if (!competition) return;
        
        const homeTeam = competition.competitors.find(c => c.homeAway === "home");
        const awayTeam = competition.competitors.find(c => c.homeAway === "away");
        
        if (!homeTeam || !awayTeam) return;
        
        // Formata a data e hora do jogo
        const matchDate = moment(match.date);
        const formattedDate = matchDate.format("DD/MM");
        const matchTime = matchDate.format("HH:mm");
        
        // Formata o status do jogo
        let status = "Não Iniciado";
        let statusDetail = "";
        
        if (match.status) {
            if (match.status.type) {
                const statusType = match.status.type.name;
                if (statusType === "STATUS_SCHEDULED") status = "Não Iniciado";
                else if (statusType === "STATUS_IN_PROGRESS") status = "Ao Vivo";
                else if (statusType === "STATUS_HALFTIME") status = "Intervalo";
                else if (statusType === "STATUS_FINAL") status = "Encerrado";
                else if (statusType === "STATUS_POSTPONED") status = "Adiado";
                else if (statusType === "STATUS_CANCELED") status = "Cancelado";
                else status = statusType.replace("STATUS_", "");
            }
            
            if (match.status.displayClock) {
                statusDetail = match.status.displayClock;
            }
        }
        
        // Destaca o time buscado (em negrito)
        const homeTeamName = homeTeam.team.displayName.toLowerCase().includes(teamName.toLowerCase()) ? 
            `**${homeTeam.team.displayName}**` : homeTeam.team.displayName;
            
        const awayTeamName = awayTeam.team.displayName.toLowerCase().includes(teamName.toLowerCase()) ? 
            `**${awayTeam.team.displayName}**` : awayTeam.team.displayName;
        
        // Obtém o placar
        const homeScore = homeTeam.score !== undefined ? homeTeam.score : "";
        const awayScore = awayTeam.score !== undefined ? awayTeam.score : "";
        
        // Cria o texto do campo
        const scoreText = homeScore !== "" && awayScore !== ""
            ? `${homeScore} - ${awayScore}`
            : "vs";
            
        // Informações da liga
        const leagueName = competition.competition?.name || "Desconhecida";
        
        // Informações adicionais
        let statusText = status;
        if (statusDetail && status === "Ao Vivo") {
            statusText = `${status} (${statusDetail})`;
        }
        
        // Título do campo com data e hora
        const fieldTitle = `📅 ${formattedDate} às ${matchTime} - ${statusText}`;
        
        // Valor do campo com detalhes do jogo
        const fieldValue = `${homeTeamName} ${scoreText} ${awayTeamName}\n🏆 ${leagueName}`;
        
        embed.addField(fieldTitle, fieldValue);
    });
    
    return embed;
}

// Função para criar embed com todos os jogos de um dia
function createDailyGamesEmbed(matches, date) {
    // Formata a data para exibição
    const formattedDate = moment(date).format("DD/MM/YYYY");
    
    // Título da embed
    const title = `⚽ Partidas de ${formattedDate}`;
    
    // Filtra os jogos mais interessantes
    // Limitado a 25 partidas (limite do Discord) - prioriza jogos ao vivo e ligas principais
    const prioritizedMatches = prioritizeMatches(matches).slice(0, 25);
    
    // Cria a embed
    const embed = new MessageEmbed()
        .setTitle(title)
        .setColor("#3498DB")
        .setDescription(`Mostrando ${prioritizedMatches.length} das ${matches.length} partidas do dia.`)
        .setFooter({ text: `Dados da ESPN • Atualizado em ${moment().format("HH:mm")}` })
        .setTimestamp();
    
    // Adiciona os jogos à embed
    prioritizedMatches.forEach(match => {
        const competition = match.competitions[0];
        if (!competition) return;
        
        const homeTeam = competition.competitors.find(c => c.homeAway === "home");
        const awayTeam = competition.competitors.find(c => c.homeAway === "away");
        
        if (!homeTeam || !awayTeam) return;
        
        // Formata o status do jogo
        let status = "Não Iniciado";
        let statusDetail = "";
        let statusEmoji = "⏱️";
        
        if (match.status) {
            if (match.status.type) {
                const statusType = match.status.type.name;
                if (statusType === "STATUS_SCHEDULED") {
                    status = "Não Iniciado";
                    statusEmoji = "⏱️";
                }
                else if (statusType === "STATUS_IN_PROGRESS") {
                    status = "Ao Vivo";
                    statusEmoji = "🔴";
                }
                else if (statusType === "STATUS_HALFTIME") {
                    status = "Intervalo";
                    statusEmoji = "🕑";
                }
                else if (statusType === "STATUS_FINAL") {
                    status = "Encerrado";
                    statusEmoji = "✅";
                }
                else if (statusType === "STATUS_POSTPONED") {
                    status = "Adiado";
                    statusEmoji = "⚠️";
                }
                else if (statusType === "STATUS_CANCELED") {
                    status = "Cancelado";
                    statusEmoji = "❌";
                }
                else status = statusType.replace("STATUS_", "");
            }
            
            if (match.status.displayClock) {
                statusDetail = match.status.displayClock;
            }
        }
        
        // Formata o horário do jogo
        const matchTime = moment(match.date).format("HH:mm");
        
        // Obtém o placar
        const homeScore = homeTeam.score !== undefined ? homeTeam.score : "";
        const awayScore = awayTeam.score !== undefined ? awayTeam.score : "";
        
        // Cria o texto do campo
        const scoreText = homeScore !== "" && awayScore !== ""
            ? `${homeScore} - ${awayScore}`
            : "vs";
            
        // Informações da liga
        const leagueName = competition.competition?.name || "Desconhecida";
        
        // Informações adicionais
        let statusText = status;
        if (statusDetail && status === "Ao Vivo") {
            statusText = `${status} (${statusDetail})`;
        }
        
        // Título do campo com horário e status
        const fieldTitle = `${statusEmoji} ${matchTime} - ${leagueName}`;
        
        // Valor do campo com detalhes do jogo
        const fieldValue = `${homeTeam.team.displayName} ${scoreText} ${awayTeam.team.displayName}\n${statusText}`;
        
        embed.addField(fieldTitle, fieldValue);
    });
    
    return embed;
}

// Função para priorizar partidas mais interessantes
function prioritizeMatches(matches) {
    // Clone array para não modificar o original
    const sortedMatches = [...matches];
    
    // Função para calcular pontuação de interesse
    const getMatchScore = (match) => {
        let score = 0;
        
        // Status do jogo
        if (match.status && match.status.type) {
            const statusType = match.status.type.name;
            if (statusType === "STATUS_IN_PROGRESS") score += 50; // Jogos ao vivo são prioridade
            else if (statusType === "STATUS_HALFTIME") score += 40;
            else if (statusType === "STATUS_FINAL") score += 20;
            else if (statusType === "STATUS_SCHEDULED") score += 30; // Jogos que ainda vão acontecer
            else score += 10;
        }
        
        // Liga
        if (match.competitions && match.competitions[0] && match.competitions[0].competition) {
            const competition = match.competitions[0].competition;
            const leagueName = competition.name?.toLowerCase() || "";
            
            // Prioriza ligas principais
            if (leagueName.includes("champions") || leagueName.includes("copa libertadores")) score += 40;
            else if (leagueName.includes("premier league") || leagueName.includes("la liga") || 
                    leagueName.includes("serie a") || leagueName.includes("bundesliga") ||
                    leagueName.includes("brasileirão") || leagueName.includes("copa do brasil")) score += 30;
            else if (leagueName.includes("europa") || leagueName.includes("copa sul-americana")) score += 25;
            else score += 10;
        }
        
        return score;
    };
    
    // Ordena os jogos pela pontuação de interesse
    return sortedMatches.sort((a, b) => getMatchScore(b) - getMatchScore(a));
}

// Função para buscar os jogos da API
async function fetchMatches(date) {
    try {
        // Usa a API ESPN
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard?dates=${date.replace(/-/g, '')}`);
        
        const data = await response.json();
        
        if (!data.events) {
            console.error("Invalid API response:", data);
            return [];
        }
        
        return data.events;
    } catch (error) {
        console.error("Error fetching matches from API:", error);
        throw error;
    }
}

module.exports = command;