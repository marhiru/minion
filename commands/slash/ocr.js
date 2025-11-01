const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");
const axios = require("axios"); // You'll need to install this: npm install axios
const FormData = require("form-data"); // You'll need to install this: npm install form-data

const command = new SlashCommand()
	.setName("ocr")
	.setDescription("Extract text from an image")
	.addAttachmentOption((option) =>
		option
			.setName("image")
			.setDescription("The image to extract text from")
			.setRequired(false)
	)
	.addStringOption((option) =>
		option
			.setName("url")
			.setDescription("URL of the image to extract text from")
			.setRequired(false)
	)
	.setRun(async (client, interaction) => {
		// Get the image from attachment or URL
		const attachment = interaction.options.getAttachment("image");
		const url = interaction.options.getString("url");
		
		// Check if at least one option is provided
		if (!attachment && !url) {
			return interaction.reply({
				content: "Please provide either an image attachment or an image URL.",
				ephemeral: true
			});
		}
		
		// Get the image URL
		const imageUrl = attachment ? attachment.url : url;
		
		// Check if the file is an image
		const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
		if (attachment && !validImageTypes.includes(attachment.contentType)) {
			return interaction.reply({
				content: "The attached file is not a valid image. Please upload a JPEG, PNG, GIF, or WEBP image.",
				ephemeral: true
			});
		}
		
		// Defer the reply as OCR might take some time
		await interaction.deferReply();
		
		try {
			// Create form data for the OCR API
			const formData = new FormData();
			formData.append("url", imageUrl);
			formData.append("language", "eng"); // English language
			formData.append("isOverlayRequired", "false");
			
			// Make request to OCR API (using OCR.space API - you need to get an API key)
			// You can get a free API key from https://ocr.space/OCRAPI
			const response = await axios.post("https://api.ocr.space/parse/image", formData, {
				headers: {
					...formData.getHeaders(),
					"apikey": "K85067954988957" // Replace with your actual API key
				}
			});
			
			// Check if the OCR was successful
			if (response.data.IsErroredOnProcessing) {
				return interaction.editReply({
					content: `Error processing the image: ${response.data.ErrorMessage[0]}`,
					ephemeral: true
				});
			}
			
			// Get the extracted text
			const extractedText = response.data.ParsedResults[0].ParsedText.trim();
			
			if (!extractedText) {
				return interaction.editReply("No text could be extracted from the image.");
			}
			
			// Create embed with the extracted text
			const ocrEmbed = new MessageEmbed()
				.setTitle("OCR Results")
				.setColor(client.config.embedColor)
				.setDescription(extractedText.length > 4000 ? extractedText.substring(0, 4000) + "..." : extractedText)
				.setThumbnail(imageUrl)
				.setFooter({ text: `Requested by ${interaction.user.tag}` })
				.setTimestamp();
			
			return interaction.editReply({ embeds: [ocrEmbed] });
		} catch (error) {
			console.error(error);
			return interaction.editReply({
				content: `An error occurred while processing the image: ${error.message}`,
				ephemeral: true
			});
		}
	});

module.exports = command;