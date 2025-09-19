# Azure Bot Service Registration Issue Resolution

## Error: "The Microsoft App ID registered with this bot is already registered with APS"

This error occurs when there's a conflict with existing bot registrations. Here are the steps to resolve it:

## Solution 1: Check and Clean Up Existing Bot Registrations

### Step 1: List all existing bot services
```bash
# Login to Azure CLI
az login

# List all bot services in your subscription
az bot list --output table

# List bot services in a specific resource group
az bot list --resource-group <your-resource-group> --output table
```

### Step 2: Delete conflicting bot registration (if safe to do so)
```bash
# Delete the existing bot service that's causing the conflict
az bot delete --name <existing-bot-name> --resource-group <resource-group>
```

## Solution 2: Use a Different App Registration

### Option A: Create a new App Registration
```bash
# Create a new app registration
az ad app create --display-name "VoxRepoAgent-New" --available-to-other-tenants false
```

### Option B: Update your Bicep template to use existing App ID differently
Update the `msaAppType` in your bot registration:

1. **For Single Tenant:** `msaAppType: 'SingleTenant'`
2. **For Multi Tenant:** `msaAppType: 'MultiTenant'` 
3. **For Managed Identity:** `msaAppType: 'UserAssignedMSI'` (current)

## Solution 3: Reset Bot Channel Registration

### Step 1: Remove Teams channel
```bash
az bot msteams delete --name <bot-name> --resource-group <resource-group>
```

### Step 2: Re-add Teams channel
```bash
az bot msteams create --name <bot-name> --resource-group <resource-group>
```

## Solution 4: Update Configuration Values

Check and update these values in your `appsettings.json`:

```json
{
  "MicrosoftAppType": "UserAssignedMSI",
  "MicrosoftAppId": "your-managed-identity-client-id",
  "MicrosoftAppPassword": "",
  "MicrosoftAppTenantId": "your-tenant-id"
}
```

## Solution 5: Re-deploy with Clean State

### Step 1: Clean deployment
```bash
# Delete the entire resource group (WARNING: This deletes everything!)
az group delete --name <resource-group> --yes

# Or delete just the bot service
az bot delete --name <bot-name> --resource-group <resource-group>
```

### Step 2: Re-deploy using Bicep
```bash
# Deploy the infrastructure again
az deployment group create --resource-group <resource-group> --template-file infra/azure.bicep --parameters @infra/azure.parameters.json
```

## Recommended Steps for Your Case:

1. **First, check existing registrations:**
   ```bash
   az bot list --output table
   ```

2. **If you find a conflicting bot with the same App ID, delete it:**
   ```bash
   az bot delete --name <conflicting-bot-name> --resource-group <resource-group>
   ```

3. **Update your appsettings.json** to ensure correct configuration:
   - Verify `MicrosoftAppId` matches your managed identity client ID
   - Ensure `MicrosoftAppType` is set to `"UserAssignedMSI"`
   - Confirm `MicrosoftAppTenantId` is correct

4. **Re-deploy your bot service** using the updated Bicep template

5. **Test the Teams channel** after deployment

## Prevention for Future:
- Use unique names for bot services
- Always clean up test/dev bot registrations
- Use different App IDs for different environments (dev/staging/prod)

## If You Need to Start Fresh:
If all else fails, create a completely new bot registration with:
- New bot service name
- New app registration
- New managed identity (if needed)

This ensures no conflicts with existing registrations.