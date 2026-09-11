# AI Cross-border Ops Decision Assistant

A lightweight V1 demo for turning customer reviews into traceable ecommerce operations decisions. It combines deterministic statistics, product-aware DeepSeek analysis for uploaded CSV files, Product Profile facts, human review, Claim Check, Listing edits, and a final action plan.

## Live demo

https://wesimoon.github.io/ai-crossborder-ops-assistant/

GitHub Pages can publish the checked-in production build without Actions: open
`Settings > Pages`, choose `Deploy from a branch`, then select `main` and
`/docs`. The `docs` directory contains the deployable site; the remaining files
are the open-source project.

## What it demonstrates

- Fixed-schema CSV import: `review_id`, `rating`, `review_title`, `review_text`
- Evidence traceability back to original reviews
- A one-by-one human decision queue
- Product Profile matching and conservative Claim Check
- Adoptable and reversible Listing suggestions
- Product / supply-chain collaboration cards
- A copyable final operations action plan
- Optional bring-your-own DeepSeek API connection for unfamiliar products and CSV files
- A human-classification fallback for low-confidence feedback

The built-in Sample Data remains available without an API key. An uploaded CSV requires the user to connect their own DeepSeek API key and is analyzed against the Product Profile currently saved in the browser.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by the development server.

## Validation

```bash
npm run build
npm run build:pages
```

The built-in Sample Data is the regression fixture for the five core insights: leakage, cleaning, temperature retention, portability, and appearance. Uploaded CSV files do not use those bottle-specific rules: DeepSeek receives the current Product Profile and returns structured themes, while low-confidence feedback remains available for human classification.

## Privacy

The DeepSeek API key is stored only in the current browser's local storage and is never committed to this repository. During real analysis, the browser sends the key, current Product Profile, and review content directly to DeepSeek's official API. Use this feature only on a trusted personal device and do not upload sensitive or personal customer information.

## License

[MIT](LICENSE)
