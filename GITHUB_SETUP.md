# GitHub Setup Guide

Follow these steps to connect your project to an existing GitHub repository and push updates.

## Step 1: Initialize Git (if not already done)

```bash
git init
```

## Step 2: Add Your Remote Repository

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub username and repository name:

```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
```

Or if you prefer SSH:

```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

## Step 3: Stage All Files

```bash
git add .
```

## Step 4: Create Initial Commit

```bash
git commit -m "Initial commit: Paralogue app with Supabase authentication"
```

## Step 5: Set Default Branch (if needed)

```bash
git branch -M main
```

## Step 6: Push to GitHub

### First time push (if the repo is empty):

```bash
git push -u origin main
```

### If the repo already has content:

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

## Step 7: Verify Connection

```bash
git remote -v
```

This should show your remote repository URL.

## Future Updates

After making changes, use these commands to push updates:

```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "Description of your changes"

# Push to GitHub
git push
```

## Important Notes

- Your `.env.local` file is already in `.gitignore` and will NOT be pushed to GitHub
- Never commit API keys or sensitive information
- The `node_modules` folder is also ignored (as it should be)

