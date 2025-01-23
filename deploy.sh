#!/bin/bash

# Build the application
echo "Building the application..."
npm run build

# Create dist directory if it doesn't exist
mkdir -p dist

# Copy CSV files to dist/public
echo "Copying data files..."
cp public/*.csv dist/public/

# Create a production-ready .env file
echo "Creating production environment file..."
cat > dist/.env << EOL
VITE_APP_TITLE="Climbing Dashboard"
VITE_APP_VERSION="1.0.0"
EOL

echo "Deployment build complete! The contents of the dist directory are ready to be deployed." 