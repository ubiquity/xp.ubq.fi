# Developer Performance Analytics Dashboard

A data visualization dashboard for analyzing developer performance metrics from the `text-conversation-rewards` module.

## Overview

This dashboard allows engineering managers and team leads to visualize and analyze developer contributions and activities through an intuitive interface. The system intelligently recommends appropriate visualization types based on the selected data dimensions.

## Features

- Dynamic data visualization based on selected dimensions
- Intelligent chart type recommendation system
- Support for various data dimensions (comment quality, review statistics, contributor metrics, etc.)
- Flexible visualization system

## Prerequisites

- Bun 1.0 or higher
- Supabase account with properly configured database

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd xp.ubq.fi
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env` with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_API_KEY=your_supabase_api_key_here
   ```

## Development

Run the development server:

```bash
bun run dev
```

Open your browser to the URL shown in the terminal (typically http://localhost:3000).

## Building for Production

Build the application:

```bash
bun run build
```

The compiled files will be in the `dist` directory.

## Data Structure

The dashboard expects data from the `text-conversation-rewards` module to be stored in Supabase. The data structure includes:

- Issue/PR information
- Comments with quality metrics
- Review statistics
- Contributor data
- Events and timestamps

## Architecture

The application follows a modular architecture:

- **API Layer**: Connects to Supabase to fetch data
- **Data Store**: Manages and transforms data
- **Chart Configuration Engine**: Suggests appropriate visualizations
- **Visualization Components**: Renders different chart types
- **Dashboard UI**: Provides the user interface

## License

[License information here]
