# Azure Bot Service Troubleshooting Guide

## Problem: "The Microsoft App ID registered with this bot is already registered with APS"

This error occurs when you try to create an Azure Bot Service with an App ID that's already in use by another bot service.

## Quick Resolution Steps

### Option 1: Use the Automated PowerShell Script
```powershell
# Navigate to your project directory
cd c:\Users\sthebaria\VoxRepoAgent

# Run the conflict resolution script
.\scripts\resolve-bot-conflict.ps1
```

### Option 2: Manual Resolution

#### Step 1: Identify Conflicting Bot Services
```bash
# Login to Azure
az login

# List all bot services in your subscription
az bot list --output table

# List bot services in your resource group
az bot list --resource-group <your-resource-group> --output table
```

#### Step 2: Delete the Conflicting Bot Service
```bash
# Delete the conflicting bot service
az bot delete --name <conflicting-bot-name> --resource-group <resource-group>
```

#### Step 3: Re-deploy Your Infrastructure
```bash
# Re-run your Bicep deployment
az deployment group create \
  --resource-group <your-resource-group> \
  --template-file ./infra/azure.bicep \
  --parameters @./infra/azure.parameters.json
```

## Root Causes and Solutions

### 1. Duplicate Bot Service Names
**Cause**: Multiple bot services using the same Microsoft App ID
**Solution**: Delete the old/unused bot service or use a different App ID

### 2. Previous Failed Deployments
**Cause**: Previous deployment left orphaned resources
**Solution**: Clean up all resources and redeploy fresh

### 3. Resource Group Conflicts
**Cause**: Bot service exists in different resource group with same App ID
**Solution**: Search across all resource groups and clean up

### 4. App Registration Issues
**Cause**: App registration exists but bot service references are corrupted
**Solution**: 
- Option A: Delete and recreate app registration
- Option B: Clean up bot service references

### 5. Managed Identity Configuration
**Cause**: Incorrect app type configuration
**Solution**: Ensure `appsettings.json` has correct configuration:

```json
{
  "MicrosoftAppType": "UserAssignedMSI",
  "MicrosoftAppId": "",
  "MicrosoftAppPassword": "",
  "MicrosoftAppTenantId": ""
}
```

## Verification Steps

After resolving the conflict:

1. **Verify Bot Service Deployment**:
   ```bash
   az bot show --name <your-bot-name> --resource-group <resource-group>
   ```

2. **Test Bot Endpoint**:
   ```bash
   curl -X POST https://<your-bot-endpoint>/api/messages \
     -H "Content-Type: application/json" \
     -d '{"type":"message","text":"test"}'
   ```

3. **Check Teams Channel Configuration**:
   - Go to Azure Portal → Bot Service → Channels
   - Verify Microsoft Teams channel is properly configured
   - Test in Teams

## Prevention

To avoid this issue in the future:

1. **Use Unique Naming**: Always use unique bot service names
2. **Clean Resource Groups**: Delete test/development resource groups completely
3. **Document App IDs**: Keep track of which App IDs are used where
4. **Use Infrastructure as Code**: Use Bicep/ARM templates for consistent deployments

## Advanced Troubleshooting

### Check App Registration Status
```bash
# List app registrations
az ad app list --display-name <your-app-name> --output table

# Show specific app registration
az ad app show --id <app-id>
```

### Check Service Principal
```bash
# List service principals
az ad sp list --display-name <your-app-name> --output table

# Show specific service principal
az ad sp show --id <service-principal-id>
```

### Resource Group Deep Clean
```bash
# List all resources in resource group
az resource list --resource-group <resource-group> --output table

# Delete entire resource group (USE WITH CAUTION)
az group delete --name <resource-group> --yes --no-wait
```

## Support Contacts

If you continue to experience issues:

1. **Azure Support**: Create a support ticket in Azure Portal
2. **Microsoft Teams Support**: Use Microsoft 365 admin center
3. **Bot Framework Support**: GitHub issues in Bot Framework repository

## Related Documentation

- [Azure Bot Service Documentation](https://docs.microsoft.com/en-us/azure/bot-service/)
- [Bot Framework SDK Documentation](https://docs.microsoft.com/en-us/azure/bot-service/bot-service-overview-introduction)
- [Teams Bot Development](https://docs.microsoft.com/en-us/microsoftteams/platform/bots/what-are-bots)