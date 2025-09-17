# AHDAF - Alqefari Family Tree Application

A premium iOS-first family tree visualization application built with React Native

## 🌟 Features

- **Interactive Family Tree Visualization** - Smooth pan, zoom, and navigation through large family trees
- **Admin Mode** - Comprehensive editing capabilities for authorized users
- **Real-time Updates** - Live synchronization across all connected clients
- **Arabic-First Design** - Full RTL support with SF Arabic font integration
- **Scalable Architecture** - Optimized for trees with 10,000+ nodes

## 🛠 Tech Stack

- **Frontend**: React Native (Expo SDK 53)
- **Database**: Supabase (PostgreSQL)
- **Rendering**: React Native Skia for high-performance graphics
- **State Management**: Zustand
- **Styling**: NativeWind (Tailwind CSS)
- **Animations**: React Native Reanimated 3

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for iOS development)
- Supabase account

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone [your-repo-url]
   cd AlqefariTreeRN-Expo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Frontend environment variables
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # Supabase CLI variables (for database operations)
   SUPABASE_DB_PASSWORD=your_database_password
   ```

4. **Initialize Supabase**
   ```bash
   supabase init
   supabase link --project-ref your_project_ref
   supabase db push
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Run on iOS Simulator**
   Press `i` in the terminal or use Expo Go app

## 📱 Admin Setup

For testing admin features, see `TEST_ADMIN_SETUP.md` for quick setup instructions.

## 📂 Project Structure

```
AlqefariTreeRN-Expo/
├── src/
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (AdminMode, etc.)
│   ├── hooks/          # Custom React hooks
│   ├── screens/        # Screen components
│   ├── services/       # API and external services
│   ├── stores/         # Zustand stores
│   └── utils/          # Utility functions
├── docs/               # Documentation
├── supabase/          # Database migrations and functions
└── assets/            # Images, fonts, and static files
```

## 🎨 Design System

The app uses a custom "Liquid Glass" design system featuring:
- Glass morphism effects with backdrop blur
- Smooth spring animations
- Haptic feedback integration
- Consistent spacing and typography
- Premium iOS-native feel

## 🔧 Development

### Key Commands

- `npm start` - Start the Expo development server (with iOS and Android)
- `npm run ios` - Run on iOS simulator only
- `npm run android` - Run on Android emulator only

### Code Style

- Follow the existing code patterns
- Use TypeScript for new components
- Maintain RTL support in all UI elements
- Add proper error handling and logging

## 📖 Documentation

- `PROJECT_ROADMAP.md` - Development roadmap and completed features
- `CLAUDE.md` - AI collaboration guidelines
- `docs/` - Technical documentation and guides

## 🤝 Contributing

This is a private family project. For any questions or access requests, please contact the project maintainer.

## 📄 License

Private and confidential. All rights reserved.
