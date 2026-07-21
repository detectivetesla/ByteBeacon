# ByteBeacon Railway Hosting Guide

This document contains all the steps required to deploy the ByteBeacon VTU Data Hub to Railway.app.

## 6. Google Auth Setup (Sign in with Google)
To enable Google Login on your live site, you must create a "Client ID" in the Google Cloud Console and link it to Vercel.

### Step 1: Create Google Credentials
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project (e.g., "ByteBeacon").
3.  Go to **APIs & Services > Credentials**.
4.  Click **CREATE CREDENTIALS** > **OAuth client ID**.
5.  If prompted, configure your **OAuth Consent Screen** (choose "External" and add your email).
6.  **Application Type**: Select "Web application".
7.  **Name**: "ByteBeacon Live".

### Step 2: Configure Domains (Critical)
1.  **Authorized JavaScript Origins**:
    - `https://www.bytebeacon.online`
    - `https://bytebeacon.online`
    - `http://localhost:5173` (for local testing)
2.  **Authorized Redirect URIs**:
    - `https://www.bytebeacon.online`
    - `http://localhost:5173`

### Step 3: Link to Vercel
1.  Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
2.  Go to **Vercel Settings > Environment Variables**.
3.  Add Key: `VITE_GOOGLE_CLIENT_ID`
4.  Add Value: (Paste your Client ID)
5.  **Redeploy**: Go to the **Deployments** tab and click **Redeploy** on your latest build.

> [!TIP]
> Google Auth often fails if you use **Ad-blockers**. If you get an error, try testing in **Incognito/Private Mode**.

## 1. Database Setup (MySQL)
1.  Log in to [Railway.app](https://railway.app/).
2.  Click **+ New** > **Database** > **Add MySQL**.
3.  Go to the **Data** tab in the MySQL service.
4.  Copy the content of `database/mysql_schema.sql` from your project.
5.  Paste it into the SQL console in Railway and run it to create your tables.

## 2. Backend API Deployment
1.  Click **+ New** > **GitHub Repo** > Select your `ByteBeacon` repository.
2.  Go to **Settings** and set:
    *   **Root Directory**: `backend`
    *   **Custom Build Command**: `npm install`
    *   **Custom Start Command**: `node server.js`
3.  Go to **Variables** and add these references:
    *   `DB_HOST`: `${{MySQL.MYSQLHOST}}`
    *   `DB_USER`: `${{MySQL.MYSQLUSER}}`
    *   `DB_PASS`: `${{MySQL.MYSQLPASSWORD}}`
    *   `DB_NAME`: `${{MySQL.MYSQLDATABASE}}`
    *   `DB_PORT`: `${{MySQL.MYSQLPORT}}`
    *   `JWT_SECRET`: (Any random secure string)
    *   `NODE_ENV`: `production`
    *   `SMTP_HOST`: `smtp.gmail.com`
    *   `SMTP_PORT`: `587`
    *   `SMTP_USER`: (Your email address)
    *   `SMTP_PASS`: (Your 16-digit Google App Password)
    *   `FRONTEND_URL`: `https://<your-frontend-domain>.up.railway.app`
4.  Go to **Settings** and click **Generate Domain** to get your API URL.

## 3. Frontend Web Deployment
1.  Click **+ New** > **GitHub Repo** > Select your `ByteBeacon` repository (again).
2.  Go to **Settings** and set:
    *   **Root Directory**: `/` (the root of the project)
3.  Go to **Variables** and add:
    *   `VITE_API_URL`: `https://<your-backend-domain>.up.railway.app/api`
4.  Wait for the build to finish.
5.  Go to **Settings** and click **Generate Domain** to get your public website URL.

---
**Note**: Ensure your backend URL in `VITE_API_URL` always ends with `/api`.
