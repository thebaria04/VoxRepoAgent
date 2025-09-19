#!/bin/bash

# Azure Bot Service Conflict Resolution Script
# Run this script to identify and resolve "App ID already registered with APS" error

echo "🔍 Checking for existing bot service registrations..."

# Check if logged into Azure
if ! az account show &> /dev/null; then
    echo "❌ Please login to Azure first:"
    echo "az login"
    exit 1
fi

# Get current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo "📋 Current subscription: $SUBSCRIPTION"

# List all bot services
echo -e "\n🤖 Listing all bot services in subscription:"
az bot list --output table

# Prompt for resource group
echo -e "\n📝 Enter your resource group name:"
read -r RESOURCE_GROUP

if [ -z "$RESOURCE_GROUP" ]; then
    echo "❌ Resource group name is required"
    exit 1
fi

# List bot services in the resource group
echo -e "\n🔍 Bot services in resource group '$RESOURCE_GROUP':"
az bot list --resource-group "$RESOURCE_GROUP" --output table

# Check for VoxRepo related bots
echo -e "\n🔍 Searching for VoxRepo related bot services:"
az bot list --query "[?contains(name, 'vox') || contains(name, 'Vox') || contains(displayName, 'Vox')]" --output table

# Prompt for action
echo -e "\n❓ What would you like to do?"
echo "1) Delete a conflicting bot service"
echo "2) Show bot service details"
echo "3) Exit and manual resolution"
read -r -p "Enter choice (1-3): " CHOICE

case $CHOICE in
    1)
        echo -e "\n📝 Enter the name of the bot service to delete:"
        read -r BOT_NAME
        
        if [ -z "$BOT_NAME" ]; then
            echo "❌ Bot name is required"
            exit 1
        fi
        
        echo "⚠️  WARNING: This will delete the bot service '$BOT_NAME'"
        read -r -p "Are you sure? (y/N): " CONFIRM
        
        if [[ $CONFIRM =~ ^[Yy]$ ]]; then
            echo "🗑️  Deleting bot service '$BOT_NAME'..."
            az bot delete --name "$BOT_NAME" --resource-group "$RESOURCE_GROUP"
            echo "✅ Bot service deleted. You can now re-deploy your infrastructure."
        else
            echo "❌ Deletion cancelled"
        fi
        ;;
    2)
        echo -e "\n📝 Enter the name of the bot service to inspect:"
        read -r BOT_NAME
        
        if [ -z "$BOT_NAME" ]; then
            echo "❌ Bot name is required"
            exit 1
        fi
        
        echo -e "\n📋 Bot service details:"
        az bot show --name "$BOT_NAME" --resource-group "$RESOURCE_GROUP" --output json
        ;;
    3)
        echo -e "\n📖 Manual resolution steps:"
        echo "1. Identify the conflicting bot service from the list above"
        echo "2. Delete it using: az bot delete --name <bot-name> --resource-group <rg>"
        echo "3. Re-deploy your infrastructure using: az deployment group create ..."
        echo "4. Ensure your appsettings.json has correct MicrosoftAppType: 'UserAssignedMSI'"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo -e "\n✅ Script completed"