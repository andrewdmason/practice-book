#!/bin/bash
set -e

echo "Setting up Practice Book workspace..."

# Check for required tools
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies
echo "Installing npm dependencies..."
npm install

# Copy environment file if it exists in repo root
if [ -f "$CONDUCTOR_ROOT_PATH/.env.local" ]; then
    cp "$CONDUCTOR_ROOT_PATH/.env.local" .env.local
    echo "Environment file copied from repo root."
else
    echo "No .env.local found in repo root."
    echo "Copy .env.example to .env.local and fill in your Supabase credentials to get started."
fi

echo ""
echo "Setup complete! Click the Run button to start the dev server."
