# CareerCompass (demo)

A single-page website for fresh grads: merge job data from multiple CSV sources, filter roles, extract requirements, track applications, and generate an upskilling roadmap based on skill gaps.

> **Privacy-first:** everything runs locally in your browser. CV text is extracted client-side; nothing is uploaded.

## Features

- **Centralized job data**: auto-loads bundled CSV datasets and lets you upload additional CSVs
- **Search + filters**: filter by title/keywords, location, salary (when present), and more
- **Requirements extraction**: extracts skills/keywords from job descriptions
- **Application tracker**: save/reject jobs and track application status
- **Skill-gap roadmap**: compares job requirements vs your CV/skills and suggests what to learn next

## Tech stack

- **React 18** (UMD build)
- **Babel Standalone** (JSX in-browser for this no-build demo)
- **PapaParse** (CSV parsing)
- **PDF.js** + **Mammoth** (PDF/DOCX text extraction)
- **Browser APIs**: FileReader/Blob + `localStorage`

No backend. No cloud services. No database server.

## Project structure

```
careercompass_v2/
  index.html
  styles.css
  src/
    App.jsx
    main.jsx
    globals.js
    utils.js
    skills.js
    storage.js
    jobMapper.js
    icons.jsx
  data/
    mycareersfuture.csv
    jobstreet.csv
    indeed.csv
    glassdoor.csv
    efinancialcareers.csv
```

## Getting started

Because the app loads scripts and (for PDF parsing) fetches resources, **run it from a local web server** (not `file://`).

### Option A: Python (recommended)

```bash
cd careercompass_v2
python -m http.server 5173
```

Then open: `http://localhost:5173`

### Option B: VS Code Live Server

1. Open the `careercompass_v2/` folder in VS Code  
2. Right-click `index.html` → **Open with Live Server**

## Using the app

### 1) Load job data
- **Bundled datasets** load automatically from `data/`.
- To add your own datasets, use **Upload additional job CSV files**.
- Use **Remove CSVs** to remove only the *uploaded* datasets (bundled datasets remain).

### 2) Upload your CV (optional)
Upload a CV/resume file (PDF, DOCX, or TXT) to auto-extract keywords.
- Use **Remove CV** to clear only the current CV + extracted keywords.

### 3) Track applications
Save/reject jobs and manage statuses in the **Tracker** tab.

### 4) Generate a roadmap
Go to **Roadmap** to see missing skills and suggested learning steps.

## CSV format (flexible)

The importer accepts many common header names. For best results, include:

- `title` (or `job title`, `position`, `role`, …)
- `company` (or `employer`, …)
- `location`
- `salary` (optional)
- `description` (or `job description`, `requirements`, …)
- `url` (optional)
- `posted` (optional)

The app generates a stable `id` from `title + company + location + url`.

## Notes

- State (saved/rejected/tracker/CV keywords) is stored in your browser via `localStorage`.
- This is a **demo/no-build** setup using CDN scripts + Babel in the browser. For production, you would typically migrate to a bundler (Vite/CRA/Next.js) and pin dependencies.

## License

No license is included by default. Add a `LICENSE` file if you plan to publish or reuse this code.
