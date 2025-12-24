# Arabic Reader - AI-Powered Arabic Learning Platform

A modern, intelligent Arabic learning application that combines structured content with AI-powered assistance to help users master Arabic vocabulary and reading skills.

- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/)
- **Authentication:** [Better Auth](https://better-auth.com)
- **Email:** [Resend](https://resend.com)
- **Database:** [Neon Postgres](https://neon.tech/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **AI:** [OpenRouter](https://openrouter.ai/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)

## Features

### Learning Features
- **Structured Content:** Books organized into units and lessons for progressive learning
- **Vocabulary Learning:** Arabic-English vocabulary words with flashcards
- **Multiple Learning Modes:**
  - **Learn Mode:** Interactive flashcards for vocabulary study
  - **Practice Mode:** Interactive practice exercises
  - **Test Mode:** Quiz and assessment tools
- **Progress Tracking:** Track your progress on vocabulary words with seen/mastered status
- **Activity Analytics:** View detailed activity metrics and learning statistics
- **Groups:** Organize content and learning materials with custom groups

### AI-Powered Features
- **AI Learning Assistant:** Get instant help with vocabulary, grammar, and reading comprehension
- **Smart Navigation:** AI helps you quickly jump to lessons, vocabulary, and practice exercises
- **Personalized Guidance:** Receive tailored practice suggestions based on your progress
- **Context-Aware Help:** AI understands your learning context and provides relevant assistance
- **Resume Learning:** AI helps you continue where you left off with direct navigation links

### User Features
- **Modern Auth:** Secure signup and login with email verification via Better Auth
- **Welcome Emails:** Automated personalized welcome emails via Resend
- **Account Management:** Update profile, manage settings, and control account preferences
- **AI Toggle:** Enable/disable AI features per user
- **Default Groups:** Set default learning groups for personalized experience

### Admin Features
- **Comprehensive Admin Panel:** Full management interface for all platform content
- **Book Management:** Create, edit, and organize books
- **Unit & Lesson Management:** Structure learning content hierarchically
- **Vocabulary Management:** Add and manage Arabic-English vocabulary words
- **User Management:** Manage users, permissions, and admin access
- **Group Management:** Organize and manage user groups
- **Activity Analytics:** View platform-wide analytics and user activity metrics
- **AI Configuration:** Configure OpenRouter API settings, supported models, and defaults
- **Global AI Toggle:** Enable/disable AI features globally
- **Todo Management:** Manage todos across the platform

---

## Local Setup

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd arabic-reader
```

### 2. Install dependencies
```bash
npm install
```

### 3. Database & App Configuration
1. Create a [Neon](https://neon.tech/) account and a new project.
2. Create a [Resend](https://resend.com/) account and get an API key.
3. Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
   BETTER_AUTH_SECRET=your_super_secret_string
   RESEND_API_KEY=your_resend_api_key
   NEXT_PUBLIC_APP_NAME=Arabic Reader
   BETTER_AUTH_URL=http://localhost:3000
   ```
   *Note: You can generate a secret with this command `openssl rand -base64 32`. `BETTER_AUTH_URL` is automatically inferred from your environment in development (localhost:3000). For production, set it in Vercel environment variables.*

### 4. Run Migrations
Generate and run migrations to set up your database schema:
```bash
npx drizzle-kit push
```

### 5. Set Up Admin User
After running migrations and creating a user account, set the first admin user:

**Option 1: Using the Setup Script (Recommended)**
```bash
npx tsx src/app/admin/setup-admin.ts user@example.com
```

**Option 2: Direct SQL Query**
If you have direct database access, you can run:
```sql
UPDATE "user" 
SET "is_admin" = true, "updated_at" = NOW() 
WHERE "email" = 'user@example.com';
```

**Option 3: Through Admin Panel**
Once you have at least one admin user:
1. Log in as that admin
2. Navigate to `/admin/users`
3. Click the edit icon next to any user
4. Check the "Admin" checkbox
5. Click save

### 6. Configure AI (Optional)
To enable AI features, configure OpenRouter settings:
1. Log in as an admin user
2. Navigate to `/admin` (Admin Dashboard)
3. Go to the AI Settings section
4. Add your OpenRouter API key
5. Configure supported models and default model

> **Note:** The admin panel is accessible at `/admin` and includes:
> - Dashboard with platform statistics
> - Book, Unit, and Lesson management
> - Vocabulary word management
> - User management (view, edit, delete users, manage admin permissions)
> - Group management
> - Activity analytics
> - AI configuration
> - Todo management

### 7. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Server Deployment (Vercel)

1. Push your code to a GitHub repository.
2. Connect the repository to [Vercel](https://vercel.com/).
3. Add the following **Environment Variables**:
   - `NEXT_PUBLIC_APP_NAME`: Your desired application name (e.g., "Arabic Reader").
   - `DATABASE_URL`: Your Neon connection string.   
   - `RESEND_API_KEY`: Your Resend API key.
   - `BETTER_AUTH_SECRET`: A long random string.   
   - `BETTER_AUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`). This is required to prevent "Invalid origin" errors during authentication.
   
   **Important:** Set `BETTER_AUTH_URL` to your exact production domain. For preview deployments, the app will automatically use `VERCEL_URL`, but production requires this to be explicitly set.
   
4. Deploy!

**Note:** AI features require OpenRouter API key configuration through the admin panel after deployment. The API key is stored in the database, not as an environment variable.

---

## Tech Stack Notes

- **Hosting:** Vercel for seamless Git-to-Deploy workflow.
- **Database Driver:** `@neondatabase/serverless` for optimized HTTP connections.
- **UI:** Custom styled components with Tailwind CSS for modern, responsive design.
- **AI Integration:** OpenRouter API for flexible AI model access (configurable via admin panel).
- **Authentication Hooks:** Built-in Better Auth hooks for background operations (like sending welcome emails).
- **Progress Tracking:** Real-time progress tracking with user-specific vocabulary statistics.

---

## Project Structure

- **Books:** Top-level learning content containers
- **Units:** Chapters or sections within books
- **Lessons:** Individual learning sessions within units
- **Vocabulary Words:** Arabic-English word pairs organized by lesson
- **User Progress:** Tracks seen/mastered status and practice statistics
- **Groups:** User-defined organization for content and todos
- **AI Assistant:** Context-aware learning assistant powered by OpenRouter

---

## Learning Workflow

1. **Browse Books:** Start by exploring available books on the main books page
2. **Select a Book:** Choose a book to see its units and lessons
3. **Study Lessons:** Navigate through units and lessons
4. **Learn Vocabulary:** Use flashcards to study Arabic-English vocabulary
5. **Practice:** Engage with interactive practice exercises
6. **Test:** Take quizzes to assess your knowledge
7. **Track Progress:** Monitor your learning progress and activity
8. **Get AI Help:** Use the AI assistant for instant help and guidance

---

## License

This project is private and proprietary.
