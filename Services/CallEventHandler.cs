using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Graph;
using Microsoft.Graph.Auth;
using Microsoft.Graph.Communications.Calls;
using System.Text.Json;

namespace VoxRepoAgent.Services
{
    public class CallEventHandler : ICallEventHandler
    {
        private readonly ILogger<CallEventHandler> _logger;
        private readonly IConfiguration _configuration;
        private readonly ISpeechService _speechService;

        public CallEventHandler(ILogger<CallEventHandler> logger, IConfiguration configuration, ISpeechService speechService)
        {
            _logger = logger;
            _configuration = configuration;
            _speechService = speechService;
        }

        public async Task HandleCallEventAsync(JsonElement requestBody)
        {
            _logger.LogInformation("Received call event: {RequestBody}", requestBody.ToString());

            if (requestBody.TryGetProperty("value", out var valueElement) && valueElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var notification in valueElement.EnumerateArray())
                {
                    await ProcessCallNotificationAsync(notification);
                }
            }
        }

        private async Task ProcessCallNotificationAsync(JsonElement notification)
        {
            try
            {
                if (!notification.TryGetProperty("resourceData", out var callElement))
                {
                    return;
                }

                if (!notification.TryGetProperty("changeType", out var changeTypeElement))
                {
                    return;
                }

                var changeType = changeTypeElement.GetString();
                
                if (!callElement.TryGetProperty("state", out var stateElement))
                {
                    return;
                }

                var state = stateElement.GetString();
                
                if (!callElement.TryGetProperty("id", out var idElement))
                {
                    return;
                }

                var callId = idElement.GetString();

                if (state == "incoming" && changeType == "created")
                {
                    _logger.LogInformation("Incoming call detected with id: {CallId}", callId);

                    if (callElement.TryGetProperty("tenantId", out var tenantIdElement))
                    {
                        var tenantId = tenantIdElement.GetString();
                        await HandleIncomingCallAsync(callId!, tenantId!);
                    }
                }
                else
                {
                    _logger.LogInformation("Unhandled call state: {State}, changeType: {ChangeType}", state, changeType);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing call notification");
            }
        }

        private async Task HandleIncomingCallAsync(string callId, string tenantId)
        {
            try
            {
                var accessToken = await GetAccessTokenAsync(tenantId);
                var botCallbackUri = _configuration["BOT_CALLBACK_URI"] ?? 
                    "https://voxrepobot-f9e6b8a2dva9b4ex.canadacentral-01.azurewebsites.net/calling/callback";

                await AnswerCallAsync(callId, botCallbackUri, accessToken);
                _logger.LogInformation("Call {CallId} answered", callId);

                // Process local audio file for testing
                await ProcessLocalAudioFileAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling incoming call: {CallId}", callId);
            }
        }

        private async Task<string> GetAccessTokenAsync(string tenantId)
        {
            var clientId = _configuration["clientId"] ?? _configuration["MicrosoftAppId"];
            var clientSecret = _configuration["clientSecret"] ?? _configuration["MicrosoftAppPassword"];

            if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
            {
                throw new InvalidOperationException("Client ID and Client Secret must be configured");
            }

            var tokenUrl = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
            
            using var httpClient = new HttpClient();
            var formData = new List<KeyValuePair<string, string>>
            {
                new("client_id", clientId),
                new("scope", "https://graph.microsoft.com/.default"),
                new("client_secret", clientSecret),
                new("grant_type", "client_credentials")
            };

            using var formContent = new FormUrlEncodedContent(formData);
            var response = await httpClient.PostAsync(tokenUrl, formContent);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Failed to get access token: {response.StatusCode} - {errorContent}");
            }

            var content = await response.Content.ReadAsStringAsync();
            using var jsonDoc = JsonDocument.Parse(content);
            
            if (jsonDoc.RootElement.TryGetProperty("access_token", out var tokenElement))
            {
                return tokenElement.GetString() ?? throw new InvalidOperationException("Access token was null");
            }

            throw new InvalidOperationException("Access token not found in response");
        }

        private async Task AnswerCallAsync(string callId, string callbackUri, string accessToken)
        {
            var url = $"https://graph.microsoft.com/v1.0/communications/calls/{callId}/answer";
            
            var body = new
            {
                callbackUri = callbackUri,
                mediaConfig = new
                {
                    __odataType = "#microsoft.graph.serviceHostedMediaConfig"
                },
                acceptedModalities = new[] { "audio" }
            };

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");
            
            var json = JsonSerializer.Serialize(body);
            using var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");
            
            var response = await httpClient.PostAsync(url, content);
            
            _logger.LogInformation("Answer response status: {StatusCode}", response.StatusCode);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                throw new InvalidOperationException($"Failed to answer call: {response.StatusCode} - {errorContent}");
            }
        }

        private async Task ProcessLocalAudioFileAsync()
        {
            try
            {
                var audioFilePath = Path.Combine(Directory.GetCurrentDirectory(), "audio.wav");

                if (!File.Exists(audioFilePath))
                {
                    _logger.LogError("audio.wav file not found at: {AudioFilePath}", audioFilePath);
                    return;
                }

                var audioBuffer = await File.ReadAllBytesAsync(audioFilePath);
                var text = await _speechService.SpeechToTextAsync(audioBuffer);

                _logger.LogInformation("Transcription result: {Text}", text);

                // Start continuous recognition for the session
                await _speechService.StartContinuousRecognitionAsync(
                    (transcription) =>
                    {
                        _logger.LogInformation("Recognized speech: {Transcription}", transcription);
                        // Additional processing can be added here
                        return Task.CompletedTask;
                    },
                    (error) =>
                    {
                        _logger.LogError(error, "Speech recognition error");
                        return Task.CompletedTask;
                    });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing local audio file");
            }
        }
    }
}