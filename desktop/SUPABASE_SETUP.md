# Supabase Setup Instructions

## Quick Setup

Your Supabase URL is already configured in the app: `https://msomzmvhvgsxfxrpvrzp.supabase.co`

### 1. Get Your Supabase Anon Key

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/msomzmvhvgsxfxrpvrzp
2. Navigate to **Settings** → **API**
3. Copy your **anon/public** key (starts with `eyJ...`)

### 2. Set the Anon Key

**Option A: Environment Variable (Recommended)**
```bash
export SUPABASE_ANON_KEY=your_anon_key_here
```

Then run the app:
```bash
cd desktop
npm run electron:dev
```

**Option B: Settings Page**
- If the app shows the Settings page, paste your anon key there
- Click "Save Settings"

### 3. Run the Database Schema

1. Go to your Supabase SQL Editor: https://supabase.com/dashboard/project/msomzmvhvgsxfxrpvrzp/sql
2. Copy the contents of `desktop/supabase/setup.sql`
3. Paste and run it in the SQL Editor

This will create:
- `games` table for storing game projects
- `game_files` table for tracking game files
- Storage bucket `gamefiles` for file storage
- Row Level Security policies
- Indexes for performance

### 4. Enable Email Authentication

1. Go to **Authentication** → **Providers** in your Supabase dashboard
2. Make sure **Email** is enabled
3. Configure email templates if needed (optional)

## Notes

- **User signups/logins are handled automatically** by Supabase Auth
- No custom table needed for users - Supabase uses `auth.users` automatically
- The app will use your Supabase URL by default
- You only need to provide the anon key (via environment variable or Settings)

## Testing

After setup:
1. Run the app
2. Click "Sign Up" on the login screen
3. Enter your email and password
4. Check your email for the verification link (if email confirmation is enabled)
5. Sign in and start building games!

