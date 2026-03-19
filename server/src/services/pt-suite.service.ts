/**
 * Performance Testing Suite — Service Layer
 * Handles Swagger parsing, chain execution, load test engine, and metrics.
 */

import { prisma } from '../config/prisma.js';
import { logger } from '../config/logger.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedSwaggerEndpoint {
  name: string;
  method: string;
  path: string;
  description: string;
  tags: string[];
  queryParams: Array<{ key: string; value: string; enabled: boolean }>;
  headers: Array<{ key: string; value: string }>;
  bodyType: 'json' | 'form' | 'xml' | 'none';
  bodyTemplate: string | null;
}

export interface ParsedSwaggerSpec {
  title: string;
  description: string;
  baseUrl: string;
  version: string;
  endpoints: ParsedSwaggerEndpoint[];
}

export interface ChainStepResult {
  stepName: string;
  method: string;
  url: string;
  statusCode: number;
  latencyMs: number;
  responseSize: number;
  requestSize: number;
  extractedVariables: Record<string, string>;
  assertionResults: Array<{ assertion: string; passed: boolean; actual: string }>;
  error: string | null;
  responseBody: string | null;
}

export interface LoadTestConfig {
  peakVU: number;
  rampUpSec: number;
  steadyStateSec: number;
  rampDownSec: number;
  thinkTimeSec: number;
  pacingSec: number;
  timeoutMs: number;
  maxErrorPct: number;
  pattern: string;
  customRampSteps?: Array<{ atSec: number; targetVU: number }>;
}

export interface AuthConfig {
  type: 'none' | 'bearer' | 'apiKey' | 'basic' | 'oauth2';
  token?: string;       // bearer
  apiKey?: string;       // apiKey
  apiKeyName?: string;   // apiKey header name
  apiKeyIn?: 'header' | 'query';
  username?: string;     // basic
  password?: string;     // basic
}

export interface SlaThreshold {
  metric: 'avgLatency' | 'p95Latency' | 'p99Latency' | 'errorRate' | 'tps';
  operator: 'lt' | 'gt' | 'lte' | 'gte';
  value: number;
}

export interface SlaResult {
  metric: string;
  operator: string;
  threshold: number;
  actual: number;
  passed: boolean;
}

// ── Active run tracking (stop signals) ───────────────────────────────────────

const activeRuns = new Map<string, { stopped: boolean }>();

export function signalStop(runId: string): boolean {
  const run = activeRuns.get(runId);
  if (run) {
    run.stopped = true;
    return true;
  }
  return false;
}

// ── Swagger / OpenAPI Parsing ────────────────────────────────────────────────

export function parseSwaggerSpec(specText: string): ParsedSwaggerSpec {
  let spec: Record<string, unknown>;

  // Try JSON first
  try {
    spec = JSON.parse(specText) as Record<string, unknown>;
  } catch {
    // Try basic YAML parsing (key: value, indentation-based)
    spec = parseBasicYaml(specText) as Record<string, unknown>;
  }

  const info = (spec.info ?? {}) as Record<string, unknown>;
  const title = (info.title as string) || 'Untitled API';
  const description = (info.description as string) || '';
  const version = (info.version as string) || '1.0.0';

  // Determine base URL
  let baseUrl = '';
  if (spec.servers && Array.isArray(spec.servers) && spec.servers.length > 0) {
    baseUrl = (spec.servers[0] as Record<string, unknown>).url as string || '';
  } else if (spec.host) {
    const scheme = Array.isArray(spec.schemes) ? (spec.schemes[0] as string) : 'https';
    const basePath = (spec.basePath as string) || '';
    baseUrl = `${scheme}://${spec.host}${basePath}`;
  }

  const endpoints: ParsedSwaggerEndpoint[] = [];
  const paths = (spec.paths ?? {}) as Record<string, Record<string, unknown>>;

  for (const [path, pathObj] of Object.entries(paths)) {
    if (!pathObj || typeof pathObj !== 'object') continue;

    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    for (const method of httpMethods) {
      const operation = pathObj[method] as Record<string, unknown> | undefined;
      if (!operation || typeof operation !== 'object') continue;

      const opId = (operation.operationId as string) || `${method.toUpperCase()} ${path}`;
      const opDesc = (operation.summary as string) || (operation.description as string) || '';
      const opTags = Array.isArray(operation.tags) ? (operation.tags as string[]) : [];

      // Extract query parameters
      const queryParams: Array<{ key: string; value: string; enabled: boolean }> = [];
      const headers: Array<{ key: string; value: string }> = [];
      const parameters = (operation.parameters ?? pathObj.parameters ?? []) as Array<Record<string, unknown>>;

      if (Array.isArray(parameters)) {
        for (const param of parameters) {
          if (param.in === 'query') {
            queryParams.push({
              key: param.name as string,
              value: (param.example as string) || `{{${param.name}}}`,
              enabled: param.required === true,
            });
          } else if (param.in === 'header' && param.name !== 'Authorization') {
            headers.push({
              key: param.name as string,
              value: (param.example as string) || `{{${param.name}}}`,
            });
          }
        }
      }

      // Extract request body
      let bodyType: ParsedSwaggerEndpoint['bodyType'] = 'none';
      let bodyTemplate: string | null = null;

      // OpenAPI 3.x requestBody
      const requestBody = operation.requestBody as Record<string, unknown> | undefined;
      if (requestBody) {
        const content = requestBody.content as Record<string, Record<string, unknown>> | undefined;
        if (content) {
          if (content['application/json']) {
            bodyType = 'json';
            bodyTemplate = extractSchemaExample(content['application/json'].schema as Record<string, unknown> | undefined);
          } else if (content['application/x-www-form-urlencoded'] || content['multipart/form-data']) {
            bodyType = 'form';
            const formContent = content['application/x-www-form-urlencoded'] || content['multipart/form-data'];
            bodyTemplate = extractSchemaExample(formContent?.schema as Record<string, unknown> | undefined);
          } else if (content['application/xml'] || content['text/xml']) {
            bodyType = 'xml';
          }
        }
      }

      // Swagger 2.x body parameter
      if (bodyType === 'none' && Array.isArray(parameters)) {
        const bodyParam = parameters.find(p => p.in === 'body');
        if (bodyParam) {
          bodyType = 'json';
          bodyTemplate = extractSchemaExample(bodyParam.schema as Record<string, unknown> | undefined);
        }
      }

      endpoints.push({
        name: opId,
        method: method.toUpperCase(),
        path,
        description: opDesc,
        tags: opTags,
        queryParams,
        headers,
        bodyType,
        bodyTemplate,
      });
    }
  }

  return { title, description, baseUrl, version, endpoints };
}

function extractSchemaExample(schema: Record<string, unknown> | undefined): string | null {
  if (!schema) return null;

  // If there's a direct example, use it
  if (schema.example) {
    return JSON.stringify(schema.example, null, 2);
  }

  // Build from properties
  if (schema.type === 'object' && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const example: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(props)) {
      example[key] = getPropertyExample(prop, key);
    }
    return JSON.stringify(example, null, 2);
  }

  if (schema.type === 'array' && schema.items) {
    const itemExample = extractSchemaExample(schema.items as Record<string, unknown>);
    if (itemExample) {
      return JSON.stringify([JSON.parse(itemExample)], null, 2);
    }
  }

  return null;
}

function getPropertyExample(prop: Record<string, unknown>, name: string): unknown {
  if (prop.example !== undefined) return prop.example;
  if (prop.default !== undefined) return prop.default;

  switch (prop.type) {
    case 'string':
      if (prop.format === 'email') return `{{${name}}}`;
      if (prop.format === 'date-time') return new Date().toISOString();
      if (prop.format === 'date') return new Date().toISOString().split('T')[0];
      if (prop.format === 'uuid') return `{{${name}}}`;
      if (prop.enum && Array.isArray(prop.enum)) return prop.enum[0];
      return `{{${name}}}`;
    case 'integer':
    case 'number':
      if (prop.minimum !== undefined) return prop.minimum;
      return 0;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return `{{${name}}}`;
  }
}

function parseBasicYaml(text: string): Record<string, unknown> {
  // Very basic YAML parser: supports simple key-value, nested objects, and arrays
  // For production use, a proper YAML library should be used
  const lines = text.split('\n');
  const root: Record<string, unknown> = {};
  const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: root, indent: -1 }];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const content = line.trim();

    // Pop stack to find correct parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    // Array item
    if (content.startsWith('- ')) {
      const val = content.slice(2).trim();
      const lastKey = Object.keys(parent).pop();
      if (lastKey && Array.isArray(parent[lastKey])) {
        if (val.includes(':')) {
          const obj: Record<string, unknown> = {};
          const colonIdx = val.indexOf(':');
          const k = val.slice(0, colonIdx).trim();
          const v = val.slice(colonIdx + 1).trim();
          obj[k] = parseYamlValue(v);
          (parent[lastKey] as unknown[]).push(obj);
          stack.push({ obj, indent });
        } else {
          (parent[lastKey] as unknown[]).push(parseYamlValue(val));
        }
      }
      continue;
    }

    // Key-value pair
    const colonIdx = content.indexOf(':');
    if (colonIdx > 0) {
      const key = content.slice(0, colonIdx).trim();
      const val = content.slice(colonIdx + 1).trim();

      if (val === '' || val === '|' || val === '>') {
        // Nested object or block scalar
        const child: Record<string, unknown> = {};
        parent[key] = child;
        stack.push({ obj: child, indent });
      } else if (val === '[]') {
        parent[key] = [];
      } else {
        parent[key] = parseYamlValue(val);
      }
    }
  }

  return root;
}

function parseYamlValue(val: string): unknown {
  if (val === 'true') return true;
  if (val === 'false') return false;
  if (val === 'null' || val === '~') return null;
  if (/^-?\d+$/.test(val)) return parseInt(val, 10);
  if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  return val;
}

// ── Variable Substitution ────────────────────────────────────────────────────

export function substituteVariables(template: string, variables: Map<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return variables.get(name) ?? `{{${name}}}`;
  });
}

// ── Simple JSONPath Extraction ───────────────────────────────────────────────

export function extractJsonPath(data: unknown, path: string): string | null {
  // Supports paths like: $.data.id, $.token, $.items[0].name, $.items.length
  if (!path.startsWith('$')) return null;

  const segments = path.slice(2) // remove "$."
    .split(/\./)
    .filter(Boolean);

  let current: unknown = data;

  for (const segment of segments) {
    if (current === null || current === undefined) return null;

    // Handle array index: items[0]
    const arrMatch = segment.match(/^(\w+)\[(\d+)\]$/);
    if (arrMatch) {
      const key = arrMatch[1];
      const idx = parseInt(arrMatch[2], 10);
      if (typeof current === 'object' && current !== null) {
        const obj = current as Record<string, unknown>;
        const arr = obj[key];
        if (Array.isArray(arr) && idx < arr.length) {
          current = arr[idx];
          continue;
        }
        return null;
      }
      return null;
    }

    // Handle "length" on arrays
    if (segment === 'length' && Array.isArray(current)) {
      return String(current.length);
    }

    // Regular property access
    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }

  if (current === null || current === undefined) return null;
  return typeof current === 'object' ? JSON.stringify(current) : String(current);
}

// ── Assertion Evaluation ─────────────────────────────────────────────────────

interface Assertion {
  type: string;        // status | header | body | latency | size
  target: string;      // statusCode | $.data.id | Content-Type | responseTime
  operator: string;    // equals | notEquals | contains | gt | lt | gte | lte | exists | notExists | matches
  value: string;       // expected value
}

interface AssertionResult {
  assertion: string;
  passed: boolean;
  actual: string;
}

export function evaluateAssertions(
  assertions: Assertion[],
  statusCode: number,
  responseHeaders: Record<string, string>,
  responseBody: unknown,
  latencyMs: number,
  responseSize: number,
): AssertionResult[] {
  const results: AssertionResult[] = [];

  for (const a of assertions) {
    let actual = '';

    // Resolve actual value based on type
    switch (a.type) {
      case 'status':
        actual = String(statusCode);
        break;
      case 'header': {
        const headerKey = a.target.toLowerCase();
        actual = responseHeaders[headerKey] ?? '';
        break;
      }
      case 'body':
        actual = extractJsonPath(responseBody, a.target) ?? '';
        break;
      case 'latency':
        actual = String(latencyMs);
        break;
      case 'size':
        actual = String(responseSize);
        break;
      default:
        actual = '';
    }

    const passed = evaluateOperator(actual, a.operator, a.value);
    results.push({
      assertion: `${a.type}:${a.target} ${a.operator} ${a.value}`,
      passed,
      actual,
    });
  }

  return results;
}

function evaluateOperator(actual: string, operator: string, expected: string): boolean {
  switch (operator) {
    case 'eq':
    case 'equals':
      return actual === expected;
    case 'neq':
    case 'notEquals':
      return actual !== expected;
    case 'contains':
      return actual.includes(expected);
    case 'notContains':
      return !actual.includes(expected);
    case 'gt':
      return parseFloat(actual) > parseFloat(expected);
    case 'lt':
      return parseFloat(actual) < parseFloat(expected);
    case 'gte':
      return parseFloat(actual) >= parseFloat(expected);
    case 'lte':
      return parseFloat(actual) <= parseFloat(expected);
    case 'exists':
      return actual !== '' && actual !== 'null' && actual !== 'undefined';
    case 'notExists':
      return actual === '' || actual === 'null' || actual === 'undefined';
    case 'matches':
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// ── Chain Execution ──────────────────────────────────────────────────────────

interface ChainStep {
  name: string;
  method: string;
  url: string;
  headers: string | null;   // JSON
  body: string | null;       // JSON body template
  extractors: string | null; // JSON
  assertions: string | null; // JSON
  thinkTimeSec: number;
  isEnabled: boolean;
}

export async function executeChainSteps(
  steps: ChainStep[],
  baseUrl: string,
  initialVariables: Record<string, string> = {},
  timeoutMs: number = 30000,
  authConfig?: AuthConfig | null,
  collectionHeaders?: Array<{ key: string; value: string }> | null,
): Promise<ChainStepResult[]> {
  const variables = new Map<string, string>(Object.entries(initialVariables));
  const results: ChainStepResult[] = [];

  for (const step of steps) {
    if (!step.isEnabled) continue;

    const result = await executeSingleStep(step, baseUrl, variables, timeoutMs, authConfig, collectionHeaders);
    results.push(result);

    // Add extracted variables to the map
    for (const [key, value] of Object.entries(result.extractedVariables)) {
      variables.set(key, value);
    }

    // Think time delay
    if (step.thinkTimeSec > 0) {
      await sleep(step.thinkTimeSec * 1000);
    }
  }

  return results;
}

async function executeSingleStep(
  step: ChainStep,
  baseUrl: string,
  variables: Map<string, string>,
  timeoutMs: number,
  authConfig?: AuthConfig | null,
  collectionHeaders?: Array<{ key: string; value: string }> | null,
): Promise<ChainStepResult> {
  const startTime = Date.now();
  let statusCode = 0;
  let responseBody: string | null = null;
  let responseSize = 0;
  let requestSize = 0;
  let error: string | null = null;
  const extractedVariables: Record<string, string> = {};
  let assertionResults: AssertionResult[] = [];
  let responseHeaders: Record<string, string> = {};

  try {
    // Build URL
    let url = substituteVariables(step.url, variables);
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    // Build headers: start with defaults, layer collection headers, then step headers
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Apply collection-level headers
    if (collectionHeaders && Array.isArray(collectionHeaders)) {
      for (const h of collectionHeaders) {
        if (h.key) headers[h.key] = substituteVariables(h.value, variables);
      }
    }

    // Apply auth config
    if (authConfig && authConfig.type !== 'none') {
      switch (authConfig.type) {
        case 'bearer':
          if (authConfig.token) {
            headers['Authorization'] = `Bearer ${substituteVariables(authConfig.token, variables)}`;
          }
          break;
        case 'apiKey': {
          const keyName = authConfig.apiKeyName || 'X-API-Key';
          const keyValue = authConfig.apiKey ? substituteVariables(authConfig.apiKey, variables) : '';
          if (authConfig.apiKeyIn === 'query') {
            const sep = url.includes('?') ? '&' : '?';
            url = `${url}${sep}${encodeURIComponent(keyName)}=${encodeURIComponent(keyValue)}`;
          } else {
            headers[keyName] = keyValue;
          }
          break;
        }
        case 'basic':
          if (authConfig.username) {
            const creds = `${substituteVariables(authConfig.username, variables)}:${substituteVariables(authConfig.password ?? '', variables)}`;
            headers['Authorization'] = `Basic ${Buffer.from(creds).toString('base64')}`;
          }
          break;
        case 'oauth2':
          if (authConfig.token) {
            headers['Authorization'] = `Bearer ${substituteVariables(authConfig.token, variables)}`;
          }
          break;
      }
    }

    // Apply step-level headers (override collection headers)
    if (step.headers) {
      try {
        const parsed = JSON.parse(step.headers) as Array<{ key: string; value: string }>;
        for (const h of parsed) {
          headers[h.key] = substituteVariables(h.value, variables);
        }
      } catch { /* ignore */ }
    }

    // Build body
    let body: string | undefined;
    if (step.body && ['POST', 'PUT', 'PATCH'].includes(step.method.toUpperCase())) {
      body = substituteVariables(step.body, variables);
    }

    // Calculate request size (headers + body)
    const headerStr = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    requestSize = new TextEncoder().encode(headerStr).length + (body ? new TextEncoder().encode(body).length : 0);

    // Execute request
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: step.method.toUpperCase(),
        headers,
        body,
        signal: controller.signal,
      });

      statusCode = response.status;

      // Collect response headers
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      responseBody = await response.text();
      responseSize = new TextEncoder().encode(responseBody).length;
    } finally {
      clearTimeout(timeout);
    }

    // Extract variables
    if (step.extractors) {
      try {
        const extractors = JSON.parse(step.extractors) as Array<{ name: string; source: string; path: string }>;
        let parsedBody: unknown = null;
        try { parsedBody = JSON.parse(responseBody ?? ''); } catch { /* not JSON */ }

        for (const ext of extractors) {
          let value: string | null = null;

          if (ext.source === 'body' || ext.source === 'json') {
            value = extractJsonPath(parsedBody, ext.path);
          } else if (ext.source === 'header') {
            value = responseHeaders[ext.path.toLowerCase()] ?? null;
          } else if (ext.source === 'cookie') {
            const setCookie = responseHeaders['set-cookie'] ?? '';
            const cookieMatch = setCookie.match(new RegExp(`${ext.path}=([^;]+)`));
            if (cookieMatch) value = cookieMatch[1];
          } else if (ext.source === 'status') {
            value = String(statusCode);
          }

          if (value !== null) {
            extractedVariables[ext.name] = value;
          }
        }
      } catch { /* ignore */ }
    }

    // Evaluate assertions
    if (step.assertions) {
      try {
        const assertions = JSON.parse(step.assertions) as Assertion[];
        let parsedBody: unknown = null;
        try { parsedBody = JSON.parse(responseBody ?? ''); } catch { /* not JSON */ }

        assertionResults = evaluateAssertions(
          assertions,
          statusCode,
          responseHeaders,
          parsedBody,
          Date.now() - startTime,
          responseSize,
        );
      } catch { /* ignore */ }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    if (error.includes('aborted')) {
      error = `Request timeout after ${timeoutMs}ms`;
    }
  }

  return {
    stepName: step.name,
    method: step.method,
    url: step.url,
    statusCode,
    latencyMs: Date.now() - startTime,
    responseSize,
    requestSize,
    extractedVariables,
    assertionResults,
    error,
    responseBody: responseBody ? responseBody.slice(0, 2000) : null,
  };
}

// ── Percentile Calculation ───────────────────────────────────────────────────

export function calculatePercentiles(latencies: number[]): { p50: number; p95: number; p99: number } {
  if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0 };

  const sorted = [...latencies].sort((a, b) => a - b);

  const percentile = (p: number): number => {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  return {
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

// ── Load Test Engine ─────────────────────────────────────────────────────────

export async function startLoadTest(
  scenarioId: string,
  runId: string,
): Promise<void> {
  const runControl = { stopped: false };
  activeRuns.set(runId, runControl);

  try {
    // Fetch scenario with chain and steps
    const scenario = await prisma.ptLoadScenario.findUniqueOrThrow({
      where: { id: scenarioId },
      include: {
        chain: {
          include: {
            steps: { where: { isEnabled: true }, orderBy: { sortOrder: 'asc' } },
            collection: true,
          },
        },
      },
    });

    const config: LoadTestConfig = {
      peakVU: scenario.peakVU,
      rampUpSec: scenario.rampUpSec,
      steadyStateSec: scenario.steadyStateSec,
      rampDownSec: scenario.rampDownSec,
      thinkTimeSec: scenario.thinkTimeSec,
      pacingSec: scenario.pacingSec,
      timeoutMs: scenario.timeoutMs,
      maxErrorPct: scenario.maxErrorPct,
      pattern: scenario.pattern,
      customRampSteps: scenario.customRampSteps ? JSON.parse(scenario.customRampSteps) : undefined,
    };

    const collection = scenario.chain.collection;
    const baseUrl = collection.baseUrl;
    const steps = scenario.chain.steps;
    const totalDuration = config.rampUpSec + config.steadyStateSec + config.rampDownSec;

    // Parse collection auth config and headers
    let authConfig: AuthConfig | null = null;
    let collectionHeaders: Array<{ key: string; value: string }> | null = null;
    try {
      if (collection.authConfig) authConfig = JSON.parse(collection.authConfig) as AuthConfig;
    } catch { /* ignore */ }
    try {
      if (collection.headers) collectionHeaders = JSON.parse(collection.headers) as Array<{ key: string; value: string }>;
    } catch { /* ignore */ }

    // Parse SLA thresholds
    let slaThresholds: SlaThreshold[] = [];
    try {
      if (scenario.slaThresholds) slaThresholds = JSON.parse(scenario.slaThresholds) as SlaThreshold[];
    } catch { /* ignore */ }

    // Metrics accumulator per interval
    const allLatencies: number[] = [];
    const stepLatencies = new Map<string, number[]>();
    const stepErrors = new Map<string, Map<string, number>>();

    // Initialize step tracking
    for (const step of steps) {
      stepLatencies.set(step.name, []);
      stepErrors.set(step.name, new Map());
    }

    // Interval metrics collection
    let intervalRequests = 0;
    let intervalErrors = 0;
    let intervalLatencies: number[] = [];
    let intervalBytesIn = 0;
    let intervalBytesOut = 0;
    let currentActiveVU = 0;
    let totalRequests = 0;
    let totalErrors = 0;
    const testStartTime = Date.now();

    // Save metrics every second
    const metricsInterval = setInterval(async () => {
      if (intervalRequests === 0 && currentActiveVU === 0) return;

      const percs = calculatePercentiles(intervalLatencies);
      const avgLatency = intervalLatencies.length > 0
        ? intervalLatencies.reduce((a, b) => a + b, 0) / intervalLatencies.length
        : 0;

      try {
        await prisma.ptTestMetric.create({
          data: {
            runId,
            timestamp: new Date(),
            activeVU: currentActiveVU,
            requestCount: intervalRequests,
            errorCount: intervalErrors,
            avgLatencyMs: avgLatency,
            p95LatencyMs: percs.p95,
            p99LatencyMs: percs.p99,
            tps: intervalRequests, // per-second since interval = 1s
            bytesIn: BigInt(intervalBytesIn),
            bytesOut: BigInt(intervalBytesOut),
          },
        });
      } catch (err) {
        logger.error('Failed to save metric', { error: err instanceof Error ? err.message : String(err) });
      }

      // Reset interval counters
      intervalRequests = 0;
      intervalErrors = 0;
      intervalLatencies = [];
      intervalBytesIn = 0;
      intervalBytesOut = 0;
    }, 1000);

    // VU runner function
    const runVU = async (vuId: number): Promise<void> => {
      const variables = new Map<string, string>();
      variables.set('vuId', String(vuId));

      while (!runControl.stopped) {
        const elapsed = (Date.now() - testStartTime) / 1000;
        if (elapsed >= totalDuration) break;

        for (const step of steps) {
          if (runControl.stopped) break;
          const elapsed2 = (Date.now() - testStartTime) / 1000;
          if (elapsed2 >= totalDuration) break;

          const result = await executeSingleStep(
            {
              name: step.name,
              method: step.method,
              url: step.url,
              headers: step.headers,
              body: step.body,
              extractors: step.extractors,
              assertions: step.assertions,
              thinkTimeSec: 0, // handled separately
              isEnabled: true,
            },
            baseUrl,
            variables,
            config.timeoutMs,
            authConfig,
            collectionHeaders,
          );

          // Record metrics
          totalRequests++;
          intervalRequests++;
          allLatencies.push(result.latencyMs);
          intervalLatencies.push(result.latencyMs);
          intervalBytesIn += result.responseSize;
          intervalBytesOut += result.requestSize;

          const stepLats = stepLatencies.get(step.name);
          if (stepLats) stepLats.push(result.latencyMs);

          if (result.error || result.statusCode >= 400) {
            totalErrors++;
            intervalErrors++;
            const stepErrs = stepErrors.get(step.name);
            if (stepErrs) {
              const status = result.error ? 'error' : String(result.statusCode);
              stepErrs.set(status, (stepErrs.get(status) ?? 0) + 1);
            }
          }

          // Extract variables for next step
          for (const [key, value] of Object.entries(result.extractedVariables)) {
            variables.set(key, value);
          }

          // Think time between steps
          if (step.thinkTimeSec > 0) {
            await sleep(step.thinkTimeSec * 1000);
          }
        }

        // Pacing between iterations
        if (config.pacingSec > 0) {
          await sleep(config.pacingSec * 1000);
        }

        // Think time between iterations
        if (config.thinkTimeSec > 0) {
          await sleep(config.thinkTimeSec * 1000);
        }

        // Check error rate threshold
        if (totalRequests > 0) {
          const errorRate = (totalErrors / totalRequests) * 100;
          if (errorRate > config.maxErrorPct) {
            logger.warn(`Run ${runId}: Error rate ${errorRate.toFixed(1)}% exceeded threshold ${config.maxErrorPct}%`);
            break;
          }
        }
      }
    };

    // Orchestrate VU ramp-up/steady/ramp-down
    const vuPromises: Promise<void>[] = [];
    const vuAborts: Array<() => void> = [];
    let launchedVU = 0;

    const getTargetVU = (elapsedSec: number): number => {
      if (config.pattern === 'custom' && config.customRampSteps) {
        // Find the right step
        let target = 0;
        for (const step of config.customRampSteps) {
          if (elapsedSec >= step.atSec) target = step.targetVU;
        }
        return target;
      }

      if (config.pattern === 'spike') {
        // Instant ramp to peak, hold, instant drop
        if (elapsedSec < config.rampUpSec) return config.peakVU;
        if (elapsedSec < config.rampUpSec + config.steadyStateSec) return config.peakVU;
        return 0;
      }

      // Default ramp pattern
      if (elapsedSec < config.rampUpSec) {
        // Ramp up: linear
        return Math.min(config.peakVU, Math.ceil((elapsedSec / config.rampUpSec) * config.peakVU));
      }
      if (elapsedSec < config.rampUpSec + config.steadyStateSec) {
        return config.peakVU;
      }
      // Ramp down
      const rampDownElapsed = elapsedSec - config.rampUpSec - config.steadyStateSec;
      return Math.max(0, Math.ceil(config.peakVU * (1 - rampDownElapsed / config.rampDownSec)));
    };

    // VU orchestration loop — runs every second
    const orchestrate = async (): Promise<void> => {
      while (!runControl.stopped) {
        const elapsedSec = (Date.now() - testStartTime) / 1000;
        if (elapsedSec >= totalDuration) break;

        const targetVU = getTargetVU(elapsedSec);
        currentActiveVU = targetVU;

        // Launch new VUs if needed
        while (launchedVU < targetVU) {
          launchedVU++;
          const vuId = launchedVU;
          vuPromises.push(runVU(vuId));
        }

        await sleep(1000);
      }
    };

    await orchestrate();

    // Wait for all VUs to finish (with a timeout)
    runControl.stopped = true;
    await Promise.allSettled(vuPromises);

    clearInterval(metricsInterval);

    // Calculate final summary
    const percs = calculatePercentiles(allLatencies);
    const avgLatency = allLatencies.length > 0
      ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length
      : 0;
    const maxLatency = allLatencies.length > 0 ? Math.max(...allLatencies) : 0;
    const durationSec = (Date.now() - testStartTime) / 1000;
    const avgTps = durationSec > 0 ? totalRequests / durationSec : 0;

    // Calculate peak TPS from metrics
    const metrics = await prisma.ptTestMetric.findMany({
      where: { runId },
      orderBy: { timestamp: 'asc' },
    });
    const peakTps = metrics.length > 0 ? Math.max(...metrics.map(m => m.tps)) : avgTps;
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    // Save step metrics
    for (const step of steps) {
      const lats = stepLatencies.get(step.name) ?? [];
      const errs = stepErrors.get(step.name) ?? new Map();
      const stepPercs = calculatePercentiles(lats);
      const stepAvg = lats.length > 0 ? lats.reduce((a, b) => a + b, 0) / lats.length : 0;
      const stepMin = lats.length > 0 ? Math.min(...lats) : 0;
      const stepMax = lats.length > 0 ? Math.max(...lats) : 0;
      const stepTotalErrors = Array.from(errs.values()).reduce((a, b) => a + b, 0);

      await prisma.ptStepMetric.create({
        data: {
          runId,
          stepName: step.name,
          method: step.method,
          url: step.url,
          totalCalls: lats.length,
          totalErrors: stepTotalErrors,
          avgLatencyMs: stepAvg,
          p95LatencyMs: stepPercs.p95,
          p99LatencyMs: stepPercs.p99,
          minLatencyMs: stepMin,
          maxLatencyMs: stepMax,
          errorsByStatus: errs.size > 0 ? JSON.stringify(Object.fromEntries(errs)) : null,
        },
      });
    }

    // Evaluate SLA thresholds
    const slaResults: SlaResult[] = [];
    if (slaThresholds.length > 0) {
      const metricValues: Record<string, number> = {
        avgLatency: avgLatency,
        p95Latency: percs.p95,
        p99Latency: percs.p99,
        errorRate: errorRate,
        tps: avgTps,
      };

      for (const sla of slaThresholds) {
        const actual = metricValues[sla.metric] ?? 0;
        let passed = false;
        switch (sla.operator) {
          case 'lt': passed = actual < sla.value; break;
          case 'gt': passed = actual > sla.value; break;
          case 'lte': passed = actual <= sla.value; break;
          case 'gte': passed = actual >= sla.value; break;
        }
        slaResults.push({
          metric: sla.metric,
          operator: sla.operator,
          threshold: sla.value,
          actual: Math.round(actual * 100) / 100,
          passed,
        });
      }
    }

    // Update run with summary
    await prisma.ptTestRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        totalRequests,
        totalErrors,
        avgLatencyMs: avgLatency,
        p50LatencyMs: percs.p50,
        p95LatencyMs: percs.p95,
        p99LatencyMs: percs.p99,
        maxLatencyMs: maxLatency,
        peakTps,
        avgTps,
        errorRate,
        slaResults: slaResults.length > 0 ? JSON.stringify(slaResults) : null,
      },
    });

    logger.info(`Load test ${runId} completed`, {
      totalRequests,
      totalErrors,
      avgLatencyMs: avgLatency.toFixed(1),
      p95: percs.p95.toFixed(1),
      durationSec: durationSec.toFixed(1),
    });
  } catch (err) {
    logger.error(`Load test ${runId} failed`, {
      error: err instanceof Error ? err.message : String(err),
    });

    await prisma.ptTestRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        completedAt: new Date(),
      },
    }).catch(() => {});
  } finally {
    activeRuns.delete(runId);
  }
}

// ── Demo Data Seeding ────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<{
  collection: { id: string; name: string };
  chain: { id: string; name: string };
  scenario: { id: string; name: string };
}> {
  // Create demo collection
  const collection = await prisma.ptApiCollection.create({
    data: {
      name: 'E-Commerce Order Flow (Demo)',
      description: 'Demo API collection simulating an e-commerce order flow with authentication, order creation, and retrieval.',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      authConfig: JSON.stringify({
        type: 'bearer',
        token: '{{authToken}}',
      }),
      headers: JSON.stringify([
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Accept', value: 'application/json' },
      ]),
      variables: JSON.stringify([
        { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', env: 'default' },
        { key: 'userId', value: '1', env: 'default' },
      ]),
    },
  });

  // Create endpoints
  const authEndpoint = await prisma.ptApiEndpoint.create({
    data: {
      collectionId: collection.id,
      name: 'Login / Authenticate',
      method: 'POST',
      path: '/posts',
      description: 'Simulates authentication — POST to create a session token',
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        title: 'auth-login',
        body: JSON.stringify({ username: 'demo_user', password: 'secure123' }),
        userId: 1,
      }, null, 2),
      tags: JSON.stringify(['auth', 'login']),
    },
  });

  const createOrderEndpoint = await prisma.ptApiEndpoint.create({
    data: {
      collectionId: collection.id,
      name: 'Create Order',
      method: 'POST',
      path: '/posts',
      description: 'Create a new order in the system',
      bodyType: 'json',
      bodyTemplate: JSON.stringify({
        title: 'New Order #{{orderId}}',
        body: JSON.stringify({
          product: 'Widget Pro',
          quantity: 2,
          price: 29.99,
          customerId: '{{userId}}',
        }),
        userId: 1,
      }, null, 2),
      tags: JSON.stringify(['orders', 'create']),
    },
  });

  const getOrderEndpoint = await prisma.ptApiEndpoint.create({
    data: {
      collectionId: collection.id,
      name: 'Get Order Details',
      method: 'GET',
      path: '/posts/{{orderId}}',
      description: 'Retrieve order details by ID',
      tags: JSON.stringify(['orders', 'read']),
    },
  });

  const listOrdersEndpoint = await prisma.ptApiEndpoint.create({
    data: {
      collectionId: collection.id,
      name: 'List User Orders',
      method: 'GET',
      path: '/posts',
      description: 'List all orders for the authenticated user',
      queryParams: JSON.stringify([
        { key: 'userId', value: '{{userId}}', enabled: true },
        { key: '_limit', value: '10', enabled: true },
      ]),
      tags: JSON.stringify(['orders', 'list']),
    },
  });

  // Create chain
  const chain = await prisma.ptApiChain.create({
    data: {
      collectionId: collection.id,
      name: 'Complete Order Flow',
      description: 'Full end-to-end flow: Authenticate → Create Order → Get Order → List Orders',
      isDemo: true,
    },
  });

  // Create chain steps
  await prisma.ptChainStep.createMany({
    data: [
      {
        chainId: chain.id,
        endpointId: authEndpoint.id,
        sortOrder: 1,
        name: 'Step 1: Authenticate',
        method: 'POST',
        url: '/posts',
        headers: JSON.stringify([
          { key: 'Content-Type', value: 'application/json' },
        ]),
        body: JSON.stringify({
          title: 'auth-login',
          body: '{"username":"demo_user","password":"secure123"}',
          userId: 1,
        }),
        extractors: JSON.stringify([
          { name: 'authToken', source: 'body', path: '$.id' },
        ]),
        assertions: JSON.stringify([
          { type: 'status', target: 'statusCode', operator: 'equals', value: '201' },
          { type: 'body', target: '$.id', operator: 'exists', value: '' },
        ]),
        thinkTimeSec: 0.5,
        isEnabled: true,
      },
      {
        chainId: chain.id,
        endpointId: createOrderEndpoint.id,
        sortOrder: 2,
        name: 'Step 2: Create Order',
        method: 'POST',
        url: '/posts',
        headers: JSON.stringify([
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Authorization', value: 'Bearer {{authToken}}' },
        ]),
        body: JSON.stringify({
          title: 'New Order',
          body: '{"product":"Widget Pro","quantity":2,"price":29.99}',
          userId: 1,
        }),
        extractors: JSON.stringify([
          { name: 'orderId', source: 'body', path: '$.id' },
        ]),
        assertions: JSON.stringify([
          { type: 'status', target: 'statusCode', operator: 'equals', value: '201' },
          { type: 'body', target: '$.id', operator: 'exists', value: '' },
          { type: 'latency', target: 'responseTime', operator: 'lt', value: '5000' },
        ]),
        thinkTimeSec: 1,
        isEnabled: true,
      },
      {
        chainId: chain.id,
        endpointId: getOrderEndpoint.id,
        sortOrder: 3,
        name: 'Step 3: Get Order Details',
        method: 'GET',
        url: '/posts/1',
        headers: JSON.stringify([
          { key: 'Authorization', value: 'Bearer {{authToken}}' },
        ]),
        assertions: JSON.stringify([
          { type: 'status', target: 'statusCode', operator: 'equals', value: '200' },
          { type: 'body', target: '$.title', operator: 'exists', value: '' },
          { type: 'latency', target: 'responseTime', operator: 'lt', value: '3000' },
        ]),
        thinkTimeSec: 0.5,
        isEnabled: true,
      },
      {
        chainId: chain.id,
        endpointId: listOrdersEndpoint.id,
        sortOrder: 4,
        name: 'Step 4: List Orders',
        method: 'GET',
        url: '/posts?userId=1&_limit=10',
        headers: JSON.stringify([
          { key: 'Authorization', value: 'Bearer {{authToken}}' },
        ]),
        assertions: JSON.stringify([
          { type: 'status', target: 'statusCode', operator: 'equals', value: '200' },
          { type: 'latency', target: 'responseTime', operator: 'lt', value: '3000' },
        ]),
        thinkTimeSec: 0,
        isEnabled: true,
      },
    ],
  });

  // Create scenario
  const scenario = await prisma.ptLoadScenario.create({
    data: {
      chainId: chain.id,
      name: 'Steady Load Test — 10 VUs for 30 seconds',
      description: 'A moderate load test ramping up to 10 virtual users over 10 seconds, holding steady for 30 seconds, then ramping down over 5 seconds.',
      pattern: 'ramp',
      peakVU: 10,
      rampUpSec: 10,
      steadyStateSec: 30,
      rampDownSec: 5,
      thinkTimeSec: 1,
      pacingSec: 0,
      timeoutMs: 30000,
      maxErrorPct: 20,
      slaThresholds: JSON.stringify([
        { metric: 'p95Latency', operator: 'lte', value: 2000, severity: 'warning' },
        { metric: 'errorRate', operator: 'lte', value: 5, severity: 'critical' },
        { metric: 'avgTps', operator: 'gte', value: 5, severity: 'warning' },
      ]),
      isDemo: true,
    },
  });

  return {
    collection: { id: collection.id, name: collection.name },
    chain: { id: chain.id, name: chain.name },
    scenario: { id: scenario.id, name: scenario.name },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
