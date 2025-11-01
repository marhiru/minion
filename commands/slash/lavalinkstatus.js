const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");

const command = new SlashCommand()
  .setName("lavalinkstatus")
  .setDescription("Exibe o status do monitoramento do Lavalink")
  .setRun(async (client, interaction, options) => {
    let channel = client.getChannel(client, interaction);
    if (!channel) return;

    // Verificar se o sistema de monitoramento está ativo
    if (!client.lavalinkMonitor) {
      const embed = new MessageEmbed()
        .setTitle("❌ Sistema de Monitoramento Desabilitado")
        .setDescription("O sistema de monitoramento do Lavalink não está ativo.")
        .setColor("#FF0000")
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Obter relatório de status
    const report = client.lavalinkMonitor.getStatusReport();
    
    // Criar embed principal
    const embed = new MessageEmbed()
      .setTitle("🔍 Status do Monitoramento Lavalink")
      .setDescription("Relatório atual do sistema de monitoramento")
      .setColor("#00FF00")
      .setTimestamp()
      .addField("📊 Resumo", 
        `**Total de Nodes:** ${report.summary.total}\n` +
        `**Conectados:** ${report.summary.connected} ✅\n` +
        `**Desconectados:** ${report.summary.disconnected} ❌\n` +
        `**Total de Erros:** ${report.summary.totalErrors}`, 
        true
      );

    // Adicionar informações de cada node
    if (report.nodes.length > 0) {
      report.nodes.forEach(node => {
        const status = node.connected ? "✅ Conectado" : "❌ Desconectado";
        const lastSeen = new Date(node.lastSeen).toLocaleString('pt-BR');
        
        embed.addField(`🖥️ ${node.id}`, 
          `**Status:** ${status}\n` +
          `**Erros:** ${node.errorCount}\n` +
          `**Tentativas:** ${node.connectionAttempts}\n` +
          `**Última Vez Visto:** ${lastSeen}` +
          (node.lastError ? `\n**Último Erro:** \`${node.lastError}\`` : ''),
          true
        );
      });
    }

    // Adicionar informações de configuração
    const config = client.config.lavalinkMonitoring;
    embed.addField("⚙️ Configurações",
      `**Webhook:** ${config.webhook.url ? "✅ Configurado" : "❌ Não configurado"}\n` +
      `**Max Retries:** ${config.maxRetries}\n` +
      `**Cooldown:** ${config.alertCooldown / 1000}s\n` +
      `**Timeout:** ${config.connectionTimeout / 1000}s`,
      true
    );

    // Adicionar footer
    embed.setFooter({
      text: `Sistema de Monitoramento | Atualizado`,
      iconURL: client.user.displayAvatarURL()
    });

    await interaction.reply({ embeds: [embed] });
  });

module.exports = command;
