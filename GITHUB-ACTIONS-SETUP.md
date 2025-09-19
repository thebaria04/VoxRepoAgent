# GitHub Actions Setup for VoxRepoAgent

## Current Status
✅ Azure App Registration exists: `VoxRepoBotTest`
✅ GitHub Actions workflow is configured
❌ Missing GitHub Secrets for authentication

## Required GitHub Secrets

You need to add these secrets to your GitHub repository at:
**https://github.com/thebaria04/VoxRepoAgent/settings/secrets/actions**

### 1. AZUREAPPSERVICE_CLIENTID_D12FADDD949449D4B2D4DFB2CD0F020B
**Value:** `7e0e729c-d0d1-4577-8b0c-171832be8c85`
(This is your app registration's Client ID)

### 2. AZUREAPPSERVICE_TENANTID_8BFB674F6BA245EBB63576BBF5210DA2  
**Value:** `72f988bf-86f1-41af-91ab-2d7cd011db47`
(Your Microsoft tenant ID)

### 3. AZUREAPPSERVICE_SUBSCRIPTIONID_CD007F823EA34952A356F54D428C3E36
**Value:** `2c56218a-7e03-43fa-a737-562a02d9a9e1`
(Your Azure subscription ID)

## Step-by-Step Setup Instructions

### Step 1: Add GitHub Secrets
1. Go to https://github.com/thebaria04/VoxRepoAgent
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each of the above secrets

### Step 2: Configure Federated Identity (if needed)
If the workflow still fails after adding secrets, you may need to configure federated identity for the app registration:

```bash
# This enables GitHub Actions to authenticate without a client secret
az ad app federated-credential create \
  --id 7e0e729c-d0d1-4577-8b0c-171832be8c85 \
  --parameters '{
    "name": "VoxRepoAgent-GitHub-Actions",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:thebaria04/VoxRepoAgent:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'
```

### Step 3: Test the Workflow
After configuring the secrets:
1. Push any change to the main branch
2. Check the Actions tab to see the workflow run
3. The workflow will build and deploy your .NET app to Azure Web App

## Azure Resources Created
The workflow will deploy to:
- **App Service:** VoxRepoBotTest-app-nr3qljggi6m6m
- **Resource Group:** (as configured in your Azure setup)

## Troubleshooting

### If you get "Login failed" errors:
1. Verify all three secrets are added correctly
2. Check that the app registration has proper permissions
3. May need to configure federated identity (see Step 2 above)

### If deployment fails:
1. Check that the Azure Web App exists
2. Verify the app service name matches in the workflow
3. Ensure the app service is configured for .NET 8

## Next Steps After Setup
1. Push this documentation to trigger the first workflow run
2. Monitor the GitHub Actions tab for build/deploy status
3. Once deployed, configure your bot endpoints in Azure Bot Service
4. Test the bot in Microsoft Teams

## Workflow Details
- **Trigger:** Push to main branch or manual dispatch
- **Build:** .NET 8, Release configuration
- **Deploy:** Azure Web App using managed identity
- **Permissions:** Uses federated identity credentials (no client secrets stored)