---
description: Build the application for Linux
---
To build the application for Linux, follow these steps. Note that building for Linux on Windows usually works for `AppImage` targets, but if you have native dependencies, you might need WSL (Windows Subsystem for Linux) or Docker.

1. Run the build script:
// turbo
npm run electron:build:linux

2. Check the `release` directory for the output file (e.g., `CraftCorps-x.y.z.AppImage`).
