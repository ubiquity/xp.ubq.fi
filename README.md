# GitHub Artifacts Viewer

A minimal frontend application to download, unzip, and display GitHub artifacts directly in the browser using WASM.

## Features

- Download GitHub artifacts directly in the browser
- Process ZIP files using WebAssembly
- Store and view results using IndexedDB
- Minimal UI without frameworks

## Development

This project uses Bun and TypeScript for development.

### Setup

1. Clone the repository
2. Install dependencies with `bun install`
3. Copy `.env.example` to `.env` and fill in your GitHub details

### Development Commands

- `bun run dev`: Start development environment with auto-restart (recommended)
- `bun run build`: Build for production
- `bun run start`: Start server without watching

### Architecture

- **Frontend**: Plain HTML, CSS, and TypeScript
- **Backend**: Minimal Bun server in development, Deno Deploy for production
- **WASM**: Rust-based ZIP processing for browser

## Deployment

The project is designed to be deployed to Deno Deploy:

1. Build the project: `bun run build`
2. Push the `deno/artifact-proxy.ts` file to Deno Deploy
3. Set the required environment variables in the Deno Deploy dashboard

## Environment Variables

- `GITHUB_TOKEN`: GitHub token with artifacts access
- `ORG`: GitHub organization name
- `REPO`: GitHub repository name
- `DEBUG`: Set to "true" to enable verbose logging (optional)

## Server Auto-Restart

The development server will automatically restart when any server-related file changes, providing:

- Real-time feedback for server changes
- Automatic browser refresh for frontend changes
- Colorized logging for easier debugging
