#!/bin/bash

# Build Windows executable using Docker + Wine
# This allows building Windows .exe files from macOS/Linux

set -e

echo "🐳 Building Windows executable with Docker + Wine..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Build Docker image
echo "📦 Building Docker image..."
docker build -f Dockerfile.windows -t craftcorps-windows-builder .

# Run build in container
echo "🔨 Building Windows executable..."
docker run --rm -v "$(pwd)/release:/project/release" craftcorps-windows-builder

# Check if build succeeded
if [ -f "release/CraftCorps Setup 0.4.3.exe" ]; then
    echo ""
    echo "✅ Build successful!"
    echo "📁 Output: release/CraftCorps Setup 0.4.3.exe"
    ls -lh release/*.exe
else
    echo ""
    echo "❌ Build failed - no .exe file found"
    exit 1
fi
