# dialectic

A command-line reasoning tool. You ask a question; `dialectic` runs it through a
three-stage pipeline against the Anthropic API and streams each stage to your
terminal as it arrives:

1. **🔍 Lines of Inquiry** — decompose the question into 4–6 distinct sub-questions.
2. **⚔️ Rebuttals** — a devil's advocate attacks the weakest assumptions in each line.
3. **✅ Synthesis** — a final, direct answer that accounts for the strongest objections.

Each stage feeds the next, so the synthesis is reasoned *through* the critique
rather than around it.

## Setup

```bash
npm install
cp .env.example .env   # then edit .env and add your Anthropic API key
```

The key is read from `ANTHROPIC_API_KEY` (loaded from `.env`).

## Usage

Pass the question as an argument:

```bash
node index.js "Is nuclear power worth the risk?"
```

Or run with no argument and you'll be prompted for one:

```bash
node index.js
```

You can also use the npm script:

```bash
npm start -- "Should governments fund basic research?"
```

## Model

The model is a single constant (`MODEL`) at the top of `index.js`. It defaults to
`claude-sonnet-4-6`. (The original spec named `claude-sonnet-4-20250514`, which is
deprecated and retires 2026-06-15 — `claude-sonnet-4-6` is its drop-in replacement.)

## Note

This is a personal tool — a thinking aid, not a polished product for public
release. No tests, no packaging, no support guarantees.
