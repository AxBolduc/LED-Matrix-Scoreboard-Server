# LED Matrix Scoreboard Server

## Overview

This project is an API server for managing and displaying live sports scores on my [LED matrix scoreboard project](https://github.com/axbolduc/LED-Matrix-Scoreboard). It supports multiple sports (MLB, NHL, etc.) and provides endpoints for retrieving game data, managing sessions, and handling real-time updates via websockets. The server is designed for extensibility and can be integrated with various LED matrix hardware setups.

**Deployment Target:**

This server is designed to be deployed on [Cloudflare Workers](https://workers.cloudflare.com/), and is lightweight enough to be hosted on the Cloudflare Workers free tier for most use cases. This makes it easy and cost-effective to run your own scoreboard API in the cloud with minimal setup and no ongoing hosting costs for typical hobbyist or small-scale deployments.

## Features
- Fetches live scores and schedules for supported sports
- Real-time updates via WebSocket endpoints
- Modular API client architecture for different sports
- Durable object support for session and socket management
- Error handling and validation for robust API responses

## Development Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- pnpm (or npm/yarn)
- Wrangler CLI (for Cloudflare Workers)

### Setup
1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd mlb-scoreboard-api
   ```
2. Install dependencies:
   ```sh
   pnpm install
   # or
   npm install
   ```
3. Configure environment variables and settings as needed (see `wrangler.jsonc` and `settings.json`).

### Running Locally
To start the development server locally:
```sh
pnpm run dev
# or
npm run dev
```

### Testing
To run tests:
```sh
pnpm test
# or
npm test
```

## Deployment Instructions

This project is designed to be deployed on Cloudflare Workers using Wrangler.

1. Build the project:
   ```sh
   pnpm run build
   # or
   npm run build
   ```
2. Deploy to Cloudflare:
   ```sh
   wrangler deploy
   ```

For more details, refer to the [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/).

## Contributing
Contributions are welcome! Please open issues or submit pull requests for improvements or bug fixes.

## License
See [LICENSE](LICENSE) for details.
