const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");


const FREE_MODELS = [
    "openai/gpt-4o-mini",
    "deepseek/deepseek-r1-distill-llama-70b:free",
    "deepseek/deepseek-v3-base:free",
    "google/gemini-2.0-flash-exp",
    "deepseek/deepseek-chat-v3-0324:free",
    "x-ai/grok-3-mini-beta",
    "nvidia/llama-3.3-nemotron-super-49b-v1:free",
    "openai/gpt-4.1-nano",
    "google/gemini-2.5-pro-exp-03-25:free"
];

const command = new SlashCommand()
    .setName("model")
    .setDescription("Change the AI model used by the bot")
    .addStringOption((option) =>
        option
            .setName("model")
            .setDescription("The model to use")
            .setRequired(true)
            .addChoices(
                { name: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
                { name: "DeepSeek R1", value: "deepseek/deepseek-r1-distill-llama-70b:free" },
                { name: "DeepSeek V3 Base", value: "deepseek/deepseek-v3-base:free" },
                { name: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash-exp" },
                { name: "DeepSeek Chat V3", value: "deepseek/deepseek-chat-v3-0324:free" },
                { name: "Grok 3", value: "x-ai/grok-3-mini-beta" },
                { name: "NVIDIA: Llama 3.3", value: "nvidia/llama-3.3-nemotron-super-49b-v1:free" },
                { name: "GPT-4.1 nano", value: "openai/gpt-4.1-nano" },
                { name: "Gemini 2.5 Pro", value: "google/gemini-2.5-pro-exp-03-25:free" }
            )
    )
    .setRun(async (client, interaction) => {
        try {
            await interaction.deferReply().catch((_) => {});

            // Check if interaction and options exist
            if (!interaction || !interaction.options) {
                client.error("[MODEL] Invalid interaction or options");
                return interaction.editReply({
                    embeds: [
                        new MessageEmbed()
                            .setColor("RED")
                            .setTitle("❌ Error")
                            .setDescription("An error occurred while processing your request. Please try again.")
                    ]
                });
            }

            const selectedModel = interaction.options.getString("model");

            // Check if the selected model is valid
            if (!selectedModel || !FREE_MODELS.includes(selectedModel)) {
                client.warn(`[MODEL] Invalid model selected by ${interaction.user.tag} (${interaction.user.id})`);
                return interaction.editReply({
                    embeds: [
                        new MessageEmbed()
                            .setColor("RED")
                            .setTitle("❌ Invalid Model")
                            .setDescription("Please select a valid model from the list.")
                    ]
                });
            }

            const oldModel = client.config.model;
            client.config.model = selectedModel;

            client.log(`[MODEL] Model changed from ${oldModel} to ${selectedModel} by ${interaction.user.tag} (${interaction.user.id})`);

            const embed = new MessageEmbed()
                .setColor(client.config.embedColor)
                .setTitle("✅ Model Changed")
                .setDescription(`The AI model has been successfully changed to ${selectedModel.split("/")[1] || selectedModel}`)
                .setFooter({ text: "MINIONS BOT • Powered by AI" });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            client.error(`[MODEL] Error changing model: ${error.message}`);
            
            const embed = new MessageEmbed()
                .setColor("RED")
                .setTitle("❌ Error")
                .setDescription("An error occurred while changing the model. Please try again later.");
            
            try {
                await interaction.editReply({ embeds: [embed] });
            } catch (e) {
                client.error(`[MODEL] Error sending error message: ${e.message}`);
            }
        }
    });

module.exports = command;