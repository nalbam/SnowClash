# Deployment Guide

This guide covers deploying SnowClash to production.

## Prerequisites

- Node.js 16+ installed on your server
- A domain name (optional but recommended)
- SSL certificate (for HTTPS, required for Google OAuth in production)

## Build for Production

1. Build the server:
   ```bash
   npm run build:server
   ```

2. Build the client:
   ```bash
   npm run build
   ```

3. The built files will be in:
   - Server: `dist/server/`
   - Client: `public/`

## Deployment Options

### Option 1: Traditional Server (VPS/Dedicated Server)

1. **Upload files to your server:**
   ```bash
   # Upload the entire project or just the necessary files:
   - dist/
   - public/
   - node_modules/
   - package.json
   ```

2. **Install dependencies (if not uploaded):**
   ```bash
   npm install --production
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Use a process manager (recommended):**
   ```bash
   # Install PM2
   npm install -g pm2
   
   # Start the server
   pm2 start dist/server/index.js --name snowclash
   
   # Save process list
   pm2 save
   
   # Setup startup script
   pm2 startup
   ```

5. **Configure Nginx as reverse proxy:**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       # Redirect to HTTPS
       return 301 https://$server_name$request_uri;
   }
   
   server {
       listen 443 ssl http2;
       server_name yourdomain.com;
       
       ssl_certificate /path/to/certificate.crt;
       ssl_certificate_key /path/to/private.key;
       
       # Serve static files
       location / {
           root /path/to/SnowClash/public;
           try_files $uri $uri/ /index.html;
       }
       
       # WebSocket and API proxy
       location /api {
           proxy_pass http://localhost:2567;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

### Option 2: Heroku

1. **Create a `Procfile`:**
   ```
   web: npm start
   ```

2. **Update server to use PORT environment variable** (already done in `src/server/index.ts`)

3. **Deploy:**
   ```bash
   # Login to Heroku
   heroku login
   
   # Create app
   heroku create your-snowclash-app
   
   # Add buildpack
   heroku buildpacks:set heroku/nodejs
   
   # Deploy
   git push heroku main
   ```

4. **Set environment variables:**
   ```bash
   heroku config:set NODE_ENV=production
   ```

### Option 3: Docker

1. **Create `Dockerfile`:**
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY package*.json ./
   RUN npm install --production
   
   COPY . .
   RUN npm run build:server
   RUN npm run build
   
   EXPOSE 2567
   
   CMD ["npm", "start"]
   ```

2. **Create `.dockerignore`:**
   ```
   node_modules
   npm-debug.log
   dist
   .git
   .gitignore
   ```

3. **Build and run:**
   ```bash
   # Build image
   docker build -t snowclash .
   
   # Run container
   docker run -p 2567:2567 snowclash
   ```

### Option 4: Cloud Platforms

#### AWS (Elastic Beanstalk)

1. Install EB CLI:
   ```bash
   pip install awsebcli
   ```

2. Initialize and deploy:
   ```bash
   eb init
   eb create snowclash-env
   eb deploy
   ```

#### Google Cloud (App Engine)

1. Create `app.yaml`:
   ```yaml
   runtime: nodejs18
   
   instance_class: F2
   
   env_variables:
     NODE_ENV: production
   
   handlers:
   - url: /.*
     script: auto
     secure: always
   ```

2. Deploy:
   ```bash
   gcloud app deploy
   ```

## Environment Variables

Set these environment variables in production:

- `PORT`: Server port (default: 2567)
- `NODE_ENV`: Set to "production"
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID (for future enhancement)

## Post-Deployment Checklist

- [ ] Server is running and accessible
- [ ] WebSocket connections are working
- [ ] SSL/HTTPS is enabled
- [ ] Google OAuth is configured with production domain
- [ ] CORS is properly configured
- [ ] Error logging is set up
- [ ] Monitoring is in place
- [ ] Regular backups are configured
- [ ] Load testing completed
- [ ] Security audit performed

## Scaling Considerations

For larger deployments:

1. **Use Colyseus Cloud**: The easiest way to scale
   - Visit: https://cloud.colyseus.io
   - Automatic scaling and load balancing

2. **Manual Scaling**:
   - Use Redis for state synchronization
   - Deploy multiple server instances
   - Use a load balancer (nginx, HAProxy)
   - Implement session stickiness for WebSocket connections

3. **Database** (for future enhancements):
   - Add PostgreSQL/MongoDB for persistent data
   - Store player profiles, match history, rankings

## Monitoring

Recommended monitoring tools:

- **Application**: PM2, New Relic, DataDog
- **Server**: Prometheus, Grafana
- **Logs**: Winston, ELK Stack
- **Uptime**: UptimeRobot, Pingdom

## Troubleshooting

**WebSocket connection fails:**
- Check firewall rules allow WebSocket connections
- Verify proxy configuration supports WebSocket upgrade
- Check SSL certificate is valid

**High latency:**
- Use a CDN for static assets
- Deploy servers closer to users
- Optimize game state synchronization

**Server crashes:**
- Check logs for errors
- Ensure sufficient memory/CPU
- Implement proper error handling
- Use PM2 for automatic restarts

## Security

Production security checklist:

- [ ] Enable HTTPS
- [ ] Validate all user inputs
- [ ] Implement rate limiting
- [ ] Use helmet.js for security headers
- [ ] Keep dependencies updated
- [ ] Monitor for security vulnerabilities
- [ ] Implement proper authentication
- [ ] Use secure WebSocket (wss://)

## Support

For issues or questions:
- Check the [Colyseus documentation](https://docs.colyseus.io)
- Visit [Phaser documentation](https://photonstorm.github.io/phaser3-docs/)
- Create an issue on GitHub
