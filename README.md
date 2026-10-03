# Vyastha website

Static site with client-side routes: `/`, `/about`, `/features`, `/pricing`, `/founders`, `/security`, `/contact`.
All routes are served by `index.html`. `vercel.json` holds the rewrites, so it deploys on Vercel as-is. On Netlify add `/* /index.html 200` to `_redirects`. Opening `index.html` directly from disk shows the home page only; use a local server (e.g. `npx serve -s .`) to test routes.
Opening animation: plays once per browser session on `/`, skippable (click / any key), disabled for reduced-motion users.

## Edit links, prices, trial
Open `index.html`, search for `const CFG=` near the bottom:
- START_FREE_URL, LOGIN_URL: your registration / login URLs
- SHASHANK_LINKEDIN_URL, RAHUL_LINKEDIN_URL, INSTAGRAM_URL, YOUTUBE_URL, LINKEDIN_URL, SUPPORT_EMAIL, WHATSAPP_NUMBER
- PRICE_LITE, TRIAL_LITE, PRICE_PRO, TRIAL_PRO

Empty values leave that button inactive.

## Other
- Images: `assets/` (logo, founder photos, favicon). Replace files with the same names.
- Language: the site is English. The site-wide language selector was removed because most content was not translated. Ask Vyastha demo keeps its own language pills (fully translated; have Marathi/Sindhi reviewed).
- Ask Vyastha and all charts use sample data.
- Domain: set to https://vyastha-web-eight.vercel.app. To change it, run `./set-domain.sh <new-url>` after replacing the old URL.
- Unset Start Free / Login buttons scroll to Pricing; unset social/contact links are hidden (console warns). 
- privacy.html, terms.html, refund.html are noindex draft placeholders. Replace with real text.
- OG image currently uses logo.png; add a 1200x630 image and update og:image/twitter:image.

## Contact (no verification)
`api/contact/start.js` + `api/contact/verify.js` are Vercel serverless functions. The visitor's email is verified with a 6-digit code before the message is forwarded to you.
Set these in Vercel -> Project -> Settings -> Environment Variables, then redeploy:
- SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL (e.g. Gmail: smtp.gmail.com + an App Password)
- CONTACT_INBOX = the email where verified messages should arrive
- CONTACT_SECRET = any long random string
Limits: rate-limiting is per serverless instance (best effort). For strict limits use the backend patch (routers/contact.py) and set CFG.CONTACT_API_URL to "<backend>/api".
