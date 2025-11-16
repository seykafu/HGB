# Building with Supabase Configuration

This guide explains how to bundle your Supabase anon key directly into the desktop app so users don't need to configure it manually.

## Option 1: Using Environment Variables (Recommended)

Set the environment variables before building:

```bash
export VITE_SUPABASE_URL=https://msomzmvhvgsxfxrpvrzp.supabase.co
export VITE_SUPABASE_ANON_KEY=your_anon_key_here

cd desktop
npm run build:mac
```

The key will be bundled into the app at build time.

## Option 2: Using .env.local File

1. Create a `.env.local` file in the `desktop/` directory:

```bash
cd desktop
cat > .env.local << EOF
VITE_SUPABASE_URL=https://msomzmvhvgsxfxrpvrzp.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
EOF
```

2. Build the app:

```bash
npm run build:mac
```

## Option 3: Using Vercel Environment Variables

If you're using Vercel for CI/CD:

1. Go to your Vercel project settings
2. Add environment variables:
   - `VITE_SUPABASE_URL` = `https://msomzmvhvgsxfxrpvrzp.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your anon key
3. In your build command, use:

```bash
npm run build && electron-builder --mac
```

## Getting Your Supabase Anon Key

1. Go to https://supabase.com/dashboard/project/msomzmvhvgsxfxrpvrzp/settings/api
2. Copy the **anon/public** key (starts with `eyJ...`)
3. Use it in one of the methods above

## How It Works

- The `VITE_` prefix tells Vite to expose these variables to the client code
- During build, Vite replaces `import.meta.env.VITE_SUPABASE_ANON_KEY` with the actual value
- The key is bundled into the JavaScript bundle (it's safe - anon keys are public)
- Users can still override it in Settings if needed (user settings take priority)

## Security Note

The Supabase anon key is **safe to bundle** in client applications. It's designed to be public and is protected by Row Level Security (RLS) policies in your Supabase database. However, make sure your RLS policies are properly configured!

## Fallback Behavior

The app checks for the Supabase key in this order:
1. **User settings** (highest priority - if user configured it in Settings)
2. **Build-time config** (bundled in app)
3. **Runtime environment variable** (for development)
4. **Error** (if none found)

This means users can still override the bundled key in Settings if needed.

