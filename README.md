# Vyastha website

Static site: open `index.html` in a browser, or upload the whole folder to any static host (Netlify, Vercel, GitHub Pages, cPanel).

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

## Contact
The Help & Contact section has two direct buttons: Email and WhatsApp. Set SUPPORT_EMAIL and WHATSAPP_NUMBER (with country code, e.g. 919876543210) in `CFG`. No backend or environment variables needed. A button with an empty value is hidden.
