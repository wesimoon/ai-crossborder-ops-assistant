# AI Cross-border Ops Decision Assistant

A lightweight V1 demo for turning customer reviews into traceable ecommerce operations decisions. It combines deterministic statistics, predefined review rules, Product Profile facts, human review, Claim Check, Listing edits, and a final action plan.

## What it demonstrates

- Fixed-schema CSV import: `review_id`, `rating`, `review_title`, `review_text`
- Evidence traceability back to original reviews
- A one-by-one human decision queue
- Product Profile matching and conservative Claim Check
- Adoptable and reversible Listing suggestions
- Product / supply-chain collaboration cards
- A copyable final operations action plan
- A human-classification fallback for feedback outside the stable rule set

This is a portfolio demo. Its sample data and rule-based analysis are not a live market-research service, and it does not call a production LLM.

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
```

The built-in Sample Data is the regression fixture for the five core insights: leakage, cleaning, temperature retention, portability, and appearance. Unknown feedback is shown as evidence for human classification instead of being converted into generated topic names.

## Privacy

CSV processing happens in the browser in this V1. Do not upload sensitive or personal customer information when adapting the demo for real use.

## License

[MIT](LICENSE)
