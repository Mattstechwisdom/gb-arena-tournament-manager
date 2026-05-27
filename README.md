# GB Arena Tournament Manager

A desktop tournament management application for gaming events, built with Electron, React, TypeScript, and Vite.

## Features

- **Game Library Management**: Browse and manage a comprehensive catalog of games across multiple genres (Fighting, Battle Royale, MOBA, Sports, Racing, and more)
- **Custom Game Support**: Add your own games with custom cover art, categories, and platform information
- **Tournament Creation**: Set up tournaments with customizable:
  - Match formats (1v1, 2v2)
  - Bracket styles (Single Elimination, Double Elimination, Swiss, Round Robin)
  - Rules (Best of, Timer, Stage List, Character Bans)
  - Entry fees and prize pool management
- **Bracket Generation**: Automatically generate tournament brackets based on participant count
- **Roster Management**: Manage player and team entrants with check-in functionality
- **Match Tracking**: Track match results and automatically advance winners through brackets
- **Financial Reporting**: Manage tournament finances including ticket sales, vendor shares, and prize distribution
- **Data Persistence**: All tournament data is saved locally using electron-store
- **Cover Art Customization**: Import custom cover art for games (desktop app only)
- **Per-Game Tournament Settings**: Configure allowed match types and bracket styles for each game

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 30
- **Build Tool**: Vite 5
- **State Management**: Zustand
- **Routing**: React Router 6
- **Styling**: Tailwind CSS
- **Data Persistence**: electron-store

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Mattstechwisdom/gb-arena-tournament-manager.git
   cd gb-arena-tournament-manager
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

### Building

Build the application for production:

```bash
npm run build
```

This will create a portable Windows executable in the `release/0.0.0/` directory.

## Project Structure

```
gb-arena-tournament-manager/
├── electron/              # Electron main process code
│   ├── main.ts           # Main process entry point
│   └── preload.ts        # Preload script for IPC
├── src/                  # React application code
│   ├── components/       # Reusable UI components
│   ├── data/            # Game catalog data
│   ├── lib/             # Utilities (bracket generation, CSV export, etc.)
│   ├── pages/           # Page components
│   └── state/           # Zustand store and state management
├── public/              # Static assets
│   └── covers/          # Game cover images
└── scripts/             # Build scripts

```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (includes TypeScript compilation, Vite build, and Electron packaging)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## License

This project is available for personal and educational use.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgments

- Game cover art is procedurally generated using SVG gradients
- Built-in game catalog includes popular titles across multiple genres
- Bracket generation algorithms support standard tournament formats
