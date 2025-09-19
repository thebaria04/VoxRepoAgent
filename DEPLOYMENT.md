# Build and Deployment Scripts

## Local Development

### Prerequisites
- .NET 8 SDK
- Visual Studio 2022 or VS Code

### Build the project
```bash
dotnet build
```

### Run the project locally
```bash
dotnet run
```

### Run with hot reload
```bash
dotnet watch run
```

## Testing

### Run tests
```bash
dotnet test
```

## Deployment

### Build for production
```bash
dotnet publish -c Release -o ./publish --self-contained false --runtime win-x64
```

### Build for Linux deployment
```bash
dotnet publish -c Release -o ./publish --self-contained false --runtime linux-x64
```

### Azure App Service Deployment
The project is configured for Azure App Service deployment. Use the Azure CLI or GitHub Actions for automated deployment.

```bash
# Deploy using Azure CLI (after building)
az webapp deployment source config-zip --resource-group <resource-group> --name <app-name> --src ./publish.zip
```

## Environment Variables

Set the following environment variables for production:

- `MicrosoftAppId` - Bot Framework App ID
- `MicrosoftAppPassword` - Bot Framework App Password
- `MicrosoftAppTenantId` - Azure AD Tenant ID
- `SPEECH_SERVICE_KEY` - Azure Speech Service Key
- `SPEECH_SERVICE_REGION` - Azure Speech Service Region
- `AZURE_ENDPOINT` - Azure AI Foundry Endpoint
- `AGENT_ID` - Azure AI Agent ID
- `BOT_CALLBACK_URI` - Bot callback URI for Teams calling