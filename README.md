## Welcome to Paralogue!

This is a Copilot for Indie Game Developers who aspire to turn their amazing story ideas to life.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to **Settings** → **API** and copy:
   - Your **Project URL** (looks like `https://xxxxx.supabase.co`)
   - Your **anon/public key** (starts with `eyJ...`)

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory of the project and add your keys:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here
```

**Where to get your OpenAI API key:**
1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key and paste it into your `.env.local` file

### 4. Set Up Supabase Database

1. In your Supabase project dashboard, go to **SQL Editor**
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste it into the SQL Editor and run it
4. This will create:
   - A `profiles` table for user information
   - A `chat_messages` table for storing chat history (optional)
   - Row Level Security policies
   - Triggers to automatically create profiles when users sign up

### 5. Configure Supabase Authentication

1. In your Supabase project dashboard, go to **Authentication** → **URL Configuration**
2. Set the **Site URL** to `http://localhost:3000` (for development)
3. Add `http://localhost:3000/auth/callback` to **Redirect URLs**

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

**Important:** 
- You'll be redirected to the login page if you're not authenticated
- Create an account or sign in to access the Copilot
- The `.env.local` file is already in `.gitignore` and will not be committed to version control
- Never share your API keys publicly

## Project Structure

- `src/app/page.tsx` - Main chat interface (protected route)
- `src/app/login/page.tsx` - Sign in page
- `src/app/signup/page.tsx` - Sign up page
- `src/app/api/chat/route.ts` - Server-side API route for OpenAI chat completions
- `src/app/components/TypingAnimation.tsx` - Loading animation component
- `src/lib/supabase/` - Supabase client configuration
- `src/middleware.ts` - Middleware for protecting routes
- `supabase/migrations/` - Database migration files

## Authentication Flow

1. Users must sign up or log in to access the Copilot
2. Middleware automatically protects all routes except `/login` and `/signup`
3. After authentication, users are redirected to the main chat interface
4. User sessions are managed by Supabase Auth

## Technologies Used

- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Supabase (Authentication & Database)
- OpenAI API
