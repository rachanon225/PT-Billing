# POSTECK Billing — Web Frontend

Static frontend for the Posteck delivery-note (ใบส่งมอบงาน) generator, hosted on GitHub Pages. Talks to the Apps Script backend (in the sibling `PT-Billing` project) as a plain JSON API over `fetch()` — no Google login required to load the site, since the Apps Script exec URL's own account-based routing was unreliable across browsers/devices signed into unrelated Google accounts. Access is instead gated by a shared password (see `login.html` / the backend's `Auth.gs`).

## Files

- `login.html` — password gate, stores a session token in `localStorage`
- `index.html` — dashboard (links to the 3 document types + history)
- `material.html`, `stressing.html`, `stud.html` — the 3 delivery-note forms
- `history.html` — past documents, PDF links, void action
- `shared.css`, `shared.js` — common styling + the `apiCall()` fetch helper, nav/theme wiring, auth guard
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA install support
- `logo-supplies.jpg`, `logo-prestressing.jpg` — company letterhead marks shown in the top bar

## Backend

`shared.js` has `API_URL` pointing at the Apps Script Web App deployment (`PT-Billing` project). If that deployment is ever re-created (new deployment ID rather than a redeploy of the existing one), update `API_URL` here to match.

## Deploying

Push to `main` — GitHub Pages (Settings → Pages → Deploy from branch → `main` / root) serves it automatically, no build step.
