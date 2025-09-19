using Microsoft.Bot.Builder.Integration.AspNet.Core;
using Microsoft.Bot.Builder;
using Microsoft.Bot.Connector.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace VoxRepoAgent.Services
{
    public class AdapterWithErrorHandler : CloudAdapter
    {
        public AdapterWithErrorHandler(BotFrameworkAuthentication auth, ILogger<IBotFrameworkHttpAdapter> logger, IConfiguration configuration)
            : base(auth, logger)
        {
            OnTurnError = async (turnContext, exception) =>
            {
                // Log any leaked exception from the application.
                logger.LogError(exception, "[OnTurnError] unhandled error : {Exception}", exception.Message);

                // Send a message to the user
                if (turnContext.Activity.Type == Microsoft.Bot.Schema.ActivityTypes.Message)
                {
                    await turnContext.SendActivityAsync($"The bot encountered an unhandled error:\n {exception.Message}");
                    await turnContext.SendActivityAsync("To continue to run this bot, please fix the bot source code.");
                }
            };
        }
    }
}