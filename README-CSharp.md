# VoxRepoAgent - C# Migration

This project has been migrated from Node.js to C# using .NET 8 and ASP.NET Core.

## Overview

VoxRepoAgent is a Microsoft Teams bot that integrates with Azure AI Foundry and provides speech-to-text functionality. The bot can handle:

- Text-based conversations through Azure AI Foundry
- Speech transcription using Azure Cognitive Services Speech SDK
- Microsoft Teams calling callbacks
- Audio processing and real-time speech recognition

## Architecture

The project is structured as follows:

- **Program.cs** - Main application entry point and dependency injection configuration
- **Controllers/** - API controllers for handling messages and calling callbacks
- **Bots/** - Teams bot implementation with Azure AI Foundry integration
- **Services/** - Core services including Speech Service and Call Event Handler
- **Models/** - Data models (to be added as needed)

## Key Components

### TeamsBot
- Handles incoming Teams messages
- Integrates with Azure AI Foundry for intelligent responses
- Processes speech transcriptions

### SpeechService
- Speech-to-text conversion using Azure Cognitive Services
- Text-to-speech synthesis
- Continuous speech recognition for real-time audio processing
- Audio chunk processing for Teams calling scenarios

### CallEventHandler
- Processes Microsoft Graph calling callbacks
- Handles incoming call events
- Manages audio transcription from calls

## Configuration

Configure the following settings in `appsettings.json` or environment variables:

```json
{
  "MicrosoftAppId": "your-app-id",
  "MicrosoftAppPassword": "your-app-password", 
  "MicrosoftAppTenantId": "your-tenant-id",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "SPEECH_SERVICE_KEY": "your-speech-service-key",
  "SPEECH_SERVICE_REGION": "your-speech-service-region",
  "AZURE_ENDPOINT": "your-azure-ai-foundry-endpoint",
  "AGENT_ID": "your-azure-ai-agent-id",
  "BOT_CALLBACK_URI": "your-bot-callback-uri"
}
```

## Dependencies

The project uses the following key NuGet packages:

- **Microsoft.Bot.Builder** (4.22.7) - Bot Framework SDK
- **Microsoft.CognitiveServices.Speech** (1.40.0) - Azure Speech SDK
- **Azure.AI.Projects** (1.0.0) - Azure AI Foundry integration
- **Azure.Identity** (1.13.1) - Azure authentication
- **Microsoft.Graph** (5.75.0) - Microsoft Graph API integration

## Running the Application

### Prerequisites
- .NET 8 SDK
- Azure subscription with:
  - Bot registration
  - Speech Service
  - Azure AI Foundry project

### Local Development
1. Clone the repository
2. Configure settings in `appsettings.Development.json`
3. Run the application:
   ```bash
   dotnet run
   ```

### Deployment
The application is configured for Azure App Service deployment with:
- .NET 8 runtime
- Managed identity support
- Automatic scaling capabilities

## Migration Notes

### Key Changes from Node.js Version:
1. **Express.js → ASP.NET Core** - Web framework migration
2. **Microsoft Agents Hosting → Bot Framework SDK** - Bot framework update
3. **JavaScript Speech SDK → .NET Speech SDK** - Speech service migration
4. **Node.js runtime → .NET 8 runtime** - Platform migration

### Maintained Functionality:
- All original features preserved
- Azure AI Foundry integration
- Speech-to-text capabilities
- Teams calling support
- Audio processing pipeline

## Development

### Project Structure
```
VoxRepoAgent/
├── Bots/
│   └── TeamsBot.cs
├── Controllers/
│   └── MessagesController.cs
├── Services/
│   ├── SpeechService.cs
│   ├── CallEventHandler.cs
│   ├── AdapterWithErrorHandler.cs
│   └── Interfaces.cs
├── Models/
├── Program.cs
├── appsettings.json
├── appsettings.Development.json
├── VoxRepoAgent.csproj
└── web.config
```

### Testing
Run tests using:
```bash
dotnet test
```

### Building for Production
```bash
dotnet publish -c Release -o ./publish
```

## Troubleshooting

### Common Issues:
1. **Speech Service Configuration** - Ensure Speech Service key and region are correctly set
2. **Bot Authentication** - Verify Bot Framework registration and credentials
3. **Azure AI Foundry** - Check endpoint and agent ID configuration
4. **Calling Callbacks** - Ensure callback URI is accessible and properly configured

### Logging
The application uses structured logging with different levels for development and production environments. Check logs for detailed error information.

## Support

For issues specific to the C# migration or .NET-specific functionality, please refer to the migration documentation or create an issue.