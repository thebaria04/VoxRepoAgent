using System.Text.Json;

namespace VoxRepoAgent.Services
{
    public interface ISpeechService
    {
        Task<string> SpeechToTextAsync(byte[] audioBuffer);
        Task StartContinuousRecognitionAsync(Func<string, Task> onRecognizedCallback, Func<Exception, Task>? onErrorCallback = null);
        Task FeedAudioChunkAsync(byte[] chunk);
        Task StopContinuousRecognitionAsync();
        Task<byte[]> TextToSpeechAsync(string text, string? voiceName = null);
        Task SaveAudioToFileAsync(byte[] audioBuffer, string filePath);
        void Dispose();
    }

    public interface ICallEventHandler
    {
        Task HandleCallEventAsync(JsonElement requestBody);
    }
}