/**
 * verify-autopilot-2b2-safety.mjs — Sprint 2B.2 safety verifier
 *
 * Checks: queue_builder, runner, CLI scripts, npm script entries,
 *         pipeline gate management, trading isolation, command mapping.
 *
 * Usage: node scripts/verify-autopilot-2b2-safety.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── helpers ──────────────────────────────────────────────────────────────────

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

let passed = 0;
let failed = 0;

function check(label, ok, detail = "") {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ── files to inspect ─────────────────────────────────────────────────────────

const queueBuilder  = read("services/content-pipeline/autopilot/queue_builder.py");
const runner        = read("services/content-pipeline/autopilot/runner.py");
const safety        = read("services/content-pipeline/autopilot/safety.py");
const cliQueue      = read("scripts/learning-autopilot-queue.py");
const cliRun        = read("scripts/learning-autopilot-run.py");
const pkgJson       = read("package.json");
const workQueue     = read("services/content-pipeline/autopilot/work_queue.py");

// ── file existence ───────────────────────────────────────────────────────────

console.log("\n── File existence ───────────────────────────────────────────");

check("queue_builder.py exists",   queueBuilder !== null);
check("runner.py exists",          runner !== null);
check("learning-autopilot-queue.py exists", cliQueue !== null);
check("learning-autopilot-run.py exists",   cliRun !== null);

// ── queue_builder.py ─────────────────────────────────────────────────────────

console.log("\n── queue_builder.py ─────────────────────────────────────────");

check("HIGH_ERROR_SKIP defined",
  queueBuilder?.includes("HIGH_ERROR_SKIP"));

check("HIGH_ERROR_SKIP ≥ 50 (not too aggressive)",
  (() => {
    const m = queueBuilder?.match(/HIGH_ERROR_SKIP\s*=\s*(\d+)/);
    return m ? parseInt(m[1], 10) >= 50 : false;
  })());

check("_infer_strategy present",
  queueBuilder?.includes("def _infer_strategy("));

check("_decide returns QueueDecision",
  queueBuilder?.includes("def _decide(") && queueBuilder?.includes("QueueDecision"));

check("build_queue public API present",
  queueBuilder?.includes("def build_queue("));

check("LIVE state → skip",
  queueBuilder?.includes("CoverageState.LIVE") && queueBuilder?.includes('"skip"'));

check("QUARANTINED state → skip",
  queueBuilder?.includes("CoverageState.QUARANTINED") && queueBuilder?.includes('"skip"'));

check("failure_classifier invoked for BLOCKED topics",
  queueBuilder?.includes("classify(") || queueBuilder?.includes("from autopilot.failure_classifier import"));

check("NEEDS_RAG_ENRICHMENT → skip (not auto-queued)",
  queueBuilder?.includes("NEEDS_RAG_ENRICHMENT"));

check("enqueue() called when action == 'enqueue'",
  queueBuilder?.includes("enqueue(") && queueBuilder?.includes("job_id = enqueue"));

check("limit respected in build_queue",
  queueBuilder?.includes("limit") && queueBuilder?.includes("enqueued_count"));

check("dry_run does not call enqueue()",
  queueBuilder?.includes("if not dry_run") && queueBuilder?.includes("job_id = enqueue"));

// ── runner.py ─────────────────────────────────────────────────────────────────

console.log("\n── runner.py ─────────────────────────────────────────────────");

check("_build_command present",
  runner?.includes("def _build_command("));

check("learn_content strategy → generate-learn-content.py",
  runner?.includes("generate-learn-content.py") && runner?.includes('"learn_content"'));

check("promote strategy → publish-ready-topics.ts",
  runner?.includes("publish-ready-topics.ts") && runner?.includes('"promote"'));

check("enrich strategy returns None (not executed automatically)",
  runner?.includes('"enrich"') && runner?.includes("return None"));

check("recover-weak-topics.py used for topup/spelling/physics/science_diversity/literature",
  runner?.includes("recover-weak-topics.py") && runner?.includes("--strategy"));

check("_pipeline_gate_open context manager present",
  runner?.includes("def _pipeline_gate_open(") && runner?.includes("@contextmanager"));

check("PIPELINE_STOP removed before subprocess, restored in finally",
  runner?.includes("stop_path.unlink(") && runner?.includes("finally:") && runner?.includes("stop_path.write_text("));

check("subprocess timeout set (≤ 900s)",
  (() => {
    const m = runner?.match(/timeout\s*=\s*(\d+)/);
    return m ? parseInt(m[1], 10) <= 900 : false;
  })());

check("run_next_batch caps at MAX_TOPICS_PER_RUN",
  runner?.includes("MAX_TOPICS_PER_RUN") && runner?.includes("min(count, MAX_TOPICS_PER_RUN)"));

check("JobResult dataclass present",
  runner?.includes("@dataclass") && runner?.includes("class JobResult"));

check("increment_attempt called on failure",
  runner?.includes("increment_attempt("));

check("update_job marks complete on exit_code 0",
  runner?.includes("exit_code == 0") && runner?.includes("JobStatus.COMPLETE"));

check("print_run_summary present",
  runner?.includes("def print_run_summary("));

// ── CLI scripts ───────────────────────────────────────────────────────────────

console.log("\n── CLI scripts ───────────────────────────────────────────────");

check("learning-autopilot-queue.py loads .env.local",
  cliQueue?.includes(".env.local") && cliQueue?.includes("os.environ"));

check("learning-autopilot-queue.py imports build_queue",
  cliQueue?.includes("from autopilot.queue_builder import build_queue"));

check("learning-autopilot-queue.py supports --dry-run",
  cliQueue?.includes('"--dry-run"') || cliQueue?.includes("'--dry-run'"));

check("learning-autopilot-queue.py supports --year filter",
  cliQueue?.includes('"--year"') || cliQueue?.includes("'--year'"));

check("learning-autopilot-run.py loads .env.local",
  cliRun?.includes(".env.local") && cliRun?.includes("os.environ"));

check("learning-autopilot-run.py checks PIPELINE_STOP exists before running",
  cliRun?.includes("_STOP_GUARD") && cliRun?.includes(".exists()") && cliRun?.includes("sys.exit(2)"));

check("learning-autopilot-run.py restores PIPELINE_STOP in finally block",
  cliRun?.includes("finally:") && cliRun?.includes("_STOP_GUARD.write_text("));

check("learning-autopilot-run.py --count default=1",
  cliRun?.includes("default=1"));

check("learning-autopilot-run.py supports --job-id",
  cliRun?.includes("--job-id"));

check("learning-autopilot-run.py exits 3 on partial failure",
  cliRun?.includes("sys.exit(3"));

// ── npm scripts ───────────────────────────────────────────────────────────────

console.log("\n── npm scripts in package.json ───────────────────────────────");

let pkg;
try { pkg = JSON.parse(pkgJson || "{}"); } catch { pkg = {}; }

check("learning:autopilot:queue script present",
  "learning:autopilot:queue" in (pkg.scripts || {}));

check("learning:autopilot:run script present",
  "learning:autopilot:run" in (pkg.scripts || {}));

check("learning:autopilot:queue runs learning-autopilot-queue.py",
  (pkg.scripts?.["learning:autopilot:queue"] || "").includes("learning-autopilot-queue.py"));

check("learning:autopilot:run runs learning-autopilot-run.py",
  (pkg.scripts?.["learning:autopilot:run"] || "").includes("learning-autopilot-run.py"));

check("verify-autopilot-2b2-safety script present",
  "verify-autopilot-2b2-safety" in (pkg.scripts || {}));

// ── trading isolation ─────────────────────────────────────────────────────────

console.log("\n── Trading isolation ─────────────────────────────────────────");

// Files to scan (safety.py contains the guard definition — excluded)
const files2b2 = [
  ["queue_builder.py",             queueBuilder],
  ["runner.py",                    runner],
  ["learning-autopilot-queue.py",  cliQueue],
  ["learning-autopilot-run.py",    cliRun],
];

// Look for actual trading-system imports or function calls — not safety
// disclaimers in docstrings that explicitly say NOT to reference trading.
// Patterns: import/from referencing alpaca or decifer-trading, or calls to
// trading-cron scripts.
const tradingImportRe = /^(?:import|from)\s+(alpaca|decifer.?trading)/im;
const tradingCronRe = /trading.*cron|alpaca.*script/i;
for (const [name, content] of files2b2) {
  if (content === null) continue;
  const hasRef = tradingImportRe.test(content || "") || tradingCronRe.test(content || "");
  check(`${name} does not import or invoke trading systems`,
    !hasRef, "trading import/call found");
}

check("runner.py uses check_no_trading_reference from safety",
  runner?.includes("check_no_trading_reference"));

check("runner.py aborts job if trading reference detected",
  runner?.includes("trading_check") && runner?.includes("JobStatus.BLOCKED"));

// ── pipeline gate integrity ───────────────────────────────────────────────────

console.log("\n── Pipeline gate integrity ───────────────────────────────────");

check("PIPELINE_STOP path sourced from safety module",
  runner?.includes("from autopilot.safety import") && runner?.includes("PIPELINE_STOP"));

check("assert_safe() called in run_next_batch",
  runner?.includes("assert_safe("));

check("MAX_TOPICS_PER_RUN imported from safety",
  runner?.includes("MAX_TOPICS_PER_RUN"));

check("queue_builder never imports pipeline runner (one-way dependency)",
  !queueBuilder?.includes("from autopilot.runner") && !queueBuilder?.includes("import runner"));

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(56)}`);
console.log(`  SPRINT 2B.2 SAFETY: ${passed} passed  /  ${passed + failed} checks`);
console.log(`${"═".repeat(56)}\n`);

if (failed > 0) {
  console.log(`  ❌  ${failed} check(s) FAILED — do not merge.\n`);
  process.exit(1);
} else {
  console.log(`  ✅  All checks passed.\n`);
  process.exit(0);
}
