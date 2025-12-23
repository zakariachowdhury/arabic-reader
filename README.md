# TaskFlow - Modern Task Management

A premium, high-performance Todo application built with cutting-edge technologies.

- **Framework:** [Next.js (App Router)](https://nextjs.org/)
- **Authentication:** [Better Auth](https://better-auth.com)
- **Email:** [Resend](https://resend.com)
- **Database:** [Neon Postgres](https://neon.tech/)
- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)
- **Styling:** [Vanilla CSS & Tailwind CSS](https://tailwindcss.com/)

## Features
- **Modern Auth:** Secure signup and login with Better Auth.
- **Welcome Emails:** Automated personalized welcome emails via Resend.
- **Personalization:** Users can update their full name in settings.
- **Account Management:** Full control with secure account deletion and confirmation.
- **Task Management:** Create, toggle, and manage tasks with real-time UI updates.
- **Admin Panel:** Full CRUD operations for managing users and todos across the platform.
- **Premium UI:** Sleek, responsive design with glassmorphism and smooth animations.

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
   NEXT_PUBLIC_APP_NAME=TaskFlow
   ```
   *Note: You can generate secret with this command `openssl rand -base64 32`. `BETTER_AUTH_URL` is automatically inferred from your environment in development (localhost:3000). For production, set it in Vercel environment variables.*

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

> **Note:** The admin panel is accessible at `/admin` and includes:
> - Dashboard with platform statistics
> - User management (view, edit, delete users, manage admin permissions)
> - Todo management (view, edit, delete todos from any user)

### 6. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Server Deployment (Vercel)

1. Push your code to a GitHub repository.
2. Connect the repository to [Vercel](https://vercel.com/).
3. Add the following **Environment Variables**:
   - `NEXT_PUBLIC_APP_NAME`: Your desired application name.
   - `DATABASE_URL`: Your Neon connection string.
   - `BETTER_AUTH_SECRET`: A long random string.
   - `RESEND_API_KEY`: Your Resend API key.
   - `BETTER_AUTH_URL`: Your production URL (e.g., `https://your-app.vercel.app`). This is required to prevent "Invalid origin" errors during authentication.
   
   **Important:** Set `BETTER_AUTH_URL` to your exact production domain. For preview deployments, the app will automatically use `VERCEL_URL`, but production requires this to be explicitly set.
   
4. Deploy!

---

## Tech Stack Notes
- **Hosting:** Vercel for seamless Git-to-Deploy workflow.
- **Driver:** `@neondatabase/serverless` for optimized HTTP connections.
- **UI:** Custom styled components with Tailwind CSS for layout and modern aesthetics.
- **Hooks:** Built-in Better Auth hooks for background operations (like sending welcome emails).
