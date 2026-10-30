#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((v, i, a) =>
  v.startsWith('--') ? [[v.slice(2), a[i + 1]]] : []));

if (!args['xlsx-unpacked'] || !args.output) {
  console.error('Usage: node scripts/generate_observed_metrics_csv.mjs --xlsx-unpacked DIR --output FILE');
  process.exit(2);
}

const XML_DIR = args['xlsx-unpacked'];
const OUTPUT = args.output;
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

function decodeXml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function readTaskRows() {
  const sharedXml = fs.readFileSync(path.join(XML_DIR, 'xl/sharedStrings.xml'), 'utf8');
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decodeXml(m[1]));
  const sheet = fs.readFileSync(path.join(XML_DIR, 'xl/worksheets/sheet1.xml'), 'utf8');
  const rows = [];
  for (const match of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNumber = Number(match[1]);
    if (rowNumber === 1) continue;
    const cells = {};
    for (const cell of match[2].matchAll(/<c[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const raw = (cell[3].match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      cells[cell[1]] = cell[2].includes('t="s"') ? shared[Number(raw)] : (raw ?? '');
    }
    for (const sourcePath of String(cells.C || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
      rows.push({
        source_row: rowNumber,
        case_id: String(cells.A || ''),
        dataset: String(cells.B || '').trim(),
        source_path: sourcePath,
        note: String(cells.D || '').trim(),
      });
    }
  }
  return rows;
}

function safeJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch { return []; }
}

function discoverUnits(meta) {
  const root = meta.source_path;
  if (!fs.existsSync(root)) return [{ ...meta, run_label: '', run_path: root, run_type: 'missing' }];
  const directRounds = listDirs(root).filter((x) => /^round\d+$/.test(x)).sort(roundSort);
  const taskRounds = [];
  const taskRoot = path.join(root, 'research_tasks');
  for (const task of listDirs(taskRoot).sort()) {
    for (const round of listDirs(path.join(taskRoot, task)).filter((x) => /^round\d+$/.test(x)).sort(roundSort)) {
      taskRounds.push({ label: `${task}/${round}`, dir: path.join(taskRoot, task, round) });
    }
  }
  const units = [];
  const planning = path.join(root, 'planning');
  if (fs.existsSync(path.join(planning, 'usage', 'summary.json')) || fs.existsSync(path.join(planning, 'events.jsonl'))) {
    units.push({ ...meta, run_label: 'planning', run_path: planning, run_type: 'project_planning' });
  }
  for (const round of directRounds) {
    units.push({ ...meta, run_label: round, run_path: path.join(root, round), run_type: 'round' });
  }
  for (const unit of taskRounds) {
    units.push({ ...meta, run_label: unit.label, run_path: unit.dir, run_type: 'research_task_round' });
  }
  if (units.length === 0) {
    units.push({
      ...meta,
      run_label: /^round\d+$/.test(path.basename(root)) ? path.basename(root) : 'run',
      run_path: root,
      run_type: 'standalone_run',
    });
  }
  return units;
}

function roundSort(a, b) {
  return Number(a.slice(5)) - Number(b.slice(5));
}

function readEvents(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  if (file.endsWith('.json')) {
    const parsed = safeJson(file);
    return Array.isArray(parsed) ? parsed : (parsed?.events || []);
  }
  return text.split('\n').flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

function topLevelEvents(runPath) {
  const files = ['events.jsonl', 'events.json'].map((x) => path.join(runPath, x));
  return files.flatMap(readEvents);
}

function eventTime(event) {
  const value = event.ts || event.timestamp || event.created_at;
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

function recordedReviewMs(events) {
  let total = 0;
  const reviewPattern = /(researcher_review|planning_decision_review|human_review)/i;
  for (let i = 0; i < events.length; i += 1) {
    const start = events[i];
    if (start.event !== 'tool_call' || !reviewPattern.test(start.tool || '')) continue;
    const finish = events.slice(i + 1).find((x) =>
      x.event === 'tool_result' && x.tool === start.tool && eventTime(x) !== null);
    if (finish && eventTime(start) !== null) total += Math.max(0, eventTime(finish) - eventTime(start));
  }
  return total;
}

function walkFiles(dir, predicate, output = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(file, predicate, output);
    else if (predicate(file)) output.push(file);
  }
  return output;
}

function normalizedStage(component) {
  if (component === 'main') return 'orchestration';
  if (/planning|formulation/.test(component)) return 'planning';
  if (/deep_research|research_survey/.test(component)) return 'research';
  if (/skill/.test(component)) return 'skill_matching';
  if (/code_execute|execution/.test(component)) return 'code_execution';
  if (/validation/.test(component)) return 'validation';
  if (/figure_refine|image_refine/.test(component)) return 'figure_refinement';
  if (/interpretation/.test(component)) return 'interpretation';
  return 'other';
}

function zeroTokens() {
  return { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, total: 0 };
}

function extractUsage(runPath) {
  const usageDir = path.join(runPath, 'usage');
  const summaryFile = path.join(usageDir, 'summary.json');
  const summary = safeJson(summaryFile);
  const stageCosts = Object.fromEntries([
    'orchestration', 'planning', 'research', 'skill_matching', 'code_execution',
    'validation', 'figure_refinement', 'interpretation', 'other',
  ].map((x) => [x, 0]));
  const componentCosts = {};
  const componentEntries = {};
  const models = new Set();
  const providers = new Set();
  let tokens = zeroTokens();
  let cost = null;
  let entryCount = null;
  let source = '';

  if (summary) {
    tokens = { ...zeroTokens(), ...(summary.tokens || {}) };
    cost = Number(summary.cost || 0);
    entryCount = Number(summary.entry_count || 0);
    source = 'usage/summary.json';
    for (const component of summary.components || []) {
      const name = component.component || 'unknown';
      const value = Number(component.cost || 0);
      componentCosts[name] = (componentCosts[name] || 0) + value;
      componentEntries[name] = (componentEntries[name] || 0) + Number(component.entries || 0);
      stageCosts[normalizedStage(name)] += value;
    }
  } else if (fs.existsSync(usageDir)) {
    cost = 0;
    entryCount = 0;
    source = 'usage component files';
    for (const file of fs.readdirSync(usageDir).filter((x) => x.endsWith('.json') && x !== 'summary.json')) {
      const data = safeJson(path.join(usageDir, file));
      const entries = data?.entries || [];
      const componentName = path.basename(file, '.json');
      componentEntries[componentName] = entries.length;
      componentCosts[componentName] = 0;
      for (const entry of entries) {
        entryCount += 1;
        cost += Number(entry.cost || 0);
        componentCosts[componentName] += Number(entry.cost || 0);
        stageCosts[normalizedStage(componentName)] += Number(entry.cost || 0);
        for (const key of Object.keys(tokens)) tokens[key] += Number(entry.tokens?.[key] || 0);
        if (entry.model) models.add(entry.model);
        if (entry.provider) providers.add(entry.provider);
      }
    }
  }

  for (const file of walkFiles(runPath, (x) => /events\.jsonl?$/.test(x))) {
    for (const event of readEvents(file)) {
      if (event.model) models.add(event.model);
      if (event.provider) providers.add(event.provider);
    }
  }
  return { summary, tokens, cost, entryCount, source, stageCosts, componentCosts, componentEntries, models, providers };
}

function materialEnd(runPath, baselineMs) {
  const names = /^(statistics\.json|conclusions\.json|validation\.json|figure(?:\d+)?\.(?:png|pdf)|.*report\.pdf)$/i;
  let best = null;
  for (const file of walkFiles(runPath, (x) => names.test(path.basename(x)))) {
    const ms = fs.statSync(file).mtimeMs;
    if (ms >= baselineMs && ms - baselineMs <= 6 * 60 * 60 * 1000 && (!best || ms > best.ms)) best = { ms, file };
  }
  return best;
}

function extractTiming(runPath, usage, events) {
  const state = safeJson(path.join(runPath, 'state.json')) || {};
  const usageTimes = [];
  if (usage.summary?.updated_at) usageTimes.push(Date.parse(usage.summary.updated_at));
  for (const file of fs.existsSync(path.join(runPath, 'usage'))
    ? fs.readdirSync(path.join(runPath, 'usage')).filter((x) => x.endsWith('.json') && x !== 'summary.json') : []) {
    for (const entry of safeJson(path.join(runPath, 'usage', file))?.entries || []) {
      const ms = Date.parse(entry.timestamp || '');
      if (Number.isFinite(ms)) usageTimes.push(ms);
    }
  }
  const eventTimes = events.map(eventTime).filter((x) => x !== null);
  let start = Date.parse(state.created_at || state.started_at || '');
  let startSource = state.created_at ? 'state.created_at' : (state.started_at ? 'state.started_at' : '');
  if (!Number.isFinite(start)) {
    const candidates = [...eventTimes, ...usageTimes].filter(Number.isFinite);
    start = candidates.length ? Math.min(...candidates) : NaN;
    startSource = eventTimes.length ? 'first top-level event' : (usageTimes.length ? 'first usage timestamp' : '');
  }
  let end = Date.parse(state.completed_at || state.updated_at || '');
  let endSource = state.completed_at ? 'state.completed_at' : (state.updated_at ? 'state.updated_at' : '');
  const summaryEnd = usage.summary?.updated_at ? Date.parse(usage.summary.updated_at) : NaN;
  if (Number.isFinite(summaryEnd) && (!Number.isFinite(end) || summaryEnd > end)) {
    end = summaryEnd;
    endSource = 'usage/summary.updated_at';
  }
  if (!Number.isFinite(end)) {
    const candidates = [...eventTimes, ...usageTimes].filter(Number.isFinite);
    end = candidates.length ? Math.max(...candidates) : NaN;
    endSource = eventTimes.length ? 'last top-level event' : (usageTimes.length ? 'last usage timestamp' : '');
  }
  if (Number.isFinite(end)) {
    const artifact = materialEnd(runPath, end);
    if (artifact && artifact.ms > end) {
      end = artifact.ms;
      endSource = `material artifact mtime: ${path.basename(artifact.file)}`;
    }
  }
  return { state, start, end, startSource, endSource };
}

function hkt(ms) {
  if (!Number.isFinite(ms)) return '';
  return new Date(ms + HKT_OFFSET_MS).toISOString().replace('T', ' ').replace('Z', ' HKT');
}

function duration(ms) {
  if (!Number.isFinite(ms)) return '';
  const fractional = ms < 1000 && ms > 0 ? `.${String(Math.round(ms) % 1000).padStart(3, '0')}` : '';
  let seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${fractional}`;
}

function csv(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const taskRows = readTaskRows();
const units = taskRows.flatMap(discoverUnits);
const records = [];
for (const unit of units) {
  const events = topLevelEvents(unit.run_path);
  const usage = extractUsage(unit.run_path);
  const timing = extractTiming(unit.run_path, usage, events);
  const reviewMs = recordedReviewMs(events);
  const hasTiming = Number.isFinite(timing.start) && Number.isFinite(timing.end) && timing.end >= timing.start;
  const hasCost = usage.cost !== null;
  const caveats = [];
  if (!hasTiming) caveats.push('wall-clock unavailable from current logs');
  if (!hasCost) caveats.push('observed cost unavailable: no usage ledger');
  caveats.push('recorded human-review time is response latency, not researcher active-work time');
  if (['1', '2', '3'].includes(unit.case_id)) caveats.push('marginal replay time/cost only; excludes historical scientific ideation, prompt development, and legacy-system trial-and-error');
  records.push({
    source_row: unit.source_row,
    case_id: unit.case_id,
    dataset: unit.dataset,
    source_path: unit.source_path,
    source_note: unit.note,
    run_label: unit.run_label,
    run_type: unit.run_type,
    run_path: unit.run_path,
    run_id: timing.state.run_id || '',
    start_hkt: hkt(timing.start),
    end_hkt: hkt(timing.end),
    wall_clock_seconds: hasTiming ? ((timing.end - timing.start) / 1000).toFixed(3) : '',
    wall_clock_hms: hasTiming ? duration(timing.end - timing.start) : '',
    recorded_human_review_response_seconds: Math.round(reviewMs / 1000),
    recorded_human_review_response_hms: duration(reviewMs),
    researcher_active_work_time: 'Not identifiable from current logs',
    observed_cost_usd: hasCost ? usage.cost.toFixed(6) : '',
    total_tokens: hasCost ? usage.tokens.total : '',
    input_tokens: hasCost ? usage.tokens.input : '',
    cache_read_tokens: hasCost ? usage.tokens.cacheRead : '',
    cache_write_tokens: hasCost ? usage.tokens.cacheWrite : '',
    output_tokens: hasCost ? usage.tokens.output : '',
    cost_entry_count: hasCost ? usage.entryCount : '',
    models: [...usage.models].sort().join(';'),
    providers: [...usage.providers].sort().join(';'),
    cost_source: usage.source,
    timing_start_source: timing.startSource,
    timing_end_source: timing.endSource,
    coverage_status: hasTiming && hasCost ? 'complete_time_and_cost' : (hasTiming ? 'time_only' : (hasCost ? 'cost_only' : 'unavailable')),
    stage_orchestration_cost_usd: hasCost ? usage.stageCosts.orchestration.toFixed(6) : '',
    stage_planning_cost_usd: hasCost ? usage.stageCosts.planning.toFixed(6) : '',
    stage_research_cost_usd: hasCost ? usage.stageCosts.research.toFixed(6) : '',
    stage_skill_matching_cost_usd: hasCost ? usage.stageCosts.skill_matching.toFixed(6) : '',
    stage_code_execution_cost_usd: hasCost ? usage.stageCosts.code_execution.toFixed(6) : '',
    stage_validation_cost_usd: hasCost ? usage.stageCosts.validation.toFixed(6) : '',
    stage_figure_refinement_cost_usd: hasCost ? usage.stageCosts.figure_refinement.toFixed(6) : '',
    stage_interpretation_cost_usd: hasCost ? usage.stageCosts.interpretation.toFixed(6) : '',
    stage_other_cost_usd: hasCost ? usage.stageCosts.other.toFixed(6) : '',
    component_cost_json: hasCost ? JSON.stringify(usage.componentCosts) : '',
    component_entry_count_json: hasCost ? JSON.stringify(usage.componentEntries) : '',
    caveats: caveats.join('; '),
  });
}

const headers = Object.keys(records[0]);
const output = [headers.map(csv).join(','), ...records.map((r) => headers.map((h) => csv(r[h])).join(','))].join('\n') + '\n';
fs.writeFileSync(OUTPUT, output);
console.log(JSON.stringify({ output: OUTPUT, task_paths: taskRows.length, rows: records.length }, null, 2));
