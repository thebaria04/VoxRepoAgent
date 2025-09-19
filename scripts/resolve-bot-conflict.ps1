# Azure Bot Service Conflict Resolution Script (PowerShell)
# Run this script to identify and resolve "App ID already registered with APS" error

Write-Host "🔍 Checking for existing bot service registrations..." -ForegroundColor Yellow

# Check if logged into Azure
try {
    $subscription = az account show --query name -o tsv 2>$null
    if (!$subscription) {
        throw "Not logged in"
    }
    Write-Host "📋 Current subscription: $subscription" -ForegroundColor Green
} catch {
    Write-Host "❌ Please login to Azure first:" -ForegroundColor Red
    Write-Host "az login" -ForegroundColor Cyan
    exit 1
}

# List all bot services
Write-Host "`n🤖 Listing all bot services in subscription:" -ForegroundColor Yellow
az bot list --output table

# Prompt for resource group
$resourceGroup = Read-Host "`n📝 Enter your resource group name"

if ([string]::IsNullOrWhiteSpace($resourceGroup)) {
    Write-Host "❌ Resource group name is required" -ForegroundColor Red
    exit 1
}

# List bot services in the resource group
Write-Host "`n🔍 Bot services in resource group '$resourceGroup':" -ForegroundColor Yellow
az bot list --resource-group $resourceGroup --output table

# Check for VoxRepo related bots
Write-Host "`n🔍 Searching for VoxRepo related bot services:" -ForegroundColor Yellow
az bot list --query "[?contains(name, 'vox') || contains(name, 'Vox') || contains(displayName, 'Vox')]" --output table

# Prompt for action
Write-Host "`n❓ What would you like to do?" -ForegroundColor Cyan
Write-Host "1) Delete a conflicting bot service"
Write-Host "2) Show bot service details"
Write-Host "3) Exit and manual resolution"

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        $botName = Read-Host "`n📝 Enter the name of the bot service to delete"
        
        if ([string]::IsNullOrWhiteSpace($botName)) {
            Write-Host "❌ Bot name is required" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "⚠️  WARNING: This will delete the bot service '$botName'" -ForegroundColor Yellow
        $confirm = Read-Host "Are you sure? (y/N)"
        
        if ($confirm -match "^[Yy]$") {
            Write-Host "🗑️  Deleting bot service '$botName'..." -ForegroundColor Yellow
            az bot delete --name $botName --resource-group $resourceGroup
            Write-Host "✅ Bot service deleted. You can now re-deploy your infrastructure." -ForegroundColor Green
        } else {
            Write-Host "❌ Deletion cancelled" -ForegroundColor Red
        }
    }
    "2" {
        $botName = Read-Host "`n📝 Enter the name of the bot service to inspect"
        
        if ([string]::IsNullOrWhiteSpace($botName)) {
            Write-Host "❌ Bot name is required" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "`n📋 Bot service details:" -ForegroundColor Yellow
        az bot show --name $botName --resource-group $resourceGroup --output json
    }
    "3" {
        Write-Host "`n📖 Manual resolution steps:" -ForegroundColor Cyan
        Write-Host "1. Identify the conflicting bot service from the list above"
        Write-Host "2. Delete it using: az bot delete --name <bot-name> --resource-group <rg>"
        Write-Host "3. Re-deploy your infrastructure"
        Write-Host "4. Ensure your appsettings.json has correct MicrosoftAppType: 'UserAssignedMSI'"
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n✅ Script completed" -ForegroundColor Green