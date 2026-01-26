# FarmChops VPS Setup Documentation

## Overview

This document explains how to set up a fresh Ubuntu 24.04 VPS for running the FarmChops application, including:
- Production Frontend (farmchops.com)
- Production Backend API (api.farmchops.com)
- Staging Frontend (staging.farmchops.com)
- Staging Backend API (api-staging.farmchops.com)

---

## Table of Contents

1. [Initial Server Connection](#1-initial-server-connection)
2. [System Updates](#2-system-updates)
3. [Installing Node.js](#3-installing-nodejs)
4. [Installing MongoDB](#4-installing-mongodb)
5. [Installing PM2, Nginx, and Git](#5-installing-pm2-nginx-and-git)
6. [Firewall Setup](#6-firewall-setup)
7. [Directory Structure](#7-directory-structure)
8. [Cloning Repositories](#8-cloning-repositories)
9. [Setting Up Production Backend](#9-setting-up-production-backend)
10. [Setting Up Production Frontend](#10-setting-up-production-frontend)
11. [Setting Up Staging Backend](#11-setting-up-staging-backend)
12. [Setting Up Staging Frontend](#12-setting-up-staging-frontend)
13. [Nginx Configuration](#13-nginx-configuration)
14. [SSL Certificates](#14-ssl-certificates)
15. [Database Restoration](#15-database-restoration)
16. [Useful Commands](#16-useful-commands)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. Initial Server Connection

### Command:
```bash
ssh root@YOUR_SERVER_IP
```

### Explanation:
- `ssh` - Secure Shell, a protocol to securely connect to remote servers
- `root` - The username (root is the administrator account)
- `YOUR_SERVER_IP` - Your VPS IP address (e.g., 194.164.76.163)

### If you see "HOST IDENTIFICATION HAS CHANGED" error:
```bash
ssh-keygen -R YOUR_SERVER_IP
```
This removes the old server key from your known hosts file. This happens after a VPS reinstall because the server generates new keys.

---

## 2. System Updates

### Command:
```bash
apt update && apt upgrade -y
```

### Explanation:
- `apt update` - Downloads the latest list of available packages from Ubuntu's repositories
- `&&` - Runs the next command only if the first one succeeds
- `apt upgrade -y` - Installs all available updates
- `-y` - Automatically answers "yes" to prompts

### Why it's important:
Keeps your system secure with the latest security patches.

---

## 3. Installing Node.js

### Commands:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

### Explanation:
- `curl` - A tool to download files from the internet
- `-fsSL` - Flags that mean:
  - `-f` - Fail silently on errors
  - `-s` - Silent mode (no progress bar)
  - `-S` - Show errors if they occur
  - `-L` - Follow redirects
- `https://deb.nodesource.com/setup_20.x` - NodeSource's script to set up Node.js 20.x repository
- `| bash -` - Pipes the downloaded script to bash to execute it
- `apt install -y nodejs` - Installs Node.js from the newly added repository

### Verify installation:
```bash
node --version  # Should show v20.x.x
npm --version   # Should show npm version
```

---

## 4. Installing MongoDB

### Commands:
```bash
# Step 1: Add MongoDB's GPG key (for package verification)
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg

# Step 2: Add MongoDB repository to apt sources
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-8.0.list

# Step 3: Update package list and install MongoDB
apt update && apt install -y mongodb-org

# Step 4: Start MongoDB and enable it to start on boot
systemctl start mongod && systemctl enable mongod
```

### Explanation:
- **Step 1**: Downloads MongoDB's GPG key and converts it to a format apt can use. GPG keys verify that packages are authentic.
- **Step 2**: Adds MongoDB's repository to your system so apt knows where to download MongoDB from.
  - `tee` - Writes to a file with sudo permissions
  - `noble` - Ubuntu 24.04's codename
- **Step 3**: Updates package list to include MongoDB packages, then installs it
- **Step 4**:
  - `systemctl start mongod` - Starts the MongoDB service
  - `systemctl enable mongod` - Makes MongoDB start automatically when server boots

### Verify installation:
```bash
systemctl status mongod  # Should show "active (running)"
mongosh --eval "db.version()"  # Should show MongoDB version
```

### Important Security Note:
MongoDB by default only listens on localhost (127.0.0.1), which is secure. Never expose MongoDB to the internet.

---

## 5. Installing PM2, Nginx, and Git

### Command:
```bash
npm install -g pm2 && apt install -y nginx git
```

### Explanation:
- `npm install -g pm2` - Installs PM2 globally
  - `npm` - Node Package Manager
  - `-g` - Global installation (available system-wide)
  - `pm2` - Process Manager 2, keeps your Node.js apps running

- `apt install -y nginx git` - Installs Nginx and Git
  - `nginx` - Web server that acts as a reverse proxy
  - `git` - Version control system to clone your code

### What each tool does:
| Tool | Purpose |
|------|---------|
| PM2 | Keeps Node.js apps running, restarts them if they crash, manages logs |
| Nginx | Receives web requests, forwards them to your apps, handles SSL |
| Git | Downloads your code from GitHub |

---

## 6. Firewall Setup

### Commands:
```bash
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw --force enable
```

### Explanation:
- `ufw` - Uncomplicated Firewall, Ubuntu's firewall management tool
- `allow 22` - Allows SSH connections (so you can access your server)
- `allow 80` - Allows HTTP traffic (regular web requests)
- `allow 443` - Allows HTTPS traffic (secure web requests)
- `--force enable` - Enables the firewall without confirmation prompt

### Check firewall status:
```bash
ufw status
```

### Why it's important:
The firewall blocks all incoming traffic except what you explicitly allow. This prevents attackers from accessing services they shouldn't.

---

## 7. Directory Structure

### Commands:
```bash
mkdir -p /var/www/production /var/www/staging
```

### Explanation:
- `mkdir` - Make directory
- `-p` - Create parent directories if they don't exist
- Creates this structure:
  ```
  /var/www/
  ├── production/
  │   ├── farmchops-backend/
  │   └── farmchops-frontend/
  └── staging/
      ├── farmchops-backend/
      └── farmchops-frontend/
  ```

### Why this structure:
- Separates production (live) from staging (testing)
- `/var/www` is the standard location for web applications on Linux

---

## 8. Cloning Repositories

### Commands:
```bash
# Production
cd /var/www/production
git clone https://github.com/Farmchops/Farmchops-Backend.git farmchops-backend
git clone https://github.com/Farmchops/FarmChops-Frontend.git farmchops-frontend

# Staging
cd /var/www/staging
git clone https://github.com/Farmchops/Farmchops-Backend.git farmchops-backend
git clone https://github.com/Farmchops/FarmChops-Frontend.git farmchops-frontend
```

### Explanation:
- `cd` - Change directory
- `git clone URL folder-name` - Downloads the repository into the specified folder

### Authentication:
If repos are private, you'll need:
- **Username**: Your GitHub username
- **Password**: A Personal Access Token (NOT your GitHub password)

### Creating a Personal Access Token:
1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token
4. Check "repo" permission
5. Copy the token (you won't see it again!)

---

## 9. Setting Up Production Backend

### Step 1: Navigate and install dependencies
```bash
cd /var/www/production/farmchops-backend
npm install
```

### Explanation:
- `npm install` - Reads `package.json` and installs all required packages into `node_modules/`

### Step 2: Create environment file
```bash
nano .env
```

### Explanation:
- `nano` - A text editor in the terminal
- `.env` - Environment file containing configuration variables
- Press `Ctrl+O` to save, `Enter` to confirm, `Ctrl+X` to exit

### Environment Variables Explained:
```bash
# Database connection string
MONGODB_URI=mongodb://127.0.0.1:27017/test
# 127.0.0.1 = localhost (same server)
# 27017 = MongoDB's default port
# test = database name

# Port your backend runs on
PORT=9880

# Secret key for JWT tokens (authentication)
JWT_SECRET=your-secret-key-here
# Make this long and random for security

# How long JWT tokens last before expiring
JWT_EXPIRES_IN=30d

# Email settings for sending emails
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=support@farmchops.com
EMAIL_PASS=your-email-password

# Payment gateway (Paystack) credentials
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_CALLBACK_URL=https://farmchops.com/order/success

# Frontend URL (for CORS and redirects)
FRONTEND_URL=https://farmchops.com

# Cloud storage for images
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Google Maps for location features
GOOGLE_MAPS_API_KEY=your-google-maps-key
```

### Step 3: Build the application
```bash
npm run build
```

### Explanation:
- Compiles TypeScript code into JavaScript
- Output goes to `dist/` folder
- This is what actually runs in production

### Step 4: Start with PM2
```bash
pm2 start dist/app.js --name "prod-backend"
```

### Explanation:
- `pm2 start` - Starts an application with PM2
- `dist/app.js` - The compiled entry point
- `--name "prod-backend"` - Gives it a memorable name for management

---

## 10. Setting Up Production Frontend

### Step 1: Navigate and install
```bash
cd /var/www/production/farmchops-frontend
npm install
```

### Step 2: Create environment file
```bash
nano .env
```

Content:
```bash
VITE_API_BASE_URL=https://api.farmchops.com/api
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-key
```

### Explanation:
- `VITE_` prefix is required for Vite to expose variables to the frontend
- `API_BASE_URL` tells the frontend where to send API requests

### Step 3: Build the application
```bash
npm run build
```

### Explanation:
- Creates optimized production files in `dist/` folder
- Minifies code, optimizes images, etc.

### Step 4: Install serve and start with PM2
```bash
npm install -g serve
pm2 start "serve -s dist -l 3000" --name "prod-frontend"
```

### Explanation:
- `serve` - A simple static file server
- `-s dist` - Serve files from the `dist` directory in single-page app mode
- `-l 3000` - Listen on port 3000

---

## 11. Setting Up Staging Backend

### Same process as production, but with different values:

```bash
cd /var/www/staging/farmchops-backend
npm install
nano .env
```

### Key differences in .env:
```bash
MONGODB_URI=mongodb://127.0.0.1:27017/farmchops_staging  # Different database!
PORT=9881  # Different port!
FRONTEND_URL=https://staging.farmchops.com
PAYSTACK_CALLBACK_URL=https://staging.farmchops.com/order/success
ADMIN_SIGNUP_URL=https://staging.farmchops.com/admin/signup
```

### Build and start:
```bash
npm run build
pm2 start dist/app.js --name "staging-backend"
```

---

## 12. Setting Up Staging Frontend

```bash
cd /var/www/staging/farmchops-frontend
npm install
nano .env
```

### Content:
```bash
VITE_API_BASE_URL=https://api-staging.farmchops.com/api
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-key
```

### Build and start:
```bash
npm run build
pm2 start "serve -s dist -l 3001" --name "staging-frontend"
```

---

## 13. Nginx Configuration

Nginx acts as a reverse proxy - it receives requests on ports 80/443 and forwards them to your Node.js apps.

### Create configuration files:

#### Production Frontend (/etc/nginx/sites-available/farmchops.com):
```bash
nano /etc/nginx/sites-available/farmchops.com
```

Content:
```nginx
server {
    listen 80;
    server_name farmchops.com www.farmchops.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Explanation:
- `listen 80` - Listen on port 80 (HTTP)
- `server_name` - Which domain names this config handles
- `location /` - For all requests to the root path
- `proxy_pass` - Forward requests to this address
- `proxy_set_header` - Pass along important information to the backend

#### Production API (/etc/nginx/sites-available/api.farmchops.com):
```bash
nano /etc/nginx/sites-available/api.farmchops.com
```

Content:
```nginx
server {
    listen 80;
    server_name api.farmchops.com;

    location / {
        proxy_pass http://127.0.0.1:9880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Staging Frontend (/etc/nginx/sites-available/staging.farmchops.com):
```bash
nano /etc/nginx/sites-available/staging.farmchops.com
```

Content:
```nginx
server {
    listen 80;
    server_name staging.farmchops.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Staging API (/etc/nginx/sites-available/api-staging.farmchops.com):
```bash
nano /etc/nginx/sites-available/api-staging.farmchops.com
```

Content:
```nginx
server {
    listen 80;
    server_name api-staging.farmchops.com;

    location / {
        proxy_pass http://127.0.0.1:9881;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable the sites:
```bash
ln -s /etc/nginx/sites-available/farmchops.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/api.farmchops.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/staging.farmchops.com /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/api-staging.farmchops.com /etc/nginx/sites-enabled/
```

### Explanation:
- `ln -s` - Creates a symbolic link (shortcut)
- Nginx reads from `sites-enabled/` to know which sites to serve
- Files in `sites-available/` are configs, links in `sites-enabled/` activate them

### Test and restart Nginx:
```bash
nginx -t                    # Test configuration for errors
systemctl restart nginx     # Apply changes
```

---

## 14. SSL Certificates

### Install Certbot:
```bash
apt install -y certbot python3-certbot-nginx
```

### Explanation:
- `certbot` - Tool from Let's Encrypt to get free SSL certificates
- `python3-certbot-nginx` - Plugin that automatically configures Nginx

### Get certificates for all domains:
```bash
certbot --nginx -d farmchops.com -d www.farmchops.com -d api.farmchops.com -d staging.farmchops.com -d api-staging.farmchops.com
```

### Explanation:
- `--nginx` - Use the Nginx plugin
- `-d domain` - Each domain to get a certificate for
- Certbot will:
  1. Verify you own the domains
  2. Get certificates from Let's Encrypt
  3. Automatically update Nginx configs to use HTTPS
  4. Set up auto-renewal

### Verify auto-renewal:
```bash
certbot renew --dry-run
```

Certificates expire every 90 days, but Certbot sets up automatic renewal.

---

## 15. Database Restoration

### Backup database (before disaster):
```bash
mongodump --out /root/mongodb-backup
```

### Explanation:
- `mongodump` - MongoDB's backup tool
- `--out /path` - Where to save the backup
- Creates folders for each database with `.bson` files

### Restore database:
```bash
mongorestore /root/mongodb-backup
```

### Explanation:
- `mongorestore` - MongoDB's restore tool
- Reads the backup and imports all databases

### Check available databases:
```bash
mongosh --eval "show dbs"
```

### Connect to a specific database:
```bash
mongosh
use test  # Switch to 'test' database
show collections  # List all collections
db.products.count()  # Count documents in products collection
```

---

## 16. Useful Commands

### PM2 Commands:
```bash
pm2 status              # See all running apps
pm2 logs                # View all logs
pm2 logs prod-backend   # View specific app logs
pm2 restart all         # Restart all apps
pm2 restart prod-backend  # Restart specific app
pm2 stop prod-backend   # Stop an app
pm2 delete prod-backend # Remove an app from PM2
pm2 save                # Save current process list
pm2 startup             # Generate startup script
```

### Nginx Commands:
```bash
nginx -t                    # Test configuration
systemctl restart nginx     # Restart Nginx
systemctl status nginx      # Check status
tail -f /var/log/nginx/error.log    # Watch error log
tail -f /var/log/nginx/access.log   # Watch access log
```

### MongoDB Commands:
```bash
systemctl status mongod     # Check if MongoDB is running
systemctl restart mongod    # Restart MongoDB
mongosh                     # Open MongoDB shell
```

### System Commands:
```bash
htop                    # Interactive process viewer
df -h                   # Disk usage
free -h                 # Memory usage
ufw status              # Firewall status
```

### Update Code from GitHub:
```bash
cd /var/www/production/farmchops-backend
git pull                # Download latest code
npm install             # Install any new dependencies
npm run build           # Rebuild
pm2 restart prod-backend  # Restart
```

---

## 17. Troubleshooting

### App showing errors:
```bash
pm2 logs app-name --lines 50
```

### Nginx not working:
```bash
nginx -t                            # Check for config errors
systemctl status nginx              # Check service status
tail -f /var/log/nginx/error.log   # Check error logs
```

### MongoDB connection failed:
```bash
systemctl status mongod             # Is it running?
systemctl start mongod              # Start it
cat /var/log/mongodb/mongod.log    # Check logs
```

### Port already in use:
```bash
lsof -i :3000           # See what's using port 3000
kill -9 PID             # Kill the process (replace PID)
```

### SSL certificate issues:
```bash
certbot certificates    # List certificates and expiry dates
certbot renew          # Renew certificates
```

### Check what ports are listening:
```bash
ss -tlnp
```

### Server running slow:
```bash
htop                   # Check CPU/memory usage
pm2 monit              # Monitor PM2 apps in real-time
```

---

## Quick Reference - Port Mapping

| Service | Internal Port | External URL |
|---------|--------------|--------------|
| Production Frontend | 3000 | https://farmchops.com |
| Production Backend | 9880 | https://api.farmchops.com |
| Staging Frontend | 3001 | https://staging.farmchops.com |
| Staging Backend | 9881 | https://api-staging.farmchops.com |
| MongoDB | 27017 | localhost only (not exposed) |

---

## Security Best Practices

1. **Never expose MongoDB to the internet** - Keep it bound to 127.0.0.1
2. **Keep system updated** - Run `apt update && apt upgrade -y` regularly
3. **Use strong passwords** - For SSH, database, and all services
4. **Firewall enabled** - Only allow ports 22, 80, 443
5. **Regular backups** - Use `mongodump` before major changes
6. **Monitor your server** - Check `pm2 status` and logs regularly
7. **Update dependencies** - Run `npm audit` to check for vulnerabilities

---

## Emergency Recovery

If your VPS is compromised:

1. **Backup data immediately:**
   ```bash
   mongodump --out /root/mongodb-backup
   ```

2. **Download backup** via FileZilla/SFTP

3. **Reinstall OS** from Hostinger panel

4. **Follow this guide** to set up fresh

5. **Restore database:**
   ```bash
   mongorestore /root/mongodb-backup
   ```

---

*Documentation created: January 23, 2026*
*Last updated: January 23, 2026*
