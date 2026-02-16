# Startup Evaluator Platform

A three-window startup evaluation platform with AI-powered analysis.

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Then open http://localhost:5173 in your browser.

## Deploy to Vercel (Recommended)

### Option A: Deploy via GitHub (Best)

1. Push this code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click "Add New Project"
4. Import your GitHub repository
5. Click "Deploy" - Vercel auto-detects Vite/React settings
6. Your app will be live at `your-project.vercel.app`

### Option B: Deploy via Command Line

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow the prompts)
vercel
```

## Connect Your Custom Domain (app.nusuai.com)

After deploying to Vercel:

1. In Vercel dashboard, go to your project → Settings → Domains
2. Add `app.nusuai.com`
3. Vercel will show you DNS records to add
4. Go to your domain registrar (where you bought nusuai.com)
5. Add the DNS records Vercel shows you:
   - Usually a CNAME record: `app` → `cname.vercel-dns.com`
6. Wait 5-30 minutes for DNS to update
7. Done! Visit app.nusuai.com

## Connecting to Dify

Edit `src/App.jsx` and find the `DifyAPI` object near the top:

```javascript
const DifyAPI = {
  baseUrl: "https://api.dify.ai/v1", // Your Dify API URL
  apiKey: "YOUR_DIFY_API_KEY",       // Your Dify API key
  // ...
}
```

Replace with your actual Dify credentials.

## Project Structure

```
startup-project/
├── index.html          # Entry HTML file
├── package.json        # Dependencies
├── vite.config.js      # Vite configuration
├── public/
│   └── favicon.svg     # Site icon
└── src/
    ├── main.jsx        # React entry point
    └── App.jsx         # Main application (all 3 windows)
```

## Features

- **Window 1**: Chat-based company onboarding with file uploads
- **Window 2**: Evaluation dashboard with spider chart + bar charts + action items
- **Window 3**: Investment matching with suitability scores

## Tech Stack

- React 18
- Vite (build tool)
- Vanilla CSS (no frameworks needed)
