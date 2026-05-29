# dialectic

A command-line reasoning tool. You ask a question; `dialectic` runs it through a
three-stage pipeline against the Anthropic API and streams each stage to your
terminal as it arrives:

1. **🔍 Lines of Inquiry** — decompose the question into 4–6 distinct sub-questions.
2. **⚔️ Rebuttals** — a critic attacks the weakest assumptions in each line. The
   critic's persona is configurable (see below).
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

## Rebuttal personas

The critic in Stage 2 defaults to a **devil's advocate**, but you can swap in a
different critical voice with `--persona <name>` (or `-p`). They're all critical —
just from different angles.

| Persona | Lens |
| --- | --- |
| `devils-advocate` *(default)* | weakest assumptions, logical gaps |
| `manager` | feasibility, cost, ownership, measurable outcomes |
| `teacher` | sloppy reasoning, unsupported claims, "show your work" |
| `doctor` | evidence, risk, ruling out the cautious explanation |
| `chef` | execution, prep, what falls apart under pressure |
| `mother-in-law` | the overlooked fault, the politely judgmental edge |
| `judge` | burden of proof, unsupported assertions, what holds up |
| `partner` | what's being avoided, consequences for people involved |

```bash
node index.js --persona manager "Should we rewrite the billing service?"
node index.js -p chef "Is this dinner-party menu too ambitious?"
node index.js --list-personas        # show all options
```

Persona names are matched leniently (case, spaces, hyphens, and apostrophes are
ignored), so `"Mother In Law"` and `mother-in-law` both work.

## Model

The model is a single constant (`MODEL`) at the top of `index.js`. It defaults to
`claude-sonnet-4-6`. (The original spec named `claude-sonnet-4-20250514`, which is
deprecated and retires 2026-06-15 — `claude-sonnet-4-6` is its drop-in replacement.)

## Note

This is a personal tool — a thinking aid, not a polished product for public
release. No tests, no packaging, no support guarantees.
