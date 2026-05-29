#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline";
import Anthropic from "@anthropic-ai/sdk";

// ── Model ──────────────────────────────────────────────────────────────────
// The original spec named `claude-sonnet-4-20250514`, which is deprecated and
// retires 2026-06-15. `claude-sonnet-4-6` is the official drop-in replacement.
// Change this one constant if you want a different model.
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

// ── ANSI theme ───────────────────────────────────────────────────────────────
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const WHITE = "\x1b[97m";
const BG_DARK = "\x1b[48;5;236m"; // dark grey background for the banner
const CYAN = "\x1b[96m"; // bright cyan
const YELLOW = "\x1b[93m"; // bright yellow
const GREEN = "\x1b[92m"; // bright green
const RED = "\x1b[91m"; // bright red

const SPINNER_FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏".split("");
const termWidth = () => process.stdout.columns || 80;

// ── Banner ───────────────────────────────────────────────────────────────────
function printBanner() {
  const title = "dialectic";
  const subtitle = "decompose · rebut · synthesise";
  const inner = Math.max(title.length, subtitle.length) + 4;
  const pad = (s) => {
    const total = inner - s.length;
    const left = Math.floor(total / 2);
    return " ".repeat(left) + s + " ".repeat(total - left);
  };
  const top = "╔" + "═".repeat(inner) + "╗";
  const mid = "║" + pad(title) + "║";
  const sub = "║" + pad(subtitle) + "║";
  const bot = "╚" + "═".repeat(inner) + "╝";
  const style = BG_DARK + BOLD + WHITE;
  process.stdout.write("\n");
  for (const line of [top, mid, sub, bot]) {
    process.stdout.write(style + line + RESET + "\n");
  }
  process.stdout.write("\n");
}

// ── Spinner ──────────────────────────────────────────────────────────────────
function startSpinner(label) {
  let i = 0;
  process.stdout.write("\x1b[?25l"); // hide cursor
  const render = () => {
    const frame = SPINNER_FRAMES[i++ % SPINNER_FRAMES.length];
    process.stdout.write(`\r${DIM}${frame} ${label}${RESET}`);
  };
  render();
  const interval = setInterval(render, 100);
  return () => {
    clearInterval(interval);
    process.stdout.write("\r\x1b[2K"); // clear the spinner line
    process.stdout.write("\x1b[?25h"); // show cursor
  };
}

// ── Streaming a single stage ──────────────────────────────────────────────────
async function runStage(client, { headerText, headerColor, spinnerLabel, system, userContent }) {
  const stopSpinner = startSpinner(spinnerLabel);
  let firstToken = true;

  const stream = client.messages
    .stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userContent }],
    })
    .on("text", (delta) => {
      if (firstToken) {
        stopSpinner();
        process.stdout.write(`${headerColor}${BOLD}${headerText}${RESET}\n`);
        firstToken = false;
      }
      process.stdout.write(delta); // body in default terminal colour
    });

  let final;
  try {
    final = await stream.finalMessage();
  } catch (err) {
    if (firstToken) stopSpinner(); // ensure spinner is cleared on early failure
    throw err;
  }

  process.stdout.write("\n");
  return final.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// ── Prompts ────────────────────────────────────────────────────────────────────
const DECOMPOSE_SYSTEM =
  "You are a rigorous analytical thinker. Given a question, identify 4–6 distinct sub-questions or lines of inquiry that must be resolved to answer it well. Be specific and non-redundant. Format as a numbered list with a one-sentence explanation for each.";

const REBUTTAL_SYSTEM =
  "You are a sharp devil's advocate. Given a set of lines of inquiry, identify the weakest assumptions, overlooked angles, or logical gaps in each one. Be direct and specific — not just 'this could be wrong' but *how* and *why*. Format your response as a numbered list matching the original.";

const SYNTHESIS_SYSTEM =
  "You are a wise and precise synthesiser. You have been given a question, a set of analytical lines of inquiry, and a set of rebuttals to those inquiries. Your job is to produce a final, well-reasoned answer that acknowledges the strongest objections and takes a clear position where the evidence supports one. Do not hedge excessively. Be direct.";

// ── Input handling ─────────────────────────────────────────────────────────────
function promptForQuestion() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${DIM}What's your question? ${RESET}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Main pipeline ────────────────────────────────────────────────────────────────
async function main() {
  printBanner();

  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write(
      `${RED}Error: ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.${RESET}\n`,
    );
    process.exit(1);
  }

  let question = process.argv.slice(2).join(" ").trim();
  if (!question) {
    question = await promptForQuestion();
  }
  if (!question) {
    process.stderr.write(`${RED}Error: no question provided.${RESET}\n`);
    process.exit(1);
  }

  const client = new Anthropic();

  try {
    // Stage 1 — Decompose
    const inquiry = await runStage(client, {
      headerText: "## 🔍 Lines of Inquiry",
      headerColor: CYAN,
      spinnerLabel: "Thinking about your question...",
      system: DECOMPOSE_SYSTEM,
      userContent: question,
    });

    // Stage 2 — Rebuttal
    const rebuttals = await runStage(client, {
      headerText: "## ⚔️ Rebuttals",
      headerColor: YELLOW,
      spinnerLabel: "Poking holes in those lines of inquiry...",
      system: REBUTTAL_SYSTEM,
      userContent: inquiry,
    });

    // Stage 3 — Synthesis
    await runStage(client, {
      headerText: "## ✅ Synthesis",
      headerColor: GREEN,
      spinnerLabel: "Weighing it all and reaching a verdict...",
      system: SYNTHESIS_SYSTEM,
      userContent: `Original question:\n${question}\n\nLines of inquiry:\n${inquiry}\n\nRebuttals:\n${rebuttals}`,
    });

    // Completion rule
    process.stdout.write(`\n${DIM}${"─".repeat(termWidth())}${RESET}\n`);
  } catch (err) {
    process.stdout.write("\x1b[?25h"); // make sure the cursor is restored
    const message = err?.message ?? String(err);
    process.stderr.write(`\n${RED}API call failed: ${message}${RESET}\n`);
    process.exit(1);
  }
}

main();
