using Microsoft.AspNetCore.Mvc;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Builder.Integration.AspNet.Core;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using VoxRepoAgent.Services;

namespace VoxRepoAgent.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MessagesController : ControllerBase
    {
        private readonly IBotFrameworkHttpAdapter _adapter;
        private readonly IBot _bot;
        private readonly ILogger<MessagesController> _logger;

        public MessagesController(IBotFrameworkHttpAdapter adapter, IBot bot, ILogger<MessagesController> logger)
        {
            _adapter = adapter;
            _bot = bot;
            _logger = logger;
        }

        [HttpPost]
        public async Task PostAsync()
        {
            _logger.LogInformation("Processing incoming message");
            await _adapter.ProcessAsync(Request, Response, _bot);
        }
    }

    [Route("calling")]
    [ApiController]
    public class CallingController : ControllerBase
    {
        private readonly ILogger<CallingController> _logger;
        private readonly ISpeechService _speechService;
        private readonly ICallEventHandler _callEventHandler;

        public CallingController(ILogger<CallingController> logger, ISpeechService speechService, ICallEventHandler callEventHandler)
        {
            _logger = logger;
            _speechService = speechService;
            _callEventHandler = callEventHandler;
        }

        [HttpPost("callback")]
        public async Task<IActionResult> CallbackAsync([FromBody] JsonElement body)
        {
            try
            {
                _logger.LogInformation("CALLBACK received");
                _logger.LogDebug("CALLBACK body: {Body}", body.ToString());

                // Respond quickly so Graph doesn't retry
                var responseTask = Task.FromResult(Accepted());

                // Process notifications asynchronously
                _ = Task.Run(async () =>
                {
                    try
                    {
                        if (body.TryGetProperty("value", out var valueElement) && valueElement.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var notification in valueElement.EnumerateArray())
                            {
                                await ProcessNotificationAsync(notification);
                            }
                        }

                        await _callEventHandler.HandleCallEventAsync(body);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing call notifications");
                    }
                });

                return await responseTask;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling call event");
                return StatusCode(500, "Error processing call event");
            }
        }

        private async Task ProcessNotificationAsync(JsonElement notification)
        {
            try
            {
                var resource = notification.TryGetProperty("resource", out var resourceProp) ? resourceProp.GetString() : null;
                var changeType = notification.TryGetProperty("changeType", out var changeTypeProp) ? changeTypeProp.GetString() : null;

                _logger.LogInformation("Notification resource: {Resource}, changeType: {ChangeType}", resource, changeType);

                // Check for media notifications
                if (!string.IsNullOrEmpty(resource) && resource.ToLower().Contains("/media"))
                {
                    _logger.LogInformation("Media notification detected: {Resource}", resource);
                    var resourceData = notification.TryGetProperty("resourceData", out var resourceDataProp) ? resourceDataProp : notification;
                    await TryExtractAndFeedAsync(resourceData);
                    return;
                }

                // Check for inline media in resourceData
                if (notification.TryGetProperty("resourceData", out var resourceDataElement))
                {
                    if (HasMediaContent(resourceDataElement))
                    {
                        _logger.LogInformation("Possible inlined media in resourceData");
                        await TryExtractAndFeedAsync(resourceDataElement);
                        return;
                    }
                }

                // Check for media in top-level properties
                if (HasMediaContent(notification))
                {
                    _logger.LogInformation("Possible media under top-level properties");
                    await TryExtractAndFeedAsync(notification);
                    return;
                }

                _logger.LogInformation("Non-media notification (lifecycle): {ChangeType} {Resource}", changeType, resource);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing notification");
            }
        }

        private static bool HasMediaContent(JsonElement element)
        {
            var mediaProperties = new[] { "media", "mediaStreams", "content", "data", "body" };
            return mediaProperties.Any(prop => element.TryGetProperty(prop, out _));
        }

        private async Task TryExtractAndFeedAsync(JsonElement obj)
        {
            try
            {
                if (await FeedIfFoundAsync(obj, "root"))
                    return;

                if (obj.TryGetProperty("resourceData", out var resourceData) && await FeedIfFoundAsync(resourceData, "resourceData"))
                    return;

                if (obj.TryGetProperty("media", out var media) && await FeedIfFoundAsync(media, "media"))
                    return;

                if (obj.TryGetProperty("body", out var body) && await FeedIfFoundAsync(body, "body"))
                    return;

                if (obj.TryGetProperty("data", out var data) && await FeedIfFoundAsync(data, "data"))
                    return;

                _logger.LogInformation("No media payload extracted from event; full object for debugging: {Object}", obj.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting and feeding audio");
            }
        }

        private async Task<bool> FeedIfFoundAsync(JsonElement payload, string sourceDesc)
        {
            try
            {
                if (payload.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in payload.EnumerateArray())
                    {
                        await FeedIfFoundAsync(item, $"{sourceDesc}[]");
                    }
                    return true;
                }

                var possibleFields = new[] { "data", "content", "body", "audio", "chunk", "payload" };
                foreach (var field in possibleFields)
                {
                    if (payload.TryGetProperty(field, out var chunk))
                    {
                        if (chunk.ValueKind == JsonValueKind.String)
                        {
                            var base64String = chunk.GetString();
                            if (!string.IsNullOrEmpty(base64String))
                            {
                                var buffer = Convert.FromBase64String(base64String);
                                _logger.LogInformation("Feeding audio chunk from {Source}.{Field} (bytes={Bytes})", sourceDesc, field, buffer.Length);
                                await _speechService.FeedAudioChunkAsync(buffer);
                                return true;
                            }
                        }
                    }
                }

                if (payload.ValueKind == JsonValueKind.String)
                {
                    var base64String = payload.GetString();
                    if (!string.IsNullOrEmpty(base64String))
                    {
                        var buffer = Convert.FromBase64String(base64String);
                        _logger.LogInformation("Feeding audio chunk from {Source} (bytes={Bytes})", sourceDesc, buffer.Length);
                        await _speechService.FeedAudioChunkAsync(buffer);
                        return true;
                    }
                }

                if (payload.TryGetProperty("mediaChunks", out var mediaChunks))
                {
                    return await FeedIfFoundAsync(mediaChunks, $"{sourceDesc}.mediaChunks");
                }

                if (payload.TryGetProperty("mediaPackets", out var mediaPackets))
                {
                    return await FeedIfFoundAsync(mediaPackets, $"{sourceDesc}.mediaPackets");
                }

                if (payload.TryGetProperty("mediaStreams", out var mediaStreams) && mediaStreams.ValueKind == JsonValueKind.Array)
                {
                    var labels = new List<string>();
                    foreach (var stream in mediaStreams.EnumerateArray())
                    {
                        if (stream.TryGetProperty("label", out var label))
                        {
                            labels.Add(label.GetString() ?? "unknown");
                        }
                    }
                    _logger.LogInformation("mediaStreams metadata found: {Labels}", string.Join(", ", labels));
                }

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting/feeding chunk");
                return false;
            }
        }
    }
}