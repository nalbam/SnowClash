# Google OAuth Setup Guide

This guide will help you set up Google OAuth authentication for SnowClash.

## Steps to Enable Google Sign-In

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API for your project

### 2. Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Configure the OAuth consent screen if you haven't already
4. Select "Web application" as the application type
5. Add authorized JavaScript origins:
   - `http://localhost:8080` (for development)
   - Your production domain (when deployed)
6. Add authorized redirect URIs:
   - `http://localhost:8080` (for development)
   - Your production domain (when deployed)
7. Click "Create"
8. Copy your Client ID

### 3. Update Your Application

1. Open `src/client/index.html`
2. Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Google Client ID:
```html
<meta name="google-signin-client_id" content="YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com">
```

### 4. Implement Full Google Sign-In (Optional Enhancement)

The current implementation includes a simplified sign-in for demonstration purposes. To implement full Google OAuth:

1. Update `LobbyScene.ts` to use the Google Sign-In API:
```typescript
private initGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
    callback: this.handleGoogleResponse.bind(this)
  });

  google.accounts.id.renderButton(
    document.getElementById('googleSignInButton'),
    { theme: 'outline', size: 'large' }
  );
}

private handleGoogleResponse(response: any) {
  const credential = response.credential;
  // Decode JWT token to get user info
  const payload = JSON.parse(atob(credential.split('.')[1]));

  this.googleUser = {
    id: payload.sub,
    name: payload.name,
    photoUrl: payload.picture
  };

  this.nickname = payload.name;
  // ... rest of the sign-in logic
}
```

2. Add a div in your HTML for the Google Sign-In button:
```html
<div id="googleSignInButton"></div>
```

## Security Notes

- **Never commit your Client ID to a public repository** if it contains sensitive information
- Use environment variables for production deployments
- Always validate tokens on the server side in production
- Implement proper session management and CSRF protection

## Testing

For development and testing purposes, the current implementation uses a simplified mock sign-in that generates random user IDs. This allows you to test the game mechanics without setting up Google OAuth immediately.

## Production Deployment

When deploying to production:

1. Update the authorized domains in Google Cloud Console
2. Set up environment variables for your Client ID
3. Implement server-side token validation
4. Enable HTTPS for your domain
5. Update CORS settings to only allow your domain

## Troubleshooting

**Issue**: "Unauthorized JavaScript origin"
- **Solution**: Make sure you've added the correct origin in Google Cloud Console

**Issue**: Sign-in button doesn't appear
- **Solution**: Check that the Google Sign-In script is loaded and your Client ID is correct

**Issue**: CORS errors
- **Solution**: Ensure your domain is authorized in Google Cloud Console

## Resources

- [Google Sign-In Documentation](https://developers.google.com/identity/gsi/web)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/)
