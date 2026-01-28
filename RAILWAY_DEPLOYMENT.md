# Railway Deployment Guide

## Prerequisites
1. Railway account (sign up at https://railway.app)
2. Git repository with your code

## Step-by-Step Deployment

### 1. Create New Railway Project
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select this repository

### 2. Add MySQL Database
1. In your Railway project dashboard, click "New Service"
2. Select "Database" → "MySQL"
3. Railway will automatically create a MySQL instance

### 3. Configure Environment Variables
In your Railway project settings, add these environment variables:

**Required Variables:**
- `DB_HOST`: (Auto-filled by Railway MySQL service)
- `DB_USER`: (Auto-filled by Railway MySQL service) 
- `DB_PASSWORD`: (Auto-filled by Railway MySQL service)
- `DB_NAME`: (Auto-filled by Railway MySQL service)
- `SESSION_SECRET`: Generate a secure random string
- `NODE_ENV`: production

**Railway will automatically provide database connection variables when you add the MySQL service.**

### 4. Database Setup
After deployment, you need to initialize your database:

1. Go to Railway dashboard → Your project → MySQL service
2. Click "Connect" and copy the connection command
3. Use a MySQL client or Railway's built-in query editor to run:
   - First: `schema_updated.sql`
   - Then: `data.sql`

Alternatively, you can run the initialization script:
```bash
node init-db.js
```

### 5. Deploy
1. Push your code to GitHub
2. Railway will automatically detect changes and deploy
3. Your app will be available at the Railway-provided URL

## Important Notes

### Database Connection
- Railway provides connection variables automatically
- The app connects using environment variables
- Connection pooling is configured for production

### Session Management
- Sessions are stored in MySQL using express-mysql-session
- Make sure SESSION_SECRET is set to a secure random string

### File Uploads
- The app serves static files from the `public` directory
- Fonts are stored in `controllers/fonts/`

### Security
- HTTPS is automatically enabled on Railway
- Session cookies are configured for production
- CORS is configured in the application

## Troubleshooting

### Common Issues:
1. **Database Connection Failed**: Check environment variables
2. **Session Issues**: Verify SESSION_SECRET is set
3. **Static Files Not Loading**: Check file paths in public directory

### Logs:
View logs in Railway dashboard → Your service → Logs tab

### Database Access:
Use Railway's built-in database browser or connect with:
```bash
mysql -h [DB_HOST] -u [DB_USER] -p[DB_PASSWORD] [DB_NAME]
```

## Post-Deployment
1. Test login functionality
2. Verify database connections
3. Check all routes are working
4. Test file uploads and PDF generation