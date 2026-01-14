# Release Guide

This document describes how to create a new release of SnowClash.

## Release Process

When you push a tag starting with `v`, the GitHub Actions workflow will automatically:

1. **Build and deploy the client** to GitHub Pages
2. **Build and push the Docker image** to GitHub Container Registry (ghcr.io)

## Creating a Release

### 1. Update Version

Update the version in `package.json`:

```json
{
  "version": "1.2.3"
}
```

### 2. Commit Changes

```bash
git add package.json
git commit -m "chore: bump version to 1.2.3"
```

### 3. Create and Push Tag

```bash
# Create tag
git tag v1.2.3

# Push commit and tag
git push origin main
git push origin v1.2.3
```

Or use a single command:

```bash
# Create annotated tag with message
git tag -a v1.2.3 -m "Release v1.2.3"

# Push both commit and tag
git push origin main --follow-tags
```

## Version Naming

Follow [Semantic Versioning](https://semver.org/):

- **Major version** (v1.0.0 → v2.0.0): Breaking changes
- **Minor version** (v1.0.0 → v1.1.0): New features (backward compatible)
- **Patch version** (v1.0.0 → v1.0.1): Bug fixes (backward compatible)

Examples:
- `v1.0.0` - Initial release
- `v1.1.0` - Added new game mode
- `v1.1.1` - Fixed collision detection bug
- `v2.0.0` - Changed server API (breaking)

## What Gets Built

### Client (GitHub Pages)

- Location: `https://<username>.github.io/SnowClash/`
- Contents: Static HTML/JS/CSS client
- Configured to connect to the server URL specified in repository variables

### Docker Image (GitHub Container Registry)

- Registry: `ghcr.io/<username>/snowclash`
- Tags created for each release:
  - `v1.2.3` - Full version
  - `v1.2` - Minor version
  - `v1` - Major version
  - `latest` - Latest release

Example tags for release `v1.2.3`:
```
ghcr.io/<username>/snowclash:v1.2.3
ghcr.io/<username>/snowclash:v1.2
ghcr.io/<username>/snowclash:v1
ghcr.io/<username>/snowclash:latest
```

## Using the Docker Image

### Pull and Run

```bash
# Pull latest version
docker pull ghcr.io/<username>/snowclash:latest

# Run server
docker run -d \
  -p 2567:2567 \
  -e NODE_ENV=production \
  -e PORT=2567 \
  ghcr.io/<username>/snowclash:latest
```

### Run Specific Version

```bash
docker run -d \
  -p 2567:2567 \
  ghcr.io/<username>/snowclash:v1.2.3
```

### Docker Compose

```yaml
version: '3.8'

services:
  snowclash:
    image: ghcr.io/<username>/snowclash:latest
    ports:
      - "2567:2567"
    environment:
      - NODE_ENV=production
      - PORT=2567
      - REDIS_URL=redis://redis:6379
      - ALLOWED_ORIGINS=https://yourdomain.com
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped
```

## Configuration

### Repository Variables

Set these in GitHub repository settings (Settings → Secrets and variables → Actions → Variables):

- `SERVER_URL`: Default server URL for client builds (e.g., `game.example.com:2567`)

### Manual Deployment

You can also trigger deployment manually from GitHub Actions:

1. Go to **Actions** tab
2. Select **Release** workflow
3. Click **Run workflow**
4. Optionally specify a custom `SERVER_URL`

## Troubleshooting

### Build Fails

Check the GitHub Actions logs:
1. Go to **Actions** tab
2. Click on the failed workflow run
3. Check the logs for errors

Common issues:
- **TypeScript errors**: Run `npm run typecheck` locally
- **Build errors**: Run `npm run build` locally
- **Docker build errors**: Test `docker build .` locally

### Docker Image Not Found

Make sure:
1. The tag was pushed successfully
2. The GitHub Actions workflow completed
3. The repository has **Packages** enabled
4. You have permission to access the package

### Client Shows Wrong Server URL

The client is built with `SERVER_URL` set at build time. To update:
1. Update the `SERVER_URL` repository variable
2. Create a new release tag
3. Wait for deployment to complete

## Monitoring Releases

- **GitHub Pages deployment**: Check Actions → Release workflow → Deploy step
- **Docker images**: Visit `https://github.com/<username>/SnowClash/pkgs/container/snowclash`
- **Client URL**: `https://<username>.github.io/SnowClash/`

## Rolling Back

To rollback to a previous version:

### Client (GitHub Pages)

1. Delete the current tag: `git tag -d v1.2.3 && git push origin :v1.2.3`
2. Re-tag the previous commit: `git tag v1.2.2 <commit-hash> && git push origin v1.2.2`

### Docker Image

Simply pull and use a previous tag:

```bash
docker pull ghcr.io/<username>/snowclash:v1.2.2
```

## CI/CD Pipeline

```
Tag pushed (v*)
       ↓
┌──────────────────────────────────────┐
│     GitHub Actions Triggered         │
└──────────────────────────────────────┘
       ↓
┌──────────────────┬───────────────────┐
│  Build Client    │  Build Docker     │
│  ↓               │  ↓                │
│  Deploy to       │  Push to          │
│  GitHub Pages    │  ghcr.io          │
└──────────────────┴───────────────────┘
       ↓
   Release Complete
```
