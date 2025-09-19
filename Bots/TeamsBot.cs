using Microsoft.Bot.Builder;
using Microsoft.Bot.Schema;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using VoxRepoAgent.Services;
using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace VoxRepoAgent.Bots
{
    public class TeamsBot : ActivityHandler
    {
        private readonly ILogger<TeamsBot> _logger;
        private readonly IConfiguration _configuration;
        private readonly ISpeechService _speechService;
        private readonly HttpClient _httpClient;
        private readonly string _azureEndpoint;
        private readonly string _agentId;

        public TeamsBot(ILogger<TeamsBot> logger, IConfiguration configuration, ISpeechService speechService, HttpClient httpClient)
        {
            _logger = logger;
            _configuration = configuration;
            _speechService = speechService;
            _httpClient = httpClient;

            // Initialize Azure AI Foundry integration
            _azureEndpoint = _configuration["AZURE_ENDPOINT"] ?? 
                "https://voxrepofoundry.services.ai.azure.com/api/projects/VoxRepoFoundryAI";
            _agentId = _configuration["AGENT_ID"] ?? "asst_2nwCGYhb5MJTLEl5Vfna32SL";
        }

        protected override async Task OnMessageActivityAsync(ITurnContext<IMessageActivity> turnContext, CancellationToken cancellationToken)
        {
            try
            {
                _logger.LogInformation("Processing message activity");

                var messageText = turnContext.Activity.Text ?? string.Empty;
                _logger.LogInformation("Message text: {MessageText}", messageText);

                // Simple echo response for now - you can integrate with Azure OpenAI API here
                var response = await ProcessWithAzureAI(messageText);
                
                await turnContext.SendActivityAsync(MessageFactory.Text(response), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in message activity handler");
                var errorMessage = $"Error processing your message: {ex.Message}";
                await turnContext.SendActivityAsync(MessageFactory.Text(errorMessage), cancellationToken);
            }
        }

        private async Task<string> ProcessWithAzureAI(string input)
        {
            try
            {
                // For now, return a simple response. You can integrate with Azure OpenAI API here
                // using the HttpClient to make REST calls to your Azure AI endpoint
                await Task.Delay(100); // Simulate processing
                return $"I received your message: '{input}'. This is a response from the VoxRepo Agent.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing with Azure AI");
                return "I'm sorry, I encountered an error while processing your request.";
            }
        }

        protected override async Task OnMembersAddedAsync(IList<ChannelAccount> membersAdded, ITurnContext<IConversationUpdateActivity> turnContext, CancellationToken cancellationToken)
        {
            var welcomeText = "Hello and welcome! I'm your VoxRepo Agent assistant.";
            foreach (var member in membersAdded)
            {
                if (member.Id != turnContext.Activity.Recipient.Id)
                {
                    await turnContext.SendActivityAsync(MessageFactory.Text(welcomeText), cancellationToken);
                }
            }
        }

        public async Task HandleSpeechTranscriptionAsync(string transcription, ITurnContext turnContext, CancellationToken cancellationToken = default)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(transcription))
                {
                    return;
                }

                _logger.LogInformation("Processing speech transcription: {Transcription} for user: {UserId}", 
                    transcription, turnContext.Activity.From.Id);

                // Process the transcription and send as a simple response
                var response = await ProcessWithAzureAI(transcription);
                await turnContext.SendActivityAsync(MessageFactory.Text($"Transcription: {transcription}. Response: {response}"), cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling speech transcription: {Transcription}", transcription);
            }
        }

        public async Task<string> TranscribeLocalWavAsync(string? filePath = null)
        {
            try
            {
                var audioFilePath = filePath ?? Path.Combine(Directory.GetCurrentDirectory(), "audio.wav");
                
                if (!File.Exists(audioFilePath))
                {
                    _logger.LogError("Audio file not found: {FilePath}", audioFilePath);
                    return string.Empty;
                }

                var audioBuffer = await File.ReadAllBytesAsync(audioFilePath);
                var text = await _speechService.SpeechToTextAsync(audioBuffer);
                
                _logger.LogInformation("Transcription from WAV file: {Text}", text);
                return text;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error transcribing WAV file");
                return string.Empty;
            }
        }
    }
}