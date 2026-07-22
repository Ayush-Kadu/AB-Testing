#!/bin/bash

# Script to update META_SYSTEM_USER_TOKEN in .env file on server
# Usage: Run this on your server, or copy-paste the commands

# Navigate to backend directory
cd ~/projects/backend/urlpt

# Backup the current .env file
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# New token
NEW_TOKEN="EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag"

# Update the token in .env file
# If META_SYSTEM_USER_TOKEN exists, replace it; otherwise add it
if grep -q "META_SYSTEM_USER_TOKEN" .env; then
    # Replace existing token
    sed -i "s|META_SYSTEM_USER_TOKEN=.*|META_SYSTEM_USER_TOKEN=${NEW_TOKEN}|" .env
    echo "✅ Updated existing META_SYSTEM_USER_TOKEN in .env"
else
    # Add new token if it doesn't exist
    echo "META_SYSTEM_USER_TOKEN=${NEW_TOKEN}" >> .env
    echo "✅ Added META_SYSTEM_USER_TOKEN to .env"
fi

# Verify the update
echo ""
echo "📋 Updated .env file:"
grep "META_SYSTEM_USER_TOKEN" .env

# Restart the server
echo ""
echo "🔄 Restarting server..."
pm2 restart urlpt-api

echo ""
echo "✅ Done! Server restarted with new token."

