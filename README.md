# CBC Notebooks

Static CBC learning site for Kenya Grades 4–10. Source lives in `src/`. Render publishes `dist/`.

Repo: [ProximaOpal/CBC-Notebooks-](https://github.com/ProximaOpal/CBC-Notebooks-)

## Tree

```
.
├── render.yaml              # Render Blueprint (static site)
├── package.json
├── scripts/build.mjs        # copies src → dist
├── src/                     # authored site
│   ├── index.html
│   ├── robots.txt
│   ├── llms.txt
│   └── assets/
│       ├── css/styles.css
│       ├── img/
│       └── js/
│           ├── main.js      # boot
│           ├── config.js    # labels, page size
│           ├── hero.js      # background slider
│           ├── panel.js     # subject / topic overlay
│           ├── nav.js       # search, burger, scroll track
│           ├── lib/dom.js
│           └── data/subjects.js
└── dist/                    # build output (gitignored)
```

## Local

```bash
npm run dev      # http://localhost:8080 from src/
npm run build    # write dist/
npm start        # http://localhost:8080 from dist/
npm test         # vitest
```

## Render

1. Push this repo to GitHub or GitLab.
2. In Render, New → Blueprint, and select the repo (uses `render.yaml`).
3. Or New → Static Site, build command `npm run build`, publish directory `dist`.

Custom domain: point `cbcnotebooks.co.ke` at the Render static site.
