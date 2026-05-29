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

// Rebuttal personas — all critical, each with a different lens. Pick one with
// `--persona <name>` (default: devils-advocate). See PERSONAS keys below.
const PERSONAS = {
  "devils-advocate": {
    label: "Devil's Advocate",
    system:
      "You are a sharp devil's advocate. Given a set of lines of inquiry, identify the weakest assumptions, overlooked angles, or logical gaps in each one. Be direct and specific — not just 'this could be wrong' but *how* and *why*. Format your response as a numbered list matching the original.",
  },
  manager: {
    label: "Your Manager",
    system:
      "You are a demanding, results-oriented manager reviewing these lines of inquiry. For each one, press on feasibility, cost, ownership, timelines, and measurable outcomes: who actually does this, what does it cost, how do we know it worked, and what's the risk if it slips? Be direct and specific — call out hand-waving and anything that wouldn't survive a budget or accountability review. Format your response as a numbered list matching the original.",
  },
  teacher: {
    label: "High School Teacher",
    system:
      "You are a sharp, no-nonsense high school teacher grading these lines of inquiry. For each one, point out sloppy reasoning, unsupported claims, logical fallacies, and places where the thinking needs to 'show its work.' Be direct and specific about what's missing or weak — as if leaving margin notes on a paper. Format your response as a numbered list matching the original.",
  },
  doctor: {
    label: "Doctor",
    system:
      "You are a careful, evidence-driven doctor scrutinising these lines of inquiry. For each one, ask what the actual evidence is, what's being assumed without proof, what the risks and side effects are, and whether a more cautious explanation has been ruled out. Be direct and specific — flag anything you'd want a second opinion on before acting. Format your response as a numbered list matching the original.",
  },
  chef: {
    label: "Professional Chef",
    system:
      "You are an exacting professional chef tearing through these lines of inquiry like a head cook reviewing a plan before service. For each one, attack the execution: what's underprepped, what falls apart under pressure, what timing or sequencing is wrong, and where someone's cutting corners they'll regret. Be blunt and specific — no patience for anything that won't hold up on a busy night. Format your response as a numbered list matching the original.",
  },
  "mother-in-law": {
    label: "Mother-in-Law",
    system:
      "You are a critical, faintly disapproving mother-in-law looking over these lines of inquiry. For each one, find the fault — the thing that's been overlooked, the way it could be done 'properly,' the unflattering comparison, the question that quietly implies it hasn't been thought through. Be pointed and specific, with that politely judgmental edge. Format your response as a numbered list matching the original.",
  },
  judge: {
    label: "Judge",
    system:
      "You are an impartial but exacting judge weighing these lines of inquiry. For each one, test it against the evidence: what's asserted without support, what burden of proof hasn't been met, what a reasonable objection or precedent would raise, and where the argument relies on speculation. Be direct and specific — rule on what would and wouldn't hold up under scrutiny. Format your response as a numbered list matching the original.",
  },
  partner: {
    label: "Partner",
    system:
      "You are a perceptive, emotionally honest partner gently but firmly challenging these lines of inquiry. For each one, name what's being avoided, what hasn't really been thought through, the consequences for the people involved, and the gap between what's said and what's actually meant. Be caring but direct — the kind of pushback that comes from someone who knows you well. Format your response as a numbered list matching the original.",
  },
};
const DEFAULT_PERSONA = "devils-advocate";

// Resolve a user-supplied persona name leniently (ignore case, spaces, hyphens,
// apostrophes), with a couple of friendly aliases.
const PERSONA_ALIASES = { devil: "devils-advocate", da: "devils-advocate", mil: "mother-in-law" };
function resolvePersona(input) {
  const norm = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const key of Object.keys(PERSONAS)) {
    if (key.replace(/[^a-z0-9]/g, "") === norm) return key;
  }
  return PERSONA_ALIASES[norm] ?? null;
}

const SYNTHESIS_SYSTEM =
  "You are a wise and precise synthesiser. You have been given a question, a set of analytical lines of inquiry, and a set of rebuttals to those inquiries. Your job is to produce a final, well-reasoned answer that acknowledges the strongest objections and takes a clear position where the evidence supports one. Do not hedge excessively. Be direct.";

// ── Argument parsing ───────────────────────────────────────────────────────────
// Pulls out `--persona <name>` / `--persona=<name>` / `-p <name>` and
// `--list-personas`; everything else is treated as the question text.
function parseArgs(argv) {
  const args = argv.slice(2);
  let persona = DEFAULT_PERSONA;
  let personaProvided = false;
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--list-personas") {
      return { listPersonas: true };
    } else if (a === "--persona" || a === "-p") {
      persona = args[++i] ?? "";
      personaProvided = true;
    } else if (a.startsWith("--persona=")) {
      persona = a.slice("--persona=".length);
      personaProvided = true;
    } else {
      rest.push(a);
    }
  }
  return { persona, personaProvided, question: rest.join(" ").trim() };
}

function listPersonas() {
  process.stdout.write(`${DIM}Available rebuttal personas (use --persona <name>):${RESET}\n`);
  for (const [key, { label }] of Object.entries(PERSONAS)) {
    const marker = key === DEFAULT_PERSONA ? `${DIM} (default)${RESET}` : "";
    process.stdout.write(`  ${YELLOW}${key}${RESET} — ${label}${marker}\n`);
  }
}

// ── Interactive input ────────────────────────────────────────────────────────
// Asks for the question, then (unless a persona was passed on the command line)
// shows a numbered persona menu. Uses a single readline interface so piped input
// isn't dropped between prompts. Returns { question, personaKey }.
function runInteractive(askPersona) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Nested callbacks (rather than sequential awaits) so the second prompt's
  // handler is registered synchronously — otherwise piped input can deliver the
  // selection line during the gap between prompts and it gets dropped.
  return new Promise((resolve) => {
    rl.question(`${DIM}What's your question? ${RESET}`, (qRaw) => {
      const question = qRaw.trim();
      if (!askPersona || !question) {
        rl.close();
        resolve({ question, personaKey: DEFAULT_PERSONA });
        return;
      }

      const keys = Object.keys(PERSONAS);
      process.stdout.write(`\n${DIM}Choose a rebuttal persona:${RESET}\n`);
      keys.forEach((key, i) => {
        const marker = key === DEFAULT_PERSONA ? `${DIM} (default)${RESET}` : "";
        process.stdout.write(`  ${YELLOW}${i + 1}${RESET}. ${PERSONAS[key].label}${marker}\n`);
      });

      rl.question(`${DIM}Pick a number (or Enter for default): ${RESET}`, (selRaw) => {
        rl.close();
        const sel = selRaw.trim();
        let personaKey = DEFAULT_PERSONA;
        if (sel) {
          const n = Number.parseInt(sel, 10);
          if (Number.isInteger(n) && n >= 1 && n <= keys.length) {
            personaKey = keys[n - 1];
          } else {
            const byName = resolvePersona(sel);
            if (byName) personaKey = byName;
            else process.stdout.write(`${DIM}Didn't recognise that — using the default.${RESET}\n`);
          }
        }
        resolve({ question, personaKey });
      });
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

  const parsed = parseArgs(process.argv);
  if (parsed.listPersonas) {
    listPersonas();
    process.exit(0);
  }

  let personaKey = DEFAULT_PERSONA;
  if (parsed.personaProvided) {
    const resolved = resolvePersona(parsed.persona);
    if (!resolved) {
      process.stderr.write(
        `${RED}Error: unknown persona "${parsed.persona}".\n` +
          `Valid personas: ${Object.keys(PERSONAS).join(", ")}${RESET}\n`,
      );
      process.exit(1);
    }
    personaKey = resolved;
  }

  let question = parsed.question;
  if (!question) {
    const interactive = await runInteractive(!parsed.personaProvided);
    question = interactive.question;
    if (!parsed.personaProvided) personaKey = interactive.personaKey;
  }
  if (!question) {
    process.stderr.write(`${RED}Error: no question provided.${RESET}\n`);
    process.exit(1);
  }
  const persona = PERSONAS[personaKey];

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
      headerText: `## ⚔️ Rebuttals — ${persona.label}`,
      headerColor: YELLOW,
      spinnerLabel: `${persona.label} is poking holes in your inquiry...`,
      system: persona.system,
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
