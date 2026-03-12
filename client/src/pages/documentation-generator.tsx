import { useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Sparkles,
  Loader2,
  Download,
  Printer,
  CheckCircle2,
  ArrowRight,
  Search,
  BookOpen,
  Database,
  ChevronDown,
  ChevronRight,
  Shield,
  Wrench,
  Globe,
  Table2,
  Link2,
  AlertTriangle,
  FlaskConical,
  Copy,
  FileCode,
  FileType,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/hooks/use-projects';
import { useTables } from '@/hooks/use-schema';
import {
  useGenerateDocumentation,
  generateMarkdown,
  generateHTML,
  type DocumentationResult,
} from '@/hooks/use-documentation';

// ── Constants ─────────────────────────────────────────────────────────────────

const GENERATION_STEPS = [
  { label: 'Analyzing schema', icon: Search },
  { label: 'Generating descriptions', icon: BookOpen },
  { label: 'Mapping relationships', icon: Link2 },
  { label: 'Building documentation', icon: Sparkles },
];

const SENSITIVITY_STYLES: Record<string, string> = {
  pii: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  financial: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  confidential: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
};

const CATEGORY_STYLES: Record<string, string> = {
  Core: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  Reference: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  Junction: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
  Audit: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  Configuration: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentationGenerator() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const { data: tables } = useTables(projectId);
  const generateMutation = useGenerateDocumentation();

  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<DocumentationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'tables', 'relationships']),
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!projectId || !project) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    setAnalysisStep(0);
    stepIntervalRef.current = setInterval(() => {
      setAnalysisStep((prev) => Math.min(prev + 1, GENERATION_STEPS.length - 1));
    }, 2000);

    try {
      const data = await generateMutation.mutateAsync({
        projectId,
        dialect: project.dialect ?? 'PostgreSQL',
        projectName: project.name || 'Database Schema',
        additionalContext: additionalContext.trim() || undefined,
      });
      setResult(data);
      // Expand all tables by default
      if (data.tables) {
        setExpandedTables(new Set(data.tables.map((t) => t.name)));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate documentation. Check AI provider configuration.',
      );
    } finally {
      setIsGenerating(false);
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setAnalysisStep(GENERATION_STEPS.length - 1);
    }
  }, [projectId, project, additionalContext, generateMutation]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!result) return;
    downloadFile(generateMarkdown(result), `db_documentation_${Date.now()}.md`, 'text/markdown');
  };

  const handleExportHTML = () => {
    if (!result) return;
    downloadFile(generateHTML(result), `db_documentation_${Date.now()}.html`, 'text/html');
  };

  const handleExportJSON = () => {
    if (!result) return;
    downloadFile(JSON.stringify(result, null, 2), `db_documentation_${Date.now()}.json`, 'application/json');
  };

  const handlePrintPDF = () => {
    if (!result) return;
    const html = generateHTML(result);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const handleLoadDemo = () => {
    setResult({
      projectOverview: {
        title: 'E-Commerce Database Documentation',
        description:
          'A comprehensive e-commerce platform database supporting customer management, product catalog, order processing, and payment handling. Designed for scalability with proper normalization and referential integrity.',
        dialect: project?.dialect ?? 'PostgreSQL',
        totalTables: 5,
        totalRelationships: 4,
        designPatterns: [
          'Normalized to 3NF with selective denormalization for performance',
          'Soft deletes using is_active/status flags',
          'Audit timestamps (created_at, updated_at) on all tables',
          'UUID primary keys for distributed compatibility',
        ],
        namingConventions: 'snake_case for tables and columns, fk_ prefix for foreign keys, idx_ prefix for indexes',
      },
      tables: [
        {
          name: 'customers',
          schema: 'public',
          description: 'Stores customer account information including personal details, contact information, and account status. Central entity for the e-commerce platform.',
          category: 'Core',
          estimatedVolume: 'Medium (100K-1M rows)',
          columns: [
            { name: 'id', dataType: 'UUID', nullable: false, isPrimaryKey: true, isForeignKey: false, description: 'Unique identifier for each customer account', sensitivity: 'none', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
            { name: 'first_name', dataType: 'VARCHAR(100)', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Customer\'s first/given name', sensitivity: 'pii', example: 'John' },
            { name: 'last_name', dataType: 'VARCHAR(100)', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Customer\'s last/family name', sensitivity: 'pii', example: 'Smith' },
            { name: 'email', dataType: 'VARCHAR(255)', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Customer\'s email address — used for login and communication', sensitivity: 'pii', example: 'john.smith@example.com' },
            { name: 'created_at', dataType: 'TIMESTAMPTZ', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Timestamp when the customer account was created', sensitivity: 'none', example: '2024-01-15T10:30:00Z' },
          ],
          indexes: [
            { name: 'idx_customers_email', columns: ['email'], type: 'BTREE', isUnique: true, purpose: 'Ensures unique email addresses and speeds up login queries' },
          ],
          constraints: [
            { name: 'chk_customers_email', type: 'CHECK', columns: ['email'], description: 'Validates email format using LIKE pattern' },
          ],
          usageNotes: 'Always query by email for login lookups. Consider GDPR data retention policies for EU customers.',
        },
        {
          name: 'orders',
          schema: 'public',
          description: 'Tracks all purchase orders placed by customers. Each order references a customer and contains the total amount, order status, and timestamps.',
          category: 'Core',
          estimatedVolume: 'High (1M-10M rows)',
          columns: [
            { name: 'id', dataType: 'UUID', nullable: false, isPrimaryKey: true, isForeignKey: false, description: 'Unique order identifier', sensitivity: 'none', example: 'ord-2024-0001' },
            { name: 'customer_id', dataType: 'UUID', nullable: false, isPrimaryKey: false, isForeignKey: true, description: 'Reference to the customer who placed this order', sensitivity: 'none', example: 'a1b2c3d4-...' },
            { name: 'total_amount', dataType: 'DECIMAL(10,2)', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Total order value including tax and shipping', sensitivity: 'financial', example: '129.99' },
            { name: 'status', dataType: 'VARCHAR(20)', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'Current order status in the fulfillment pipeline', sensitivity: 'none', example: 'completed' },
            { name: 'created_at', dataType: 'TIMESTAMPTZ', nullable: false, isPrimaryKey: false, isForeignKey: false, description: 'When the order was placed', sensitivity: 'none', example: '2024-03-15T08:20:00Z' },
          ],
          indexes: [
            { name: 'idx_orders_customer', columns: ['customer_id'], type: 'BTREE', isUnique: false, purpose: 'Fast lookup of all orders for a given customer' },
            { name: 'idx_orders_status_date', columns: ['status', 'created_at'], type: 'BTREE', isUnique: false, purpose: 'Supports filtering orders by status and date range for reports' },
          ],
          constraints: [],
          usageNotes: 'Consider partitioning by created_at after exceeding 10M rows. Status transitions should be validated in application logic.',
        },
      ],
      relationships: [
        {
          name: 'fk_orders_customer',
          sourceTable: 'orders',
          sourceColumn: 'customer_id',
          targetTable: 'customers',
          targetColumn: 'id',
          type: 'many-to-one',
          description: 'Each order belongs to exactly one customer. A customer can have zero or many orders.',
          cascadeRule: 'ON DELETE RESTRICT — prevents deleting customers with existing orders',
          businessRule: 'All orders must reference a valid, active customer',
        },
      ],
      dataFlowDiagram: 'Customer registers → browses products → adds items to cart → places order → payment is processed → order status updated → shipping initiated → order completed.',
      securityNotes: [
        'PII data (first_name, last_name, email) in customers table requires encryption at rest and access logging',
        'Financial data (total_amount) in orders table requires audit trail compliance',
        'Consider column-level encryption for email addresses',
      ],
      maintenanceNotes: [
        'Run VACUUM ANALYZE weekly on orders table due to high update frequency',
        'Consider partitioning orders by created_at (monthly) after 10M rows',
        'Monitor index bloat on idx_orders_status_date — rebuild quarterly',
        'Set up automated backups with point-in-time recovery',
      ],
      glossary: [
        { term: 'PII', definition: 'Personally Identifiable Information — data that can identify an individual' },
        { term: 'GDPR', definition: 'General Data Protection Regulation — EU data privacy framework' },
        { term: 'Soft Delete', definition: 'Marking records as inactive instead of physically removing them' },
        { term: 'OLTP', definition: 'Online Transaction Processing — workload pattern for this schema' },
      ],
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              DB Documentation Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              AI-powered schema documentation with export to Markdown, HTML, PDF & JSON
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Generate Documentation
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {tables?.length ?? 0} tables found in{' '}
              <span className="font-medium text-foreground">
                {project?.name || 'project'}
              </span>{' '}
              ({project?.dialect || 'PostgreSQL'})
            </p>
          </div>
          <button
            onClick={handleLoadDemo}
            className="text-xs text-aqua-600 hover:text-aqua-700 dark:text-aqua-400 font-medium"
          >
            <FlaskConical className="w-3.5 h-3.5 inline mr-1" />
            Load Demo
          </button>
        </div>

        {/* Additional Context */}
        <div>
          <label className="text-sm font-medium text-foreground block mb-2">
            Additional Context{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Provide business context, domain terminology, or specific areas to focus on..."
            rows={3}
            className="w-full rounded-lg border border-border bg-card text-foreground px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !tables || tables.length === 0}
          className={cn(
            'w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            isGenerating || !tables || tables.length === 0
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20',
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating Documentation...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Documentation for {tables?.length ?? 0} Tables
            </>
          )}
        </button>
      </div>

      {/* Progress Stepper */}
      {isGenerating && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-4">
            {GENERATION_STEPS.map((step, idx) => {
              const isActive = idx === analysisStep;
              const isDone = idx < analysisStep;
              return (
                <div key={idx} className="flex items-center gap-2 flex-1">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                      isDone
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        : isActive
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 animate-pulse'
                          : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <step.icon className="w-4 h-4" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs hidden sm:inline',
                      isActive ? 'text-foreground font-medium' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  {idx < GENERATION_STEPS.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground/30 ml-auto" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Export Bar */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm font-medium text-foreground">
              Export Documentation
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-medium transition-colors"
              >
                <FileCode className="w-3.5 h-3.5" />
                Markdown
              </button>
              <button
                onClick={handleExportHTML}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-medium transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                HTML
              </button>
              <button
                onClick={handlePrintPDF}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-medium transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                PDF
              </button>
              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 px-3 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-medium transition-colors"
              >
                <FileType className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          </div>

          {/* Project Overview Section */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('overview')}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('overview') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <BookOpen className="w-4 h-4 text-emerald-500" />
                <h3 className="font-semibold text-foreground">Project Overview</h3>
              </div>
            </button>
            {expandedSections.has('overview') && (
              <div className="border-t border-border p-6 space-y-4">
                <p className="text-sm text-foreground">
                  {result.projectOverview.description}
                </p>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Dialect</p>
                    <p className="text-lg font-bold text-foreground">
                      {result.projectOverview.dialect}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Tables</p>
                    <p className="text-lg font-bold text-foreground">
                      {result.projectOverview.totalTables}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Relationships</p>
                    <p className="text-lg font-bold text-foreground">
                      {result.projectOverview.totalRelationships}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Convention</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {result.projectOverview.namingConventions}
                    </p>
                  </div>
                </div>

                {result.projectOverview.designPatterns.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                      Design Patterns
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.projectOverview.designPatterns.map((p, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs text-emerald-700 dark:text-emerald-400"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tables Section */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection('tables')}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has('tables') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Table2 className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-foreground">
                  Table Reference
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {result.tables.length} tables
              </span>
            </button>
            {expandedSections.has('tables') && (
              <div className="border-t border-border">
                {result.tables.map((table) => {
                  const isExpanded = expandedTables.has(table.name);
                  const catStyle =
                    CATEGORY_STYLES[table.category.split(' ')[0]] ||
                    'bg-secondary text-foreground';

                  return (
                    <div
                      key={table.name}
                      className="border-b border-border last:border-b-0"
                    >
                      <button
                        onClick={() => toggleTable(table.name)}
                        className="w-full flex items-center justify-between px-6 py-3 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <Database className="w-4 h-4 text-aqua-500" />
                          <span className="font-medium text-foreground">
                            {table.name}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] px-2 py-0.5 rounded-full font-medium',
                              catStyle,
                            )}
                          >
                            {table.category}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {table.columns.length} columns
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-6 pb-4 space-y-4">
                          {/* Description */}
                          <div className="bg-aqua-50/50 dark:bg-aqua-900/10 border-l-4 border-aqua-500 px-4 py-3 rounded-r-lg">
                            <p className="text-sm text-foreground">
                              {table.description}
                            </p>
                          </div>

                          {table.estimatedVolume && (
                            <p className="text-xs text-muted-foreground">
                              <strong>Estimated Volume:</strong>{' '}
                              {table.estimatedVolume}
                            </p>
                          )}

                          {/* Columns Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border bg-secondary/30">
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                                    Column
                                  </th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                                    Type
                                  </th>
                                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                                    Null
                                  </th>
                                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                                    PK
                                  </th>
                                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">
                                    FK
                                  </th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                                    Sensitivity
                                  </th>
                                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                                    Description
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {table.columns.map((col) => (
                                  <tr
                                    key={col.name}
                                    className="border-b border-border/50 hover:bg-secondary/20"
                                  >
                                    <td className="px-3 py-2 font-mono font-medium text-foreground">
                                      {col.name}
                                    </td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {col.dataType}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {col.nullable ? 'Yes' : 'No'}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {col.isPrimaryKey && (
                                        <span className="text-amber-500">✓</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {col.isForeignKey && (
                                        <span className="text-blue-500">✓</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">
                                      {col.sensitivity !== 'none' ? (
                                        <span
                                          className={cn(
                                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                                            SENSITIVITY_STYLES[col.sensitivity] || '',
                                          )}
                                        >
                                          {col.sensitivity.toUpperCase()}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-foreground max-w-xs">
                                      {col.description}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Indexes */}
                          {table.indexes.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                                Indexes
                              </p>
                              <div className="space-y-1.5">
                                {table.indexes.map((idx) => (
                                  <div
                                    key={idx.name}
                                    className="flex items-start gap-2 text-xs bg-secondary/50 rounded-lg px-3 py-2"
                                  >
                                    <span className="font-mono font-medium text-foreground whitespace-nowrap">
                                      {idx.name}
                                    </span>
                                    <span className="text-muted-foreground">
                                      ({idx.columns.join(', ')})
                                    </span>
                                    {idx.isUnique && (
                                      <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-[10px] font-medium">
                                        UNIQUE
                                      </span>
                                    )}
                                    <span className="text-muted-foreground flex-1">
                                      — {idx.purpose}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Usage Notes */}
                          {table.usageNotes && (
                            <div className="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
                              <p className="text-xs text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                {table.usageNotes}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Relationships Section */}
          {result.relationships.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('relationships')}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.has('relationships') ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Link2 className="w-4 h-4 text-violet-500" />
                  <h3 className="font-semibold text-foreground">
                    Relationships
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {result.relationships.length} relationships
                </span>
              </button>
              {expandedSections.has('relationships') && (
                <div className="border-t border-border p-4 space-y-3">
                  {result.relationships.map((rel, idx) => (
                    <div
                      key={idx}
                      className="bg-secondary/30 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {rel.sourceTable}.{rel.sourceColumn}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm font-medium text-foreground">
                          {rel.targetTable}.{rel.targetColumn}
                        </span>
                        <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded text-[10px] font-medium">
                          {rel.type}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {rel.description}
                      </p>
                      {rel.cascadeRule && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Cascade:</strong> {rel.cascadeRule}
                        </p>
                      )}
                      {rel.businessRule && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Business Rule:</strong> {rel.businessRule}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Data Flow */}
          {result.dataFlowDiagram && (
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-aqua-500" />
                <h3 className="font-semibold text-foreground">Data Flow</h3>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                {result.dataFlowDiagram}
              </p>
            </div>
          )}

          {/* Security & Maintenance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {result.securityNotes.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-foreground">
                    Security Considerations
                  </h3>
                </div>
                <ul className="space-y-2">
                  {result.securityNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.maintenanceNotes.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-foreground">
                    Maintenance Guidelines
                  </h3>
                </div>
                <ul className="space-y-2">
                  {result.maintenanceNotes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Wrench className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground">{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Glossary */}
          {result.glossary.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggleSection('glossary')}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.has('glossary') ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-foreground">Glossary</h3>
                </div>
              </button>
              {expandedSections.has('glossary') && (
                <div className="border-t border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/30">
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-1/4">
                            Term
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                            Definition
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.glossary.map((item, i) => (
                          <tr
                            key={i}
                            className="border-b border-border/50 hover:bg-secondary/20"
                          >
                            <td className="px-4 py-2 font-medium text-foreground">
                              {item.term}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {item.definition}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentationGenerator;
