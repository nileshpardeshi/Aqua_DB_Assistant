import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Database,
  Play,
  Loader2,
  RefreshCw,
  Columns3,
  Shuffle,
  TrendingUp,
  Hash,
  FlaskConical,
  Coffee,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreatePerformanceRun } from '@/hooks/use-performance';

// ── Types ────────────────────────────────────────────────────────────────────

interface ParamFieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  width?: string; // Tailwind width class
}

interface GeneratorDef {
  name: string;
  javaExpression?: string;
  params?: ParamFieldDef[];
}

interface GeneratorCategory {
  label: string;
  generators: GeneratorDef[];
}

interface ColumnConfig {
  name: string;
  type: string;
  generator: string;
  params: Record<string, string>;
}

type Distribution = 'random' | 'sequential' | 'realistic';

// ── Constants ────────────────────────────────────────────────────────────────

const ROW_COUNT_OPTIONS = [
  { label: '1K', value: 1000 },
  { label: '10K', value: 10000 },
  { label: '100K', value: 100000 },
  { label: '1M', value: 1000000 },
];

const DISTRIBUTION_OPTIONS: { value: Distribution; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { value: 'random', label: 'Random', icon: Shuffle, description: 'Uniformly random values' },
  { value: 'sequential', label: 'Sequential', icon: TrendingUp, description: 'Ordered / incremental' },
  { value: 'realistic', label: 'Realistic', icon: Database, description: 'Natural-looking data' },
];

// ── Generator Registry ───────────────────────────────────────────────────────

const GENERATOR_CATEGORIES: GeneratorCategory[] = [
  {
    label: 'Core',
    generators: [
      { name: 'Auto Detect' },
      { name: 'Static Value', params: [
        { key: 'value', label: 'Value', type: 'text', placeholder: 'Enter fixed value...' },
      ]},
      { name: 'Null' },
      { name: 'Sequence', params: [
        { key: 'start', label: 'Start', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-16' },
        { key: 'step', label: 'Step', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-16' },
      ]},
      { name: 'Boolean' },
    ],
  },
  {
    label: 'Identity',
    generators: [
      { name: 'UUID', javaExpression: 'UUID.randomUUID().toString()' },
      { name: 'Incremental ID' },
      { name: 'ULID' },
    ],
  },
  {
    label: 'Numbers',
    generators: [
      { name: 'Random Integer', javaExpression: 'ThreadLocalRandom.current().nextInt(min, max + 1)', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0', defaultValue: '0', width: 'w-20' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '100', defaultValue: '100', width: 'w-20' },
      ]},
      { name: 'Random Long', javaExpression: 'ThreadLocalRandom.current().nextLong(min, max + 1)', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0', defaultValue: '0', width: 'w-20' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '1000000', defaultValue: '1000000', width: 'w-24' },
      ]},
      { name: 'Random Float', javaExpression: 'ThreadLocalRandom.current().nextFloat()', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0.0', defaultValue: '0', width: 'w-16' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '1.0', defaultValue: '1', width: 'w-16' },
        { key: 'precision', label: 'Decimals', type: 'number', placeholder: '2', defaultValue: '2', width: 'w-14' },
      ]},
      { name: 'Random Double', javaExpression: 'ThreadLocalRandom.current().nextDouble(min, max)', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0.0', defaultValue: '0', width: 'w-16' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '1.0', defaultValue: '1', width: 'w-16' },
        { key: 'precision', label: 'Decimals', type: 'number', placeholder: '4', defaultValue: '4', width: 'w-14' },
      ]},
      { name: 'Gaussian', javaExpression: 'new Random().nextGaussian() * stdDev + mean', params: [
        { key: 'mean', label: 'Mean', type: 'number', placeholder: '0', defaultValue: '0', width: 'w-16' },
        { key: 'stddev', label: 'StdDev', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-16' },
      ]},
      { name: 'Currency', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '1', defaultValue: '1', width: 'w-20' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '999', defaultValue: '999', width: 'w-20' },
        { key: 'symbol', label: 'Symbol', type: 'text', placeholder: '$', defaultValue: '$', width: 'w-12' },
      ]},
    ],
  },
  {
    label: 'Strings',
    generators: [
      { name: 'Random String', javaExpression: 'RandomStringUtils.random(length)', params: [
        { key: 'length', label: 'Length', type: 'number', placeholder: '10', defaultValue: '10', width: 'w-16' },
        { key: 'charset', label: 'Charset', type: 'select', defaultValue: 'alphanumeric',
          options: ['alphanumeric', 'alpha', 'numeric', 'hex', 'ascii'] },
      ]},
      { name: 'Random Alpha', javaExpression: 'RandomStringUtils.randomAlphabetic(length)', params: [
        { key: 'length', label: 'Length', type: 'number', placeholder: '10', defaultValue: '10', width: 'w-16' },
      ]},
      { name: 'Random Alphanumeric', javaExpression: 'RandomStringUtils.randomAlphanumeric(length)', params: [
        { key: 'length', label: 'Length', type: 'number', placeholder: '10', defaultValue: '10', width: 'w-16' },
      ]},
      { name: 'Hex String', params: [
        { key: 'length', label: 'Bytes', type: 'number', placeholder: '16', defaultValue: '16', width: 'w-16' },
      ]},
      { name: 'Regex Pattern', params: [
        { key: 'pattern', label: 'Regex', type: 'text', placeholder: '[A-Z]{3}-\\d{4}', width: 'w-40' },
      ]},
      { name: 'Enum Values', params: [
        { key: 'values', label: 'Values (comma-sep)', type: 'text', placeholder: 'active,inactive,pending', width: 'w-48' },
      ]},
      { name: 'Weighted Random', params: [
        { key: 'values', label: 'Values', type: 'text', placeholder: 'active,inactive,pending', width: 'w-36' },
        { key: 'weights', label: 'Weights', type: 'text', placeholder: '70,20,10', width: 'w-24' },
      ]},
      { name: 'Formatted String', javaExpression: 'String.format(format, id)', params: [
        { key: 'format', label: 'Format', type: 'text', placeholder: 'ORD-%05d', width: 'w-36' },
      ]},
    ],
  },
  {
    label: 'Personal',
    generators: [
      { name: 'First Name', javaExpression: 'faker.name().firstName()' },
      { name: 'Last Name', javaExpression: 'faker.name().lastName()' },
      { name: 'Full Name', javaExpression: 'faker.name().fullName()' },
      { name: 'Email', javaExpression: 'faker.internet().emailAddress()' },
      { name: 'Phone', javaExpression: 'faker.phoneNumber().phoneNumber()' },
      { name: 'Username', javaExpression: 'faker.name().username()' },
    ],
  },
  {
    label: 'Location',
    generators: [
      { name: 'Address', javaExpression: 'faker.address().streetAddress()' },
      { name: 'City', javaExpression: 'faker.address().city()' },
      { name: 'State', javaExpression: 'faker.address().state()' },
      { name: 'Country', javaExpression: 'faker.address().country()' },
      { name: 'Zip Code', javaExpression: 'faker.address().zipCode()' },
      { name: 'Latitude', javaExpression: 'faker.address().latitude()' },
      { name: 'Longitude', javaExpression: 'faker.address().longitude()' },
    ],
  },
  {
    label: 'Date & Time',
    generators: [
      { name: 'Date', javaExpression: 'LocalDate.now().minusDays(random.nextInt(365))' },
      { name: 'Timestamp', javaExpression: 'LocalDateTime.now().minusHours(random.nextLong(8760))' },
      { name: 'Date Range', params: [
        { key: 'from', label: 'From', type: 'text', placeholder: '2020-01-01', defaultValue: '2020-01-01', width: 'w-28' },
        { key: 'to', label: 'To', type: 'text', placeholder: '2026-12-31', defaultValue: '2026-12-31', width: 'w-28' },
      ]},
      { name: 'ISO DateTime', javaExpression: 'Instant.now().toString()' },
      { name: 'Unix Timestamp', javaExpression: 'System.currentTimeMillis()' },
      { name: 'Time Only', javaExpression: 'LocalTime.now()' },
    ],
  },
  {
    label: 'Internet',
    generators: [
      { name: 'URL', javaExpression: 'faker.internet().url()' },
      { name: 'IP Address', javaExpression: 'faker.internet().ipV4Address()' },
      { name: 'IPv6', javaExpression: 'faker.internet().ipV6Address()' },
      { name: 'MAC Address', javaExpression: 'faker.internet().macAddress()' },
      { name: 'Domain', javaExpression: 'faker.internet().domainName()' },
      { name: 'User Agent', javaExpression: 'faker.internet().userAgentAny()' },
    ],
  },
  {
    label: 'Text',
    generators: [
      { name: 'Word', javaExpression: 'faker.lorem().word()' },
      { name: 'Sentence', javaExpression: 'faker.lorem().sentence()' },
      { name: 'Paragraph', javaExpression: 'faker.lorem().paragraph()' },
      { name: 'Lorem Text', params: [
        { key: 'words', label: 'Words', type: 'number', placeholder: '50', defaultValue: '50', width: 'w-16' },
      ]},
    ],
  },
  {
    label: 'Business',
    generators: [
      { name: 'Company', javaExpression: 'faker.company().name()' },
      { name: 'Department' },
      { name: 'Job Title', javaExpression: 'faker.job().title()' },
    ],
  },
  {
    label: 'Java Standard Library',
    generators: [
      { name: 'UUID.randomUUID()', javaExpression: 'java.util.UUID.randomUUID().toString()' },
      { name: 'Math.random()', javaExpression: 'Math.random()' },
      { name: 'ThreadLocalRandom.nextInt()', javaExpression: 'ThreadLocalRandom.current().nextInt(min, max + 1)', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0', defaultValue: '0', width: 'w-20' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '1000', defaultValue: '1000', width: 'w-20' },
      ]},
      { name: 'ThreadLocalRandom.nextLong()', javaExpression: 'ThreadLocalRandom.current().nextLong(min, max + 1)', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0', defaultValue: '0', width: 'w-20' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '1000000', defaultValue: '1000000', width: 'w-24' },
      ]},
      { name: 'ThreadLocalRandom.nextDouble()', javaExpression: 'ThreadLocalRandom.current().nextDouble(min, max)', params: [
        { key: 'min', label: 'Min', type: 'number', placeholder: '0.0', defaultValue: '0', width: 'w-16' },
        { key: 'max', label: 'Max', type: 'number', placeholder: '1.0', defaultValue: '1', width: 'w-16' },
      ]},
      { name: 'BigDecimal.valueOf()', javaExpression: 'BigDecimal.valueOf(random.nextDouble() * max).setScale(scale, RoundingMode.HALF_UP)', params: [
        { key: 'max', label: 'Max', type: 'number', placeholder: '10000', defaultValue: '10000', width: 'w-20' },
        { key: 'scale', label: 'Scale', type: 'number', placeholder: '2', defaultValue: '2', width: 'w-14' },
      ]},
      { name: 'LocalDate.now()', javaExpression: 'java.time.LocalDate.now()' },
      { name: 'LocalDateTime.now()', javaExpression: 'java.time.LocalDateTime.now()' },
      { name: 'Instant.now()', javaExpression: 'java.time.Instant.now()' },
      { name: 'System.currentTimeMillis()', javaExpression: 'System.currentTimeMillis()' },
      { name: 'String.format()', javaExpression: 'String.format(pattern, args...)', params: [
        { key: 'pattern', label: 'Pattern', type: 'text', placeholder: '%s-%05d', width: 'w-28' },
        { key: 'prefix', label: 'Prefix', type: 'text', placeholder: 'ORD', width: 'w-20' },
      ]},
      { name: 'SecureRandom', javaExpression: 'new SecureRandom().nextInt(bound)', params: [
        { key: 'bound', label: 'Bound', type: 'number', placeholder: '1000000', defaultValue: '1000000', width: 'w-24' },
      ]},
      { name: 'Base64 Encode', javaExpression: 'Base64.getEncoder().encodeToString(bytes)', params: [
        { key: 'length', label: 'Byte length', type: 'number', placeholder: '16', defaultValue: '16', width: 'w-16' },
      ]},
      { name: 'MD5 Hash', javaExpression: 'MessageDigest.getInstance("MD5").digest(input)' },
      { name: 'SHA-256 Hash', javaExpression: 'MessageDigest.getInstance("SHA-256").digest(input)' },
    ],
  },
  {
    label: 'Custom',
    generators: [
      { name: 'Custom Expression', params: [
        { key: 'expression', label: 'Expression', type: 'text', placeholder: 'faker.name().fullName() or custom Java/SQL', width: 'w-64' },
      ]},
    ],
  },
];

// Lookup map: generator name → GeneratorDef
const GENERATOR_DEF_MAP = new Map<string, GeneratorDef>(
  GENERATOR_CATEGORIES.flatMap(cat => cat.generators.map(g => [g.name, g] as const))
);

// ── Default Columns ──────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { name: 'id', type: 'INT', generator: 'Incremental ID', params: {} },
  { name: 'name', type: 'VARCHAR(255)', generator: 'Full Name', params: {} },
  { name: 'email', type: 'VARCHAR(255)', generator: 'Email', params: {} },
  { name: 'created_at', type: 'TIMESTAMP', generator: 'Timestamp', params: {} },
  { name: 'status', type: 'VARCHAR(50)', generator: 'Boolean', params: {} },
];

// ── Sample Value Generator ───────────────────────────────────────────────────

const SAMPLE_FRACTIONS = [0.42, 0.17, 0.88, 0.03, 0.65];

function pseudoRandomString(rowIndex: number, length: number, charset: string): string {
  let result = '';
  let seed = rowIndex * 31 + 7;
  for (let i = 0; i < Math.min(length, 24); i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    result += charset[seed % charset.length];
  }
  return result;
}

function generateSampleValue(generator: string, params: Record<string, string>, rowIndex: number): string {
  const frac = SAMPLE_FRACTIONS[rowIndex % 5];

  // ── Tier 1: Parameterized generators ─────────────────────────────────
  switch (generator) {
    case 'Static Value':
      return params.value || '(empty)';
    case 'Null':
      return 'NULL';
    case 'Sequence': {
      const start = parseInt(params.start || '1', 10);
      const step = parseInt(params.step || '1', 10);
      return String(start + rowIndex * step);
    }
    case 'Random Integer':
    case 'ThreadLocalRandom.nextInt()':
    case 'SecureRandom': {
      const min = parseInt(params.min || '0', 10);
      const max = parseInt(params.max || params.bound || '100', 10);
      return String(Math.floor(min + frac * (max - min)));
    }
    case 'Random Long':
    case 'ThreadLocalRandom.nextLong()': {
      const min = parseInt(params.min || '0', 10);
      const max = parseInt(params.max || '1000000', 10);
      return String(Math.floor(min + frac * (max - min)));
    }
    case 'Random Float':
    case 'Random Double':
    case 'ThreadLocalRandom.nextDouble()':
    case 'Math.random()': {
      const min = parseFloat(params.min || '0');
      const max = parseFloat(params.max || '1');
      const precision = parseInt(params.precision || '2', 10);
      return (min + frac * (max - min)).toFixed(precision);
    }
    case 'Gaussian': {
      const mean = parseFloat(params.mean || '0');
      const stddev = parseFloat(params.stddev || '1');
      const offsets = [-0.5, 1.2, -1.8, 0.3, 0.9];
      return (mean + offsets[rowIndex % 5] * stddev).toFixed(2);
    }
    case 'Currency': {
      const sym = params.symbol || '$';
      const min = parseFloat(params.min || '1');
      const max = parseFloat(params.max || '999');
      return `${sym}${(min + frac * (max - min)).toFixed(2)}`;
    }
    case 'BigDecimal.valueOf()': {
      const max = parseFloat(params.max || '10000');
      const scale = parseInt(params.scale || '2', 10);
      return (frac * max).toFixed(scale);
    }
    case 'Random String': {
      const len = parseInt(params.length || '10', 10);
      const charsets: Record<string, string> = {
        alphanumeric: 'abcdefghijklmnopqrstuvwxyz0123456789',
        alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
        numeric: '0123456789',
        hex: '0123456789abcdef',
        ascii: 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*',
      };
      return pseudoRandomString(rowIndex, len, charsets[params.charset || 'alphanumeric'] || charsets.alphanumeric);
    }
    case 'Random Alpha': {
      const len = parseInt(params.length || '10', 10);
      return pseudoRandomString(rowIndex, len, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
    case 'Random Alphanumeric': {
      const len = parseInt(params.length || '10', 10);
      return pseudoRandomString(rowIndex, len, 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
    case 'Hex String':
    case 'Base64 Encode': {
      const len = parseInt(params.length || '16', 10);
      return pseudoRandomString(rowIndex, len * 2, '0123456789abcdef').slice(0, len * 2);
    }
    case 'Regex Pattern': {
      const examples = ['ABC-1234', 'XYZ-5678', 'DEF-9012', 'GHI-3456', 'JKL-7890'];
      return examples[rowIndex % 5];
    }
    case 'Enum Values':
    case 'Weighted Random': {
      const values = (params.values || 'A,B,C').split(',').map(v => v.trim()).filter(Boolean);
      return values.length > 0 ? values[rowIndex % values.length] : '(empty)';
    }
    case 'Formatted String':
    case 'String.format()': {
      const format = params.format || params.pattern || 'ITEM-%05d';
      const prefix = params.prefix || '';
      const num = String(rowIndex + 1).padStart(5, '0');
      let result = format;
      if (result.includes('%s')) result = result.replace('%s', prefix || 'VAL');
      result = result.replace(/%0?\d*d/, num);
      return result;
    }
    case 'Date Range': {
      const dates = ['2021-03-15', '2022-07-22', '2023-01-10', '2024-09-05', '2025-06-18'];
      return dates[rowIndex % 5];
    }
    case 'Lorem Text': {
      const words = params.words || '50';
      return `Lorem ipsum dolor sit... (${words} words)`;
    }
    case 'Custom Expression':
      return params.expression ? `eval(${params.expression.slice(0, 30)})` : 'custom_value';
    default:
      break;
  }

  // ── Tier 2: Java generators → basic equivalents ──────────────────────
  const javaMapping: Record<string, string> = {
    'UUID.randomUUID()': 'UUID',
    'LocalDate.now()': 'Date',
    'LocalDateTime.now()': 'Timestamp',
    'Instant.now()': 'ISO DateTime',
    'System.currentTimeMillis()': 'Unix Timestamp',
  };
  if (javaMapping[generator]) {
    return generateSampleValue(javaMapping[generator], params, rowIndex);
  }

  // ── Tier 3: Static sample arrays ─────────────────────────────────────
  const samples: Record<string, string[]> = {
    'Incremental ID': ['1', '2', '3', '4', '5'],
    'UUID': ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'd4e5f6a7-b8c9-0123-defa-234567890123', 'e5f6a7b8-c9d0-1234-efab-345678901234'],
    'ULID': ['01ARZ3NDEKTSV4RRFFQ69G5FAV', '01BX5ZZKBKACTAV9WEVGEMMVRY', '01CDF8RYZNGXJ5HFBPBQ2T4GVN', '01DRVS55FXNG6V1P5J8CVKJ4MR', '01EWMPB1K7T4YNVKC5J7YGGBHJ'],
    'Full Name': ['Alice Johnson', 'Bob Smith', 'Carol Williams', 'David Brown', 'Eve Davis'],
    'First Name': ['Alice', 'Bob', 'Carol', 'David', 'Eve'],
    'Last Name': ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis'],
    'Username': ['alice_j', 'bob.smith', 'carol42', 'dave_b', 'eve_d'],
    'Email': ['alice@example.com', 'bob@corp.io', 'carol@test.org', 'david@mail.com', 'eve@acme.co'],
    'Phone': ['+1-555-0101', '+1-555-0102', '+1-555-0103', '+1-555-0104', '+1-555-0105'],
    'Timestamp': ['2025-01-15 08:30:00', '2025-02-20 14:22:00', '2025-03-10 09:45:00', '2025-04-05 16:10:00', '2025-05-12 11:05:00'],
    'Date': ['2025-01-15', '2025-02-20', '2025-03-10', '2025-04-05', '2025-05-12'],
    'ISO DateTime': ['2025-01-15T08:30:00Z', '2025-02-20T14:22:00Z', '2025-03-10T09:45:00Z', '2025-04-05T16:10:00Z', '2025-05-12T11:05:00Z'],
    'Unix Timestamp': ['1705305000', '1708430520', '1710064700', '1712332200', '1715508300'],
    'Time Only': ['08:30:00', '14:22:00', '09:45:00', '16:10:00', '11:05:00'],
    'Boolean': ['true', 'false', 'true', 'true', 'false'],
    'Company': ['Acme Corp', 'TechStart Inc', 'GlobalServ Ltd', 'DataFlow Co', 'CloudBase LLC'],
    'Department': ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance'],
    'Job Title': ['Software Engineer', 'Product Manager', 'Designer', 'Data Analyst', 'VP Engineering'],
    'City': ['New York', 'San Francisco', 'London', 'Tokyo', 'Berlin'],
    'State': ['California', 'New York', 'Texas', 'Florida', 'Illinois'],
    'Country': ['United States', 'Canada', 'United Kingdom', 'Japan', 'Germany'],
    'Zip Code': ['10001', '94102', 'SW1A 1AA', '100-0001', '10115'],
    'Latitude': ['40.7128', '37.7749', '51.5074', '35.6762', '52.5200'],
    'Longitude': ['-74.0060', '-122.4194', '-0.1278', '139.6503', '13.4050'],
    'Address': ['123 Main St', '456 Oak Ave', '789 Pine Rd', '321 Elm Dr', '654 Maple Ln'],
    'Paragraph': ['Lorem ipsum dolor sit amet...', 'Sed do eiusmod tempor...', 'Ut enim ad minim veniam...', 'Duis aute irure dolor...', 'Excepteur sint occaecat...'],
    'Sentence': ['The quick brown fox.', 'A lazy dog sleeps.', 'Hello world again.', 'Testing data here.', 'Sample text value.'],
    'Word': ['lorem', 'ipsum', 'dolor', 'sit', 'amet'],
    'URL': ['https://example.com/a', 'https://test.io/b', 'https://demo.org/c', 'https://app.co/d', 'https://site.dev/e'],
    'IP Address': ['192.168.1.1', '10.0.0.42', '172.16.0.100', '192.168.0.55', '10.10.10.10'],
    'IPv6': ['2001:0db8:85a3::8a2e:0370:7334', 'fe80::1', '::1', '2001:db8::1', 'fd00::1'],
    'MAC Address': ['00:1A:2B:3C:4D:5E', 'AA:BB:CC:DD:EE:FF', '12:34:56:78:9A:BC', 'DE:AD:BE:EF:00:01', 'FE:DC:BA:98:76:54'],
    'Domain': ['example.com', 'test.io', 'demo.org', 'app.co', 'site.dev'],
    'User Agent': ['Mozilla/5.0 (Win NT 10.0; x64)', 'Mozilla/5.0 (Mac; Intel)', 'Mozilla/5.0 (Linux; Android)', 'Mozilla/5.0 (iPhone; iOS 17)', 'Mozilla/5.0 (X11; Linux)'],
    'MD5 Hash': ['d41d8cd98f00b204', '098f6bcd4621d373', '5d41402abc4b2a76', '7d793037a076832b', 'e99a18c428cb38d5'],
    'SHA-256 Hash': ['e3b0c44298fc1c14...', 'a591a6d40bf42040...', '2cf24dba5fb0a301...', 'd7a8fbb307d78094...', '5e884898da280471...'],
    'Auto Detect': ['value_1', 'value_2', 'value_3', 'value_4', 'value_5'],
  };

  const values = samples[generator] || samples['Auto Detect'];
  return values[rowIndex % values.length];
}

// ── Component ────────────────────────────────────────────────────────────────

export function SyntheticDataGenerator() {
  const { projectId } = useParams();
  const createRun = useCreatePerformanceRun();

  const [tableName, setTableName] = useState('');
  const [rowCount, setRowCount] = useState(10000);
  const [distribution, setDistribution] = useState<Distribution>('realistic');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('VARCHAR(255)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const handleAddColumn = useCallback(() => {
    if (!newColumnName.trim()) return;
    setColumns(prev => [
      ...prev,
      { name: newColumnName.trim(), type: newColumnType, generator: 'Auto Detect', params: {} },
    ]);
    setNewColumnName('');
    setNewColumnType('VARCHAR(255)');
  }, [newColumnName, newColumnType]);

  const handleRemoveColumn = useCallback((index: number) => {
    setColumns(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateGenerator = useCallback((index: number, generator: string) => {
    const genDef = GENERATOR_DEF_MAP.get(generator);
    const defaultParams: Record<string, string> = {};
    if (genDef?.params) {
      for (const p of genDef.params) {
        if (p.defaultValue !== undefined) {
          defaultParams[p.key] = p.defaultValue;
        }
      }
    }
    setColumns(prev =>
      prev.map((c, i) => (i === index ? { ...c, generator, params: defaultParams } : c))
    );
  }, []);

  const handleUpdateParam = useCallback((index: number, key: string, value: string) => {
    setColumns(prev =>
      prev.map((c, i) =>
        i === index ? { ...c, params: { ...c.params, [key]: value } } : c
      )
    );
  }, []);

  const handleLoadDemo = useCallback(() => {
    setTableName('orders');
    setRowCount(100000);
    setDistribution('realistic');
    setColumns([
      { name: 'id', type: 'BIGINT', generator: 'Incremental ID', params: {} },
      { name: 'order_number', type: 'VARCHAR(20)', generator: 'Formatted String', params: { format: 'ORD-%05d' } },
      { name: 'customer_id', type: 'BIGINT', generator: 'Random Integer', params: { min: '1', max: '10000' } },
      { name: 'product_name', type: 'VARCHAR(255)', generator: 'Company', params: {} },
      { name: 'total', type: 'DECIMAL(10,2)', generator: 'BigDecimal.valueOf()', params: { max: '999', scale: '2' } },
      { name: 'status', type: 'VARCHAR(50)', generator: 'Enum Values', params: { values: 'pending,processing,shipped,delivered,cancelled' } },
      { name: 'email', type: 'VARCHAR(255)', generator: 'Email', params: {} },
      { name: 'shipping_city', type: 'VARCHAR(100)', generator: 'City', params: {} },
      { name: 'tracking_id', type: 'VARCHAR(36)', generator: 'UUID.randomUUID()', params: {} },
      { name: 'created_at', type: 'TIMESTAMP', generator: 'LocalDateTime.now()', params: {} },
    ]);
    setShowPreview(true);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!tableName.trim() || !projectId) return;
    setIsGenerating(true);
    setProgress(0);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      await createRun.mutateAsync({
        projectId,
        type: 'data-generation',
        name: `Generate ${rowCount.toLocaleString()} rows for ${tableName}`,
        config: { tableName, rowCount, distribution, columns },
      });
      setProgress(100);
    } catch {
      // Error handled by mutation
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
      }, 1000);
    }
  }, [tableName, rowCount, distribution, columns, projectId, createRun]);

  return (
    <div className="space-y-6">
      {/* Table Name & Row Count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Table Name</label>
          <div className="relative">
            <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={tableName}
              onChange={e => setTableName(e.target.value)}
              placeholder="e.g., users, orders, products"
              className="w-full pl-10 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-card text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-aqua-500/30 focus:border-aqua-500 transition-all"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Number of Rows</label>
          <div className="flex gap-2">
            {ROW_COUNT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRowCount(opt.value)}
                className={cn(
                  'flex-1 px-3 py-2.5 text-sm font-medium rounded-lg border transition-all',
                  rowCount === opt.value
                    ? 'bg-aqua-50 border-aqua-300 text-aqua-700 shadow-sm'
                    : 'bg-card border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Distribution */}
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">Data Distribution</label>
        <div className="grid grid-cols-3 gap-3">
          {DISTRIBUTION_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setDistribution(opt.value)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left',
                  distribution === opt.value
                    ? 'bg-aqua-50 border-aqua-300 shadow-sm'
                    : 'bg-card border-slate-200 hover:bg-slate-50'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', distribution === opt.value ? 'text-aqua-600' : 'text-slate-400')} />
                <div>
                  <p className={cn('text-sm font-medium', distribution === opt.value ? 'text-aqua-700' : 'text-slate-700')}>{opt.label}</p>
                  <p className="text-[10px] text-slate-500">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Column Configuration */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
            <Columns3 className="w-3.5 h-3.5" />
            Column Configuration
          </label>
          <span className="text-[10px] text-slate-500">
            {columns.length} column{columns.length !== 1 ? 's' : ''} &middot; {GENERATOR_CATEGORIES.reduce((s, c) => s + c.generators.length, 0)} generators available
          </span>
        </div>

        <div className="bg-card border border-slate-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            <div className="col-span-3">Column</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-5">Generator</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Column Rows */}
          {columns.map((colCfg, idx) => {
            const genDef = GENERATOR_DEF_MAP.get(colCfg.generator);
            const hasParams = genDef?.params && genDef.params.length > 0;
            const hasJava = !!genDef?.javaExpression;

            return (
              <div key={idx} className="border-b border-slate-100 last:border-b-0">
                {/* Main Row */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-slate-50/50">
                  <div className="col-span-3">
                    <span className="text-sm font-mono text-slate-700">{colCfg.name}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {colCfg.type}
                    </span>
                  </div>
                  <div className="col-span-5">
                    <select
                      value={colCfg.generator}
                      onChange={e => handleUpdateGenerator(idx, e.target.value)}
                      className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-card text-slate-700 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                    >
                      {GENERATOR_CATEGORIES.map(cat => (
                        <optgroup key={cat.label} label={cat.label}>
                          {cat.generators.map(gen => (
                            <option key={gen.name} value={gen.name}>{gen.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      onClick={() => handleRemoveColumn(idx)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors px-2 py-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Parameter Sub-Row */}
                {(hasParams || hasJava) && (
                  <div className="px-4 pb-2.5 pt-0">
                    <div className="ml-[25%] pl-3 border-l-2 border-aqua-200 flex items-center gap-2.5 flex-wrap">
                      {genDef?.params?.map(paramDef => (
                        <div key={paramDef.key} className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500 whitespace-nowrap font-medium">
                            {paramDef.label}:
                          </label>
                          {paramDef.type === 'select' ? (
                            <select
                              value={colCfg.params[paramDef.key] ?? paramDef.defaultValue ?? ''}
                              onChange={e => handleUpdateParam(idx, paramDef.key, e.target.value)}
                              className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-card text-slate-700 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                            >
                              {paramDef.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={paramDef.type}
                              value={colCfg.params[paramDef.key] ?? paramDef.defaultValue ?? ''}
                              onChange={e => handleUpdateParam(idx, paramDef.key, e.target.value)}
                              placeholder={paramDef.placeholder}
                              className={cn(
                                'text-[11px] font-mono border border-slate-200 rounded px-1.5 py-0.5 bg-card text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-aqua-500/30',
                                paramDef.width || 'w-24',
                              )}
                            />
                          )}
                        </div>
                      ))}
                      {hasJava && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-50 text-amber-700 rounded font-mono max-w-[280px] truncate border border-amber-200">
                          <Coffee className="w-3 h-3 flex-shrink-0" />
                          {genDef!.javaExpression}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Column Row */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50/50 items-center">
            <div className="col-span-3">
              <input
                type="text"
                value={newColumnName}
                onChange={e => setNewColumnName(e.target.value)}
                placeholder="column_name"
                className="w-full text-sm font-mono border border-slate-200 rounded px-2 py-1.5 bg-card text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
                onKeyDown={e => { if (e.key === 'Enter') handleAddColumn(); }}
              />
            </div>
            <div className="col-span-2">
              <input
                type="text"
                value={newColumnType}
                onChange={e => setNewColumnType(e.target.value)}
                placeholder="VARCHAR(255)"
                className="w-full text-xs font-mono border border-slate-200 rounded px-2 py-1.5 bg-card text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-aqua-500/30"
              />
            </div>
            <div className="col-span-5" />
            <div className="col-span-2 text-right">
              <button
                onClick={handleAddColumn}
                disabled={!newColumnName.trim()}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded transition-colors',
                  newColumnName.trim()
                    ? 'text-aqua-700 bg-aqua-50 hover:bg-aqua-100'
                    : 'text-slate-400 cursor-not-allowed'
                )}
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Button & Progress */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !tableName.trim()}
          className={cn(
            'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all shadow-sm',
            isGenerating || !tableName.trim()
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-aqua-600 text-white hover:bg-aqua-700'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Generate Data
            </>
          )}
        </button>

        <button
          onClick={() => setShowPreview(!showPreview)}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <Hash className="w-3.5 h-3.5" />
          {showPreview ? 'Hide' : 'Show'} Preview
        </button>

        <button
          onClick={handleLoadDemo}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-card border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Load Demo
        </button>

        {isGenerating && (
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">Generating rows...</span>
              <span className="text-xs font-medium text-aqua-600">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-aqua-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {showPreview && columns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-700">Sample Preview (5 rows)</h4>
            <button
              onClick={() => setShowPreview(false)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="bg-card border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {columns.map((c, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }, (_, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                    {columns.map((c, colIdx) => (
                      <td key={colIdx} className="px-3 py-2 text-slate-700 font-mono whitespace-nowrap">
                        {generateSampleValue(c.generator, c.params, rowIdx)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default SyntheticDataGenerator;
