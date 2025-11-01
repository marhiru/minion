const axios = require('axios');
const { MessageEmbed } = require('discord.js');

/**
 * Sistema de monitoramento para o Lavalink - Versão Segura
 * Detecta erros de conexão e notifica via webhook
 */
class LavalinkMonitor {
    constructor(client) {
        this.client = client;
        this.config = client.config.lavalinkMonitoring;
        this.lastAlerts = new Map(); // Armazena timestamps dos últimos alertas para cooldown
        this.connectionAttempts = new Map(); // Contador de tentativas de conexão por node
        this.nodeStatus = new Map(); // Status atual de cada node
        
        this.init();
    }

    init() {
        if (!this.config.enabled) {
            this.client.warn('Lavalink monitoring is disabled');
            return;
        }

        this.client.log('Lavalink monitoring system initialized (safe mode)');
        
        // Inicializar status dos nodes
        this.client.config.nodes.forEach(node => {
            this.nodeStatus.set(node.identifier, {
                connected: false,
                lastError: null,
                errorCount: 0,
                lastSeen: Date.now()
            });
        });
    }

    /**
     * Processa eventos de erro do Lavalink
     * @param {string} eventType - Tipo do evento (nodeError, nodeDisconnect, etc.)
     * @param {object} node - Node do Lavalink
     * @param {object} error - Objeto de erro (opcional)
     * @param {string} additionalInfo - Informações adicionais (opcional)
     */
    async handleLavalinkEvent(eventType, node, error = null, additionalInfo = '') {
        if (!this.config.enabled || !this.config.monitorEvents[eventType]) {
            return;
        }

        const nodeId = node?.options?.identifier || 'Unknown Node';
        const now = Date.now();
        
        // Atualizar status do node
        this.updateNodeStatus(nodeId, eventType, error);
        
        // Verificar cooldown para evitar spam
        const lastAlert = this.lastAlerts.get(`${nodeId}_${eventType}`);
        if (lastAlert && (now - lastAlert) < this.config.alertCooldown) {
            return; // Ainda em cooldown
        }

        // Processar diferentes tipos de eventos
        let shouldAlert = false;
        let severity = 'warning';
        
        switch (eventType) {
            case 'nodeError':
                shouldAlert = true;
                severity = 'error';
                this.incrementConnectionAttempts(nodeId);
                break;
                
            case 'nodeDisconnect':
                shouldAlert = true;
                severity = 'warning';
                this.incrementConnectionAttempts(nodeId);
                break;
                
            case 'nodeDestroy':
                shouldAlert = true;
                severity = 'critical';
                break;
                
            case 'loadFailed':
                shouldAlert = this.shouldAlertLoadFailed(nodeId);
                severity = 'warning';
                break;
                
            case 'connectionFailed':
                shouldAlert = true;
                severity = 'error';
                this.incrementConnectionAttempts(nodeId);
                break;
        }

        // Verificar se deve alertar baseado no número de tentativas
        if (shouldAlert && this.shouldAlertBasedOnRetries(nodeId)) {
            await this.sendAlert(eventType, node, error, additionalInfo, severity);
            this.lastAlerts.set(`${nodeId}_${eventType}`, now);
        }
    }

    /**
     * Atualiza o status de um node
     */
    updateNodeStatus(nodeId, eventType, error) {
        const status = this.nodeStatus.get(nodeId) || {
            connected: false,
            lastError: null,
            errorCount: 0,
            lastSeen: Date.now()
        };

        status.lastSeen = Date.now();
        
        switch (eventType) {
            case 'nodeConnect':
                status.connected = true;
                status.errorCount = 0;
                this.connectionAttempts.delete(nodeId); // Reset contador
                break;
                
            case 'nodeDisconnect':
            case 'nodeDestroy':
                status.connected = false;
                break;
                
            case 'nodeError':
            case 'loadFailed':
                status.errorCount++;
                status.lastError = error?.message || 'Unknown error';
                break;
        }

        this.nodeStatus.set(nodeId, status);
    }

    /**
     * Incrementa contador de tentativas de conexão
     */
    incrementConnectionAttempts(nodeId) {
        const attempts = this.connectionAttempts.get(nodeId) || 0;
        this.connectionAttempts.set(nodeId, attempts + 1);
    }

    /**
     * Verifica se deve alertar baseado no número de tentativas
     */
    shouldAlertBasedOnRetries(nodeId) {
        const attempts = this.connectionAttempts.get(nodeId) || 0;
        return attempts >= this.config.maxRetries;
    }

    /**
     * Verifica se deve alertar para falhas de carregamento
     */
    shouldAlertLoadFailed(nodeId) {
        const status = this.nodeStatus.get(nodeId);
        return status && status.errorCount >= 3; // Alertar após 3 falhas consecutivas
    }

    /**
     * Envia alerta via webhook
     */
    async sendAlert(eventType, node, error, additionalInfo, severity) {
        if (!this.config.webhook.url) {
            return; // Webhook não configurado
        }

        try {
            const embed = this.createAlertEmbed(eventType, node, error, additionalInfo, severity);
            
            // Adicionar menção específica para erros críticos
            let content = '';
            if (severity === 'error' || severity === 'critical') {
                // Detectar se é o erro específico de "Unable to connect after 9999 attempts"
                const errorMessage = error?.message || '';
                if (errorMessage.includes('Unable to connect after') && errorMessage.includes('attempts')) {
                    content = `<@852599498323787838> 🚨 **ALERTA CRÍTICO:** O Lavalink não consegue conectar após múltiplas tentativas!`;
                } else {
                    content = `<@852599498323787838> ⚠️ **ERRO DETECTADO:** Problema no sistema Lavalink!`;
                }
            }
            
            const webhookData = {
                content: content,
                username: this.config.webhook.username,
                avatar_url: this.config.webhook.avatar,
                embeds: [embed]
            };

            await axios.post(this.config.webhook.url, webhookData);
            this.client.log(`Alert sent for ${eventType} on node ${node?.options?.identifier}`);
            
        } catch (webhookError) {
            this.client.warn(`Failed to send webhook alert: ${webhookError.message}`);
        }
    }

    /**
     * Cria embed para o alerta
     */
    createAlertEmbed(eventType, node, error, additionalInfo, severity) {
        const nodeId = node?.options?.identifier || 'Unknown Node';
        const nodeHost = node?.options?.host || 'Unknown Host';
        const nodePort = node?.options?.port || 'Unknown Port';
        
        // Cores baseadas na severidade
        const colors = {
            warning: '#FFA500',  // Laranja
            error: '#FF0000',    // Vermelho
            critical: '#8B0000'  // Vermelho escuro
        };

        // Títulos e descrições baseadas no tipo de evento
        const eventInfo = {
            nodeError: {
                title: '🔴 Erro no Node Lavalink',
                description: 'O node Lavalink encontrou um erro durante a operação.'
            },
            nodeDisconnect: {
                title: '⚠️ Node Lavalink Desconectado',
                description: 'A conexão com o node Lavalink foi perdida.'
            },
            nodeDestroy: {
                title: '💥 Node Lavalink Destruído',
                description: 'O node Lavalink foi destruído e precisa ser reiniciado.'
            },
            loadFailed: {
                title: '❌ Falha no Carregamento',
                description: 'O node Lavalink falhou ao carregar recursos.'
            },
            connectionFailed: {
                title: '🚫 Falha na Conexão',
                description: 'Não foi possível estabelecer conexão com o node Lavalink.'
            }
        };

        const info = eventInfo[eventType] || {
            title: '⚠️ Evento Lavalink',
            description: 'Um evento do Lavalink foi detectado.'
        };

        const embed = new MessageEmbed()
            .setTitle(info.title)
            .setDescription(info.description)
            .setColor(colors[severity] || colors.warning)
            .setTimestamp()
            .addField('🖥️ Node', `\`${nodeId}\``, true)
            .addField('🌐 Host', `\`${nodeHost}:${nodePort}\``, true)
            .addField('📊 Severidade', `\`${severity.toUpperCase()}\``, true);

        // Adicionar informações do erro se disponível
        if (error) {
            embed.addField('❗ Erro', `\`\`\`${error.message || error}\`\`\``, false);
        }

        // Adicionar informações adicionais se disponível
        if (additionalInfo) {
            embed.addField('ℹ️ Informações Adicionais', additionalInfo, false);
        }

        // Adicionar estatísticas do node
        const status = this.nodeStatus.get(nodeId);
        if (status) {
            const attempts = this.connectionAttempts.get(nodeId) || 0;
            embed.addField('📈 Estatísticas', 
                `Conectado: ${status.connected ? '✅' : '❌'}\n` +
                `Erros: ${status.errorCount}\n` +
                `Tentativas: ${attempts}/${this.config.maxRetries}`, 
                true
            );
        }

        // Adicionar footer com informações do bot
        embed.setFooter({
            text: `Bot: ${this.client.user?.tag || 'Discord Music Bot'} | Sistema de Monitoramento`,
            iconURL: this.client.user?.displayAvatarURL() || this.config.webhook.avatar
        });

        return embed.toJSON();
    }

    /**
     * Obtém relatório de status de todos os nodes
     */
    getStatusReport() {
        const report = {
            timestamp: Date.now(),
            nodes: [],
            summary: {
                total: 0,
                connected: 0,
                disconnected: 0,
                totalErrors: 0
            }
        };

        this.nodeStatus.forEach((status, nodeId) => {
            const attempts = this.connectionAttempts.get(nodeId) || 0;
            
            report.nodes.push({
                id: nodeId,
                connected: status.connected,
                errorCount: status.errorCount,
                lastError: status.lastError,
                lastSeen: status.lastSeen,
                connectionAttempts: attempts
            });

            report.summary.total++;
            if (status.connected) {
                report.summary.connected++;
            } else {
                report.summary.disconnected++;
            }
            report.summary.totalErrors += status.errorCount;
        });

        return report;
    }

    /**
     * Limpa dados antigos para evitar vazamentos de memória
     */
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas

        // Limpar alertas antigos
        for (const [key, timestamp] of this.lastAlerts.entries()) {
            if (now - timestamp > maxAge) {
                this.lastAlerts.delete(key);
            }
        }

        // Reset contadores de conexão para nodes que estão conectados há mais de 1 hora
        for (const [nodeId, status] of this.nodeStatus.entries()) {
            if (status.connected && (now - status.lastSeen) > 60 * 60 * 1000) {
                this.connectionAttempts.delete(nodeId);
            }
        }
    }
}

module.exports = LavalinkMonitor;
