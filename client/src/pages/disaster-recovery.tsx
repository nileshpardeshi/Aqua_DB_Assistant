import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldAlert,
  Activity,
  Server,
  Database,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Shield,
  Zap,
  Target,
  ArrowRight,
  RefreshCw,
  Eye,
  BarChart3,
  GitBranch,
  Settings,
  Gauge,
  ListChecks,
  Archive,
  Radio,
  Globe,
  Lock,
  Play,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useDRAssessments,
  useCreateDRAssessment,
  useDeleteDRAssessment,
  useAnalyzeDR,
  type DRAssessment,
  type DRStrategy,
  type DRInfrastructure,
  type DRBackupConfig,
  type DRReplicationConfig,
  type DRCompliance,
} from '@/hooks/use-disaster-recovery';

// ── Constants ────────────────────────────────────────────────────────

const CLOUD_PROVIDERS = ['AWS', 'Azure', 'GCP', 'On-Premise', 'Hybrid', 'Oracle Cloud', 'IBM Cloud'];
const DB_ENGINES = ['PostgreSQL', 'MySQL', 'Oracle', 'SQL Server', 'MariaDB', 'MongoDB', 'Snowflake', 'BigQuery'];
const REPLICATION_TYPES = ['none', 'streaming-async', 'streaming-sync', 'logical', 'multi-master', 'snapshot'];
const TOPOLOGIES = ['single-primary', 'primary-replica', 'multi-primary', 'cascading', 'ring'];
const INDUSTRIES = ['Banking', 'Fintech', 'Healthcare', 'SaaS', 'E-commerce', 'Government', 'Insurance', 'Telecom', 'Manufacturing', 'Other'];
const REGULATIONS = ['PCI-DSS', 'SOX', 'GDPR', 'HIPAA', 'RBI', 'ISO 27001', 'SOC 2', 'DORA', 'CCPA'];
const DATA_CLASSIFICATIONS = ['Public', 'Internal', 'Confidential', 'Restricted', 'Top Secret'];
const CLUSTER_TYPES = ['standalone', 'primary-standby', 'active-active', 'rac', 'galera', 'patroni', 'rds-multi-az', 'aurora-global'];
const BACKUP_STRATEGIES = ['full-only', 'full+incremental', 'full+differential', 'continuous-wal', 'snapshot', 'none'];
const DR_TEST_FREQUENCIES = ['never', 'annually', 'bi-annually', 'quarterly', 'monthly'];

type ViewMode = 'list' | 'form' | 'results';
type ResultTab = 'summary' | 'risk' | 'failover' | 'backup' | 'compliance' | 'architecture' | 'recommendations' | 'test-plan';

const RESULT_TABS: { id: ResultTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'summary', label: 'Executive Summary', icon: FileText },
  { id: 'risk', label: 'Risk Assessment', icon: AlertTriangle },
  { id: 'failover', label: 'Failover Plan', icon: GitBranch },
  { id: 'backup', label: 'Backup Policy', icon: Archive },
  { id: 'compliance', label: 'Compliance', icon: Shield },
  { id: 'architecture', label: 'DR Architecture', icon: Server },
  { id: 'recommendations', label: 'Recommendations', icon: ListChecks },
  { id: 'test-plan', label: 'DR Test Plan', icon: Play },
];

// ── Risk helpers ─────────────────────────────────────────────────────

function getRiskColor(level: string) {
  const l = level?.toUpperCase();
  if (l === 'CRITICAL') return { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', bar: 'bg-red-500' };
  if (l === 'HIGH') return { text: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', bar: 'bg-orange-500' };
  if (l === 'MEDIUM') return { text: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', bar: 'bg-yellow-500' };
  return { text: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', bar: 'bg-green-500' };
}

function getStatusColor(status: string) {
  if (status === 'compliant') return 'text-green-600 bg-green-50 dark:bg-green-900/30';
  if (status === 'partial') return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30';
  return 'text-red-600 bg-red-50 dark:bg-red-900/30';
}

function getPriorityColor(priority: string) {
  const p = priority?.toUpperCase();
  if (p === 'CRITICAL') return 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
  if (p === 'HIGH') return 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
  if (p === 'MEDIUM') return 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
}

// ── Sample Data ─────────────────────────────────────────────────────

const SAMPLE_FORM = {
  name: 'HDFC Core Banking - Production DR Assessment',
  infrastructure: {
    provider: 'AWS',
    regions: 'ap-south-1, ap-southeast-1',
    dbEngine: 'PostgreSQL',
    dbVersion: '15.4',
    dbSizeGB: 2400,
    tableCount: 347,
    avgTPS: 8500,
    peakTPS: 42000,
    haEnabled: true,
    clusterType: 'patroni',
  },
  backup: {
    strategy: 'full+incremental',
    fullFreq: 'daily at 02:00 UTC',
    incrFreq: 'every 30 minutes',
    retention: 30,
    location: 'same-region S3',
    encrypted: true,
    lastTest: '2025-09-15',
  },
  replication: {
    type: 'streaming-async',
    topology: 'primary-replica',
    count: 2,
    regions: 'ap-southeast-1',
    lagTolerance: 10,
    autoFailover: false,
  },
  compliance: {
    industry: 'Banking',
    regulations: ['PCI-DSS', 'RBI', 'SOX', 'ISO 27001'],
    targetRTO: 15,
    targetRPO: 2,
    dataClass: 'Restricted',
    drTestFreq: 'quarterly',
  },
};

const SAMPLE_STRATEGY: DRStrategy = {
  executiveSummary: {
    overallRiskLevel: 'HIGH',
    riskScore: 62,
    headline: 'Critical gaps in cross-region backup and automated failover put the 2.4TB banking database at significant risk of exceeding RTO/RPO targets during a regional outage.',
    keyFindings: [
      'Patroni cluster provides local HA but no cross-region automated failover — manual intervention adds 15-25 minutes to recovery',
      'Backup retention of 30 days meets RBI requirements but incremental frequency (30 min) exceeds the 2-minute RPO target by 15x',
      'Async replication lag tolerance of 10 seconds is acceptable for read replicas but creates data loss risk for failover scenarios',
      'No cross-region backup copy detected — a regional S3 outage could make both primary data and backups unavailable simultaneously',
      'Last DR test was 6+ months ago (Sep 2025) — RBI mandates quarterly testing',
    ],
    criticalGaps: [
      'RPO gap: 30-min incremental backup cannot achieve 2-minute RPO — requires continuous WAL archiving',
      'No automated cross-region failover — manual failover estimated at 20-30 min vs 15-min RTO target',
      'Single-region backup storage creates correlated failure risk with primary database',
    ],
  },
  riskAssessment: {
    categories: [
      { name: 'Data Loss Risk', score: 72, level: 'HIGH', details: '30-minute incremental backups with async replication (10s lag) create a potential data loss window of up to 30 minutes during a catastrophic failure — far exceeding the 2-minute RPO target.' },
      { name: 'Recovery Time Risk', score: 68, level: 'HIGH', details: 'Manual failover procedure with 2.4TB database restoration from S3 backup would take 45-90 minutes. Even with streaming replica promotion, manual steps add 15-25 minutes, exceeding 15-minute RTO.' },
      { name: 'Infrastructure Risk', score: 45, level: 'MEDIUM', details: 'Patroni provides automatic local failover within the primary region. However, there is no cross-region infrastructure redundancy beyond the async replica.' },
      { name: 'Backup Reliability', score: 58, level: 'MEDIUM', details: 'Encrypted daily full + 30-min incremental is solid for standard recovery but insufficient for banking RPO targets. Same-region S3 storage is a single point of failure.' },
      { name: 'Replication Health', score: 52, level: 'MEDIUM', details: 'Two async replicas provide read scaling and basic redundancy. However, async replication cannot guarantee zero data loss, and no sync replica exists for the failover target.' },
      { name: 'Compliance Risk', score: 71, level: 'HIGH', details: 'PCI-DSS requirement 12.10.1 mandates tested incident response plans — last test was 6+ months ago. RBI mandates documented, tested BCP with demonstrated RTO/RPO achievement.' },
    ],
    vulnerabilities: [
      { severity: 'CRITICAL', category: 'backup', description: 'No cross-region backup replication — both primary data and all backups reside in ap-south-1', mitigation: 'Enable S3 Cross-Region Replication (CRR) to ap-southeast-1 bucket with encryption. Estimated cost: $45/month for 2.4TB.' },
      { severity: 'CRITICAL', category: 'replication', description: 'No synchronous replication for zero-RPO failover target', mitigation: 'Add one synchronous standby in the same AZ or nearby AZ using Patroni synchronous_mode. This ensures zero data loss for planned failovers.' },
      { severity: 'HIGH', category: 'infrastructure', description: 'Manual failover process with no automated cross-region DNS switching', mitigation: 'Implement AWS Route 53 health checks with automated failover DNS records. Use Patroni REST API for automated promotion with a Lambda-based orchestrator.' },
      { severity: 'HIGH', category: 'backup', description: 'Incremental backup interval (30 min) is 15x larger than RPO target (2 min)', mitigation: 'Enable continuous WAL archiving to S3 using pgBackRest or wal-g. This achieves sub-minute RPO with point-in-time recovery capability.' },
      { severity: 'MEDIUM', category: 'compliance', description: 'DR test frequency has lapsed — last test was September 2025', mitigation: 'Schedule immediate tabletop exercise followed by a full failover drill within 30 days. Set up quarterly automated DR test calendar.' },
      { severity: 'MEDIUM', category: 'monitoring', description: 'No documented alerting for replication lag breaching RPO threshold', mitigation: 'Configure CloudWatch alarms for replication lag > 2 seconds. Integrate with PagerDuty/OpsGenie for immediate DBA notification.' },
    ],
  },
  failoverPlan: {
    strategy: 'warm-standby',
    strategyJustification: 'Warm standby is recommended given the 2.4TB database size, 42K peak TPS, and banking-grade RTO (15 min) / RPO (2 min) requirements. Active-active would reduce RTO to near-zero but adds significant complexity and cost. Warm standby with synchronous replication and automated promotion achieves the targets cost-effectively.',
    steps: [
      { order: 1, phase: 'Detection', action: 'Health check failure detected by Route 53 and Patroni watchdog', estimatedTime: '30 seconds', responsible: 'Automated', automated: true, details: 'Route 53 health check polls primary endpoint every 10 seconds. Patroni watchdog monitors PostgreSQL process and replication status every 5 seconds.' },
      { order: 2, phase: 'Detection', action: 'Alert triggered to on-call DBA via PagerDuty with runbook link', estimatedTime: '15 seconds', responsible: 'Automated', automated: true, details: 'CloudWatch alarm triggers SNS → Lambda → PagerDuty. Includes current replication lag, last WAL position, and estimated data loss.' },
      { order: 3, phase: 'Decision', action: 'On-call DBA confirms failover decision via Slack command or auto-approved after 3 min timeout', estimatedTime: '1-3 minutes', responsible: 'DBA', automated: false, details: 'For auto-approved scenario, system validates that replica is within RPO threshold before proceeding. Manual override available via /dr-abort command.' },
      { order: 4, phase: 'Execution', action: 'Patroni promotes synchronous replica in ap-southeast-1 to primary', estimatedTime: '15-30 seconds', responsible: 'Automated', automated: true, details: 'Patroni REST API call triggers pg_promote(). Synchronous replica has zero data loss. Timeline changes and WAL continuity verified automatically.' },
      { order: 5, phase: 'Execution', action: 'Route 53 DNS failover activates — traffic redirected to new primary', estimatedTime: '30-60 seconds', responsible: 'Automated', automated: true, details: 'Route 53 failover record set with 60s TTL. Application connection pools will reconnect within 1-2 connection retry cycles.' },
      { order: 6, phase: 'Execution', action: 'Application connection pools reset and reconnect to new primary endpoint', estimatedTime: '30 seconds', responsible: 'Automated', automated: true, details: 'PgBouncer/connection pooler detects primary change via DNS. Existing connections are drained gracefully with 30-second timeout.' },
      { order: 7, phase: 'Validation', action: 'Automated smoke tests verify read/write operations on new primary', estimatedTime: '2 minutes', responsible: 'Automated', automated: true, details: 'Lambda-based test suite executes: 1) Write test transaction, 2) Read-back verification, 3) Check replication to remaining replicas, 4) Verify backup scheduling resumed.' },
      { order: 8, phase: 'Validation', action: 'DBA verifies replication lag, active connections, and transaction throughput in Grafana', estimatedTime: '5 minutes', responsible: 'DBA', automated: false, details: 'Dashboard verification: TPS within 10% of pre-failover baseline, no connection errors, WAL archiving active, backup schedule confirmed.' },
      { order: 9, phase: 'Validation', action: 'Incident post-mortem initiated and stakeholders notified', estimatedTime: '10 minutes', responsible: 'Management', automated: false, details: 'Automated Slack notification sent to #incident-response channel. JIRA ticket created with timeline, data loss assessment, and RCA template.' },
    ],
    estimatedRTO: '8-12 minutes',
    estimatedRPO: '0-2 seconds',
    meetsTargetRTO: true,
    meetsTargetRPO: true,
    automationLevel: 'semi-automatic',
    rollbackPlan: 'If the promoted replica exhibits issues (data corruption, performance degradation): 1) Redirect traffic back to original primary via Route 53 manual override, 2) Rebuild replication from original primary to promoted node, 3) If original primary is unrecoverable, perform PITR from WAL archive to a fresh instance in the primary region.',
  },
  backupPolicy: {
    recommended: {
      fullFrequency: 'Daily at 02:00 UTC (off-peak)',
      incrementalFrequency: 'Continuous WAL archiving (sub-minute)',
      retentionDays: 90,
      backupLocations: ['ap-south-1 (primary S3)', 'ap-southeast-1 (CRR replica)'],
      encryption: 'AES-256 with AWS KMS customer-managed key',
      testingFrequency: 'Monthly automated restore test',
      walArchiving: true,
    },
    gaps: [
      { aspect: 'Incremental Frequency', current: 'Every 30 minutes', recommended: 'Continuous WAL archiving', priority: 'CRITICAL', impact: 'Current 30-min gap exceeds 2-min RPO by 15x. Continuous WAL archiving reduces RPO to seconds.' },
      { aspect: 'Backup Location', current: 'Same-region S3 only', recommended: 'Cross-region S3 with CRR', priority: 'CRITICAL', impact: 'Regional S3 outage would make both database and backups unavailable. CRR provides geographic redundancy.' },
      { aspect: 'Retention Period', current: '30 days', recommended: '90 days (regulatory)', priority: 'HIGH', impact: 'RBI and SOX require minimum 90-day retention for audit trail. Some investigations require 6-12 months of data history.' },
      { aspect: 'Backup Testing', current: 'Last tested Sep 2025', recommended: 'Monthly automated PITR test', priority: 'HIGH', impact: 'Untested backups have a 30-40% failure rate in production restores. Automated monthly tests catch corruption early.' },
      { aspect: 'Encryption Key Mgmt', current: 'AWS-managed encryption', recommended: 'Customer-managed KMS key with rotation', priority: 'MEDIUM', impact: 'PCI-DSS requires documented key management. Customer-managed keys provide audit trail and rotation control.' },
      { aspect: 'WAL Archiving', current: 'Not enabled', recommended: 'Continuous WAL → S3 via pgBackRest', priority: 'CRITICAL', impact: 'Without WAL archiving, point-in-time recovery is impossible. Only full + incremental snapshots available.' },
    ],
  },
  complianceReport: {
    overallStatus: 'PARTIAL',
    regulations: [
      {
        name: 'PCI-DSS',
        status: 'partial',
        score: 65,
        requirements: ['Requirement 12.10.1: Incident response plan tested annually', 'Requirement 3.4: Render PAN unreadable with encryption', 'Requirement 10.5.1: Audit trail retention minimum 12 months'],
        gaps: ['DR plan not tested in 6+ months (requires annual minimum)', 'No documented evidence of backup restoration testing', 'Audit trail retention at 30 days vs required 12 months'],
        remediation: ['Schedule immediate tabletop exercise and full failover drill', 'Implement automated monthly backup restore verification with documented results', 'Extend WAL archive and audit log retention to 12 months minimum'],
      },
      {
        name: 'RBI',
        status: 'partial',
        score: 55,
        requirements: ['Business Continuity Planning circular: documented BCP with tested RTO/RPO', 'IT Risk Management Framework: quarterly DR drills', 'Data localization: primary data must reside in India'],
        gaps: ['DR test overdue — last conducted September 2025', 'Documented evidence of RTO/RPO achievement not available', 'No automated failover — manual process increases RTO beyond target'],
        remediation: ['Conduct quarterly DR drill with documented RTO/RPO measurements', 'Implement automated failover to demonstrate sub-15-minute RTO', 'Maintain DR test reports for regulatory audit submissions'],
      },
      {
        name: 'SOX',
        status: 'partial',
        score: 60,
        requirements: ['Section 302/404: Internal controls over financial reporting data', 'Audit trail integrity and availability', 'Change management documentation for DR procedures'],
        gaps: ['30-day backup retention insufficient for annual audit cycles', 'No documented change management process for DR configuration changes'],
        remediation: ['Extend backup retention to minimum 90 days, WAL archive to 12 months', 'Implement change management workflow for all DR infrastructure changes with approval chain'],
      },
      {
        name: 'ISO 27001',
        status: 'partial',
        score: 70,
        requirements: ['A.17.1: Information security continuity planning', 'A.17.2: Redundancies for availability', 'A.12.3: Information backup with regular testing'],
        gaps: ['Backup testing evidence incomplete', 'No cross-region redundancy for backup storage'],
        remediation: ['Document backup testing procedures and maintain test result records', 'Implement cross-region backup replication with documented verification'],
      },
    ],
  },
  architecture: {
    recommended: {
      primary: { region: 'ap-south-1 (Mumbai)', role: 'Primary', engine: 'PostgreSQL 15.4 on Patroni' },
      replicas: [
        { region: 'ap-south-1 (Mumbai)', role: 'Sync Standby', replicationType: 'synchronous', purpose: 'Zero-data-loss failover target within the primary region for AZ-level failures' },
        { region: 'ap-southeast-1 (Singapore)', role: 'Async DR Replica', replicationType: 'asynchronous', purpose: 'Cross-region disaster recovery for regional outages. Promotes to primary during site failure.' },
        { region: 'ap-southeast-1 (Singapore)', role: 'Read Replica', replicationType: 'asynchronous', purpose: 'Offload reporting and analytics queries. Also serves as secondary DR candidate.' },
      ],
      backupTargets: [
        { type: 'Continuous WAL', location: 'S3 ap-south-1 + CRR to ap-southeast-1', frequency: 'Continuous (sub-minute)', retention: '90 days' },
        { type: 'Full Backup', location: 'S3 ap-south-1 (pgBackRest)', frequency: 'Daily at 02:00 UTC', retention: '90 days' },
        { type: 'Snapshot', location: 'EBS Snapshots cross-region', frequency: 'Weekly', retention: '12 months (compliance)' },
      ],
    },
    dataFlow: 'Primary (Mumbai) → Sync replication to local standby (zero RPO) → Async streaming to Singapore DR replica (2-5s lag) → Continuous WAL archiving to S3 with cross-region replication → Daily full backups via pgBackRest → Weekly EBS snapshots for long-term compliance retention.',
  },
  recommendations: [
    { priority: 'CRITICAL', category: 'backup', title: 'Enable Continuous WAL Archiving', description: 'Deploy pgBackRest or wal-g for continuous WAL archiving to S3. This is the single most impactful change — it reduces RPO from 30 minutes to seconds and enables point-in-time recovery.', impact: 'RPO improvement from 30 minutes to < 30 seconds. Enables PITR to any point within retention window.', effort: 'MEDIUM', timeline: '1-2 weeks' },
    { priority: 'CRITICAL', category: 'infrastructure', title: 'Enable S3 Cross-Region Replication', description: 'Configure S3 CRR from ap-south-1 to ap-southeast-1 for all backup buckets. Ensures backup availability even during a complete regional outage.', impact: 'Eliminates single-region backup storage as a failure point. Adds geographic redundancy for all backup data.', effort: 'LOW', timeline: '1-2 days' },
    { priority: 'CRITICAL', category: 'replication', title: 'Add Synchronous Standby for Zero-RPO Failover', description: 'Configure one Patroni replica in synchronous mode within ap-south-1. This guarantees zero data loss for planned and AZ-level failures.', impact: 'Achieves true zero RPO for intra-region failover. Adds ~2-5ms write latency (acceptable for 8.5K avg TPS).', effort: 'MEDIUM', timeline: '1 week' },
    { priority: 'HIGH', category: 'automation', title: 'Implement Automated Failover with Route 53', description: 'Deploy Route 53 health checks with automated failover DNS records. Integrate with Patroni REST API via Lambda for automated cross-region promotion when health check failures persist for > 3 minutes.', impact: 'Reduces RTO from 20-30 minutes (manual) to 8-12 minutes (semi-automatic) or 3-5 minutes (fully automatic).', effort: 'HIGH', timeline: '2-3 weeks' },
    { priority: 'HIGH', category: 'compliance', title: 'Extend Backup Retention to 90 Days', description: 'Update pgBackRest retention policy from 30 days to 90 days for full backups and WAL archives. Configure separate long-term retention (12 months) via S3 lifecycle policies for compliance snapshots.', impact: 'Meets RBI, SOX, and PCI-DSS retention requirements. Enables forensic investigation for up to 12 months.', effort: 'LOW', timeline: '1-2 days' },
    { priority: 'HIGH', category: 'testing', title: 'Schedule Quarterly DR Drills', description: 'Implement automated quarterly DR test framework: 1) Promote Singapore replica, 2) Run smoke tests, 3) Measure actual RTO/RPO, 4) Generate compliance report, 5) Demote back to replica.', impact: 'Ensures DR procedures work before they are needed. Generates compliance evidence for RBI and PCI-DSS audits.', effort: 'MEDIUM', timeline: '2-3 weeks' },
    { priority: 'MEDIUM', category: 'monitoring', title: 'Deploy Replication Lag Alerting', description: 'Configure CloudWatch custom metrics for PostgreSQL replication lag. Set alarms at: Warning > 2 seconds, Critical > 10 seconds, Emergency > 30 seconds. Integrate with PagerDuty.', impact: 'Early detection of replication issues before they become DR failures. Provides historical lag data for capacity planning.', effort: 'LOW', timeline: '2-3 days' },
    { priority: 'MEDIUM', category: 'backup', title: 'Implement Monthly Automated Restore Tests', description: 'Deploy a Lambda-based automated restore test that monthly: 1) Restores latest backup to a temporary RDS instance, 2) Runs data integrity checks, 3) Validates row counts against production, 4) Generates test report, 5) Terminates temp instance.', impact: 'Catches backup corruption before it matters. Industry data shows 30-40% of untested backups fail during actual recovery.', effort: 'MEDIUM', timeline: '1-2 weeks' },
  ],
  drTestPlan: {
    frequency: 'quarterly',
    testTypes: [
      { name: 'Tabletop Exercise', frequency: 'Quarterly', description: 'Walk through the failover procedure with all stakeholders (DBA, DevOps, Management, Compliance). Review roles, communication channels, and decision criteria. No actual infrastructure changes.', successCriteria: ['All team members know their roles and responsibilities', 'Communication channels tested and verified', 'Decision escalation path documented and agreed upon', 'Runbook reviewed and updated'] },
      { name: 'Failover Drill', frequency: 'Quarterly (alternating with tabletop)', description: 'Perform actual failover to Singapore DR replica during a planned maintenance window. Measure real RTO and RPO. Run production-equivalent traffic through the promoted replica for 30 minutes.', successCriteria: ['Actual RTO ≤ 15 minutes', 'Actual RPO ≤ 2 minutes (data loss measured)', 'Application TPS within 15% of normal baseline', 'All critical transactions completed successfully', 'Clean failback to primary completed'] },
      { name: 'Backup Restore Test', frequency: 'Monthly (automated)', description: 'Automated test that restores the latest full backup + WAL replay to a temporary PostgreSQL instance. Validates data integrity through checksums and row count comparisons against production.', successCriteria: ['Restore completes within 2 hours (for 2.4TB)', 'All tables present with matching row counts (±0.1%)', 'Data checksum verification passes', 'Point-in-time recovery to specific timestamp succeeds'] },
      { name: 'Full DR Test', frequency: 'Annually', description: 'Complete disaster recovery simulation: primary region declared unavailable, full failover to Singapore, run production traffic for 4 hours, verify all systems operational, then controlled failback.', successCriteria: ['Complete recovery within 15-minute RTO', 'Data loss within 2-minute RPO threshold', 'All dependent services reconnected and functional', 'Customer-facing SLAs maintained throughout test', 'Compliance report generated and filed'] },
    ],
  },
};

// ── Main Component ──────────────────────────────────────────────────

export function DisasterRecovery() {
  const { projectId } = useParams();
  const { data: assessments = [], isLoading } = useDRAssessments(projectId);
  const createAssessment = useCreateDRAssessment();
  const deleteAssessment = useDeleteDRAssessment();
  const analyzeDR = useAnalyzeDR();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [activeResultTab, setActiveResultTab] = useState<ResultTab>('summary');
  const [selectedAssessment, setSelectedAssessment] = useState<DRAssessment | null>(null);
  const [strategy, setStrategy] = useState<DRStrategy | null>(null);

  // Form state
  const [formName, setFormName] = useState('');

  // Infrastructure
  const [infraProvider, setInfraProvider] = useState('AWS');
  const [infraRegions, setInfraRegions] = useState('');
  const [infraDbEngine, setInfraDbEngine] = useState('PostgreSQL');
  const [infraDbVersion, setInfraDbVersion] = useState('');
  const [infraDbSizeGB, setInfraDbSizeGB] = useState(100);
  const [infraTableCount, setInfraTableCount] = useState(50);
  const [infraAvgTPS, setInfraAvgTPS] = useState(500);
  const [infraPeakTPS, setInfraPeakTPS] = useState(2000);
  const [infraHaEnabled, setInfraHaEnabled] = useState(false);
  const [infraClusterType, setInfraClusterType] = useState('standalone');

  // Backup
  const [backupStrategy, setBackupStrategy] = useState('full+incremental');
  const [backupFullFreq, setBackupFullFreq] = useState('daily');
  const [backupIncrFreq, setBackupIncrFreq] = useState('every 6 hours');
  const [backupRetention, setBackupRetention] = useState(30);
  const [backupLocation, setBackupLocation] = useState('same-region');
  const [backupEncrypted, setBackupEncrypted] = useState(false);
  const [backupLastTest, setBackupLastTest] = useState('never');

  // Replication
  const [replType, setReplType] = useState('none');
  const [replTopology, setReplTopology] = useState('single-primary');
  const [replCount, setReplCount] = useState(0);
  const [replRegions, setReplRegions] = useState('');
  const [replLagTolerance, setReplLagTolerance] = useState(30);
  const [replAutoFailover, setReplAutoFailover] = useState(false);

  // Compliance
  const [compIndustry, setCompIndustry] = useState('Banking');
  const [compRegulations, setCompRegulations] = useState<string[]>([]);
  const [compTargetRTO, setCompTargetRTO] = useState(30);
  const [compTargetRPO, setCompTargetRPO] = useState(5);
  const [compDataClass, setCompDataClass] = useState('Confidential');
  const [compDrTestFreq, setCompDrTestFreq] = useState('quarterly');

  const resetForm = useCallback(() => {
    setFormName('');
    setInfraProvider('AWS');
    setInfraRegions('');
    setInfraDbEngine('PostgreSQL');
    setInfraDbVersion('');
    setInfraDbSizeGB(100);
    setInfraTableCount(50);
    setInfraAvgTPS(500);
    setInfraPeakTPS(2000);
    setInfraHaEnabled(false);
    setInfraClusterType('standalone');
    setBackupStrategy('full+incremental');
    setBackupFullFreq('daily');
    setBackupIncrFreq('every 6 hours');
    setBackupRetention(30);
    setBackupLocation('same-region');
    setBackupEncrypted(false);
    setBackupLastTest('never');
    setReplType('none');
    setReplTopology('single-primary');
    setReplCount(0);
    setReplRegions('');
    setReplLagTolerance(30);
    setReplAutoFailover(false);
    setCompIndustry('Banking');
    setCompRegulations([]);
    setCompTargetRTO(30);
    setCompTargetRPO(5);
    setCompDataClass('Confidential');
    setCompDrTestFreq('quarterly');
  }, []);

  const loadSampleData = useCallback(() => {
    const s = SAMPLE_FORM;
    setFormName(s.name);
    setInfraProvider(s.infrastructure.provider);
    setInfraRegions(s.infrastructure.regions);
    setInfraDbEngine(s.infrastructure.dbEngine);
    setInfraDbVersion(s.infrastructure.dbVersion);
    setInfraDbSizeGB(s.infrastructure.dbSizeGB);
    setInfraTableCount(s.infrastructure.tableCount);
    setInfraAvgTPS(s.infrastructure.avgTPS);
    setInfraPeakTPS(s.infrastructure.peakTPS);
    setInfraHaEnabled(s.infrastructure.haEnabled);
    setInfraClusterType(s.infrastructure.clusterType);
    setBackupStrategy(s.backup.strategy);
    setBackupFullFreq(s.backup.fullFreq);
    setBackupIncrFreq(s.backup.incrFreq);
    setBackupRetention(s.backup.retention);
    setBackupLocation(s.backup.location);
    setBackupEncrypted(s.backup.encrypted);
    setBackupLastTest(s.backup.lastTest);
    setReplType(s.replication.type);
    setReplTopology(s.replication.topology);
    setReplCount(s.replication.count);
    setReplRegions(s.replication.regions);
    setReplLagTolerance(s.replication.lagTolerance);
    setReplAutoFailover(s.replication.autoFailover);
    setCompIndustry(s.compliance.industry);
    setCompRegulations(s.compliance.regulations);
    setCompTargetRTO(s.compliance.targetRTO);
    setCompTargetRPO(s.compliance.targetRPO);
    setCompDataClass(s.compliance.dataClass);
    setCompDrTestFreq(s.compliance.drTestFreq);
  }, []);

  const previewSampleResults = useCallback(() => {
    const mockAssessment: DRAssessment = {
      id: 'sample-preview',
      projectId: projectId || '',
      name: SAMPLE_FORM.name,
      infrastructure: JSON.stringify(SAMPLE_FORM.infrastructure),
      backupConfig: JSON.stringify(SAMPLE_FORM.backup),
      replicationConfig: JSON.stringify(SAMPLE_FORM.replication),
      compliance: JSON.stringify(SAMPLE_FORM.compliance),
      strategy: JSON.stringify(SAMPLE_STRATEGY),
      riskScore: SAMPLE_STRATEGY.executiveSummary.riskScore,
      status: 'analyzed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSelectedAssessment(mockAssessment);
    setStrategy(SAMPLE_STRATEGY);
    setViewMode('results');
    setActiveResultTab('summary');
  }, [projectId]);

  const handleCreateAndAnalyze = useCallback(async () => {
    if (!projectId || !formName.trim()) return;

    const infrastructure: DRInfrastructure = {
      provider: infraProvider,
      regions: infraRegions.split(',').map((r) => r.trim()).filter(Boolean),
      dbEngine: infraDbEngine,
      dbVersion: infraDbVersion,
      dbSizeGB: infraDbSizeGB,
      tableCount: infraTableCount,
      avgTPS: infraAvgTPS,
      peakTPS: infraPeakTPS,
      haEnabled: infraHaEnabled,
      clusterType: infraClusterType,
    };

    const backupConfig: DRBackupConfig = {
      strategy: backupStrategy,
      fullBackupFreq: backupFullFreq,
      incrBackupFreq: backupIncrFreq,
      retentionDays: backupRetention,
      backupLocation: backupLocation,
      backupEncrypted: backupEncrypted,
      lastBackupTest: backupLastTest,
    };

    const replicationConfig: DRReplicationConfig = {
      type: replType,
      topology: replTopology,
      replicaCount: replCount,
      replicaRegions: replRegions.split(',').map((r) => r.trim()).filter(Boolean),
      lagToleranceSec: replLagTolerance,
      autoFailover: replAutoFailover,
    };

    const compliance: DRCompliance = {
      industry: compIndustry,
      regulations: compRegulations,
      targetRTO_min: compTargetRTO,
      targetRPO_min: compTargetRPO,
      dataClassification: compDataClass,
      drTestFrequency: compDrTestFreq,
    };

    try {
      const created = await createAssessment.mutateAsync({
        projectId,
        name: formName,
        infrastructure,
        backupConfig,
        replicationConfig,
        compliance,
      });

      // Immediately run AI analysis
      const result = await analyzeDR.mutateAsync({
        assessmentId: created.id,
        projectId,
      });

      setSelectedAssessment(result.assessment);
      setStrategy(result.strategy);
      setViewMode('results');
      setActiveResultTab('summary');
    } catch {
      // Error handled by TanStack Query
    }
  }, [
    projectId, formName, infraProvider, infraRegions, infraDbEngine, infraDbVersion,
    infraDbSizeGB, infraTableCount, infraAvgTPS, infraPeakTPS, infraHaEnabled, infraClusterType,
    backupStrategy, backupFullFreq, backupIncrFreq, backupRetention, backupLocation, backupEncrypted, backupLastTest,
    replType, replTopology, replCount, replRegions, replLagTolerance, replAutoFailover,
    compIndustry, compRegulations, compTargetRTO, compTargetRPO, compDataClass, compDrTestFreq,
    createAssessment, analyzeDR,
  ]);

  const handleViewAssessment = useCallback((assessment: DRAssessment) => {
    setSelectedAssessment(assessment);
    if (assessment.strategy) {
      try {
        setStrategy(JSON.parse(assessment.strategy));
      } catch {
        setStrategy(null);
      }
    } else {
      setStrategy(null);
    }
    setViewMode('results');
    setActiveResultTab('summary');
  }, []);

  const handleReanalyze = useCallback(async () => {
    if (!selectedAssessment || !projectId) return;
    try {
      const result = await analyzeDR.mutateAsync({
        assessmentId: selectedAssessment.id,
        projectId,
      });
      setSelectedAssessment(result.assessment);
      setStrategy(result.strategy);
    } catch {
      // Error handled by TanStack Query
    }
  }, [selectedAssessment, projectId, analyzeDR]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!projectId) return;
      await deleteAssessment.mutateAsync({ id, projectId });
      if (selectedAssessment?.id === id) {
        setViewMode('list');
        setSelectedAssessment(null);
        setStrategy(null);
      }
    },
    [projectId, deleteAssessment, selectedAssessment],
  );

  const toggleRegulation = (reg: string) => {
    setCompRegulations((prev) =>
      prev.includes(reg) ? prev.filter((r) => r !== reg) : [...prev, reg],
    );
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              AI DR Strategy Generator
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Enterprise disaster recovery planning with AI-powered risk assessment and compliance analysis
            </p>
          </div>
        </div>
        {viewMode !== 'form' && (
          <button
            onClick={() => { resetForm(); setViewMode('form'); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Assessment
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Assessments', value: assessments.length, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Analyzed', value: assessments.filter((a) => a.status === 'analyzed').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'High Risk', value: assessments.filter((a) => (a.riskScore ?? 0) >= 60).length, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Drafts', value: assessments.filter((a) => a.status === 'draft').length, icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted/50' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border border-border p-4', s.bg)}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={cn('w-4 h-4', s.color)} />
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ LIST VIEW ═══ */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <ShieldAlert className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No DR Assessments Yet</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Create your first disaster recovery assessment to evaluate your database infrastructure
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => { resetForm(); setViewMode('form'); }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> Create Assessment
                </button>
                <button
                  onClick={previewSampleResults}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-border bg-card hover:bg-muted/50 text-foreground rounded-lg text-sm font-medium transition-colors"
                >
                  <Eye className="w-4 h-4" /> Preview Sample Results
                </button>
              </div>
            </div>
          ) : (
            assessments.map((a) => {
              const riskColors = getRiskColor(
                (a.riskScore ?? 0) >= 75 ? 'CRITICAL' :
                (a.riskScore ?? 0) >= 50 ? 'HIGH' :
                (a.riskScore ?? 0) >= 25 ? 'MEDIUM' : 'LOW'
              );
              let infra: Partial<DRInfrastructure> = {};
              try { infra = JSON.parse(a.infrastructure); } catch { /* ignore */ }

              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer"
                  onClick={() => handleViewAssessment(a)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', riskColors.bg)}>
                      {a.status === 'analyzed' ? (
                        <span className={cn('text-sm font-bold', riskColors.text)}>
                          {a.riskScore ?? '–'}
                        </span>
                      ) : (
                        <FileText className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-foreground truncate">{a.name}</h4>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium uppercase',
                          a.status === 'analyzed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          a.status === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        )}>
                          {a.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {infra.provider} · {infra.dbEngine} · {infra.dbSizeGB ?? '?'}GB · {new Date(a.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ FORM VIEW ═══ */}
      {viewMode === 'form' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setViewMode('list')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowRight className="w-3 h-3 rotate-180" /> Back to Assessments
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={loadSampleData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                <Database className="w-3 h-3" /> Load Sample Data
              </button>
              <button
                onClick={previewSampleResults}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <Eye className="w-3 h-3" /> Preview Sample Results
              </button>
            </div>
          </div>

          {/* Assessment Name */}
          <div className="bg-card border border-border rounded-xl p-5">
            <label className="block text-sm font-semibold text-foreground mb-2">
              Assessment Name
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Production Banking DB - Q1 2026 DR Review"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
            />
          </div>

          {/* Section 1: Infrastructure Profile */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Server className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold text-foreground">Infrastructure Profile</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Cloud Provider</label>
                <select value={infraProvider} onChange={(e) => setInfraProvider(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {CLOUD_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Regions (comma-separated)</label>
                <input value={infraRegions} onChange={(e) => setInfraRegions(e.target.value)} placeholder="ap-south-1, us-east-1" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Database Engine</label>
                <select value={infraDbEngine} onChange={(e) => setInfraDbEngine(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {DB_ENGINES.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">DB Version</label>
                <input value={infraDbVersion} onChange={(e) => setInfraDbVersion(e.target.value)} placeholder="15.4" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Database Size (GB)</label>
                <input type="number" value={infraDbSizeGB} onChange={(e) => setInfraDbSizeGB(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Table Count</label>
                <input type="number" value={infraTableCount} onChange={(e) => setInfraTableCount(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Avg TPS</label>
                <input type="number" value={infraAvgTPS} onChange={(e) => setInfraAvgTPS(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Peak TPS</label>
                <input type="number" value={infraPeakTPS} onChange={(e) => setInfraPeakTPS(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Cluster Type</label>
                <select value={infraClusterType} onChange={(e) => setInfraClusterType(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {CLUSTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={infraHaEnabled} onChange={(e) => setInfraHaEnabled(e.target.checked)} className="rounded border-border" />
              High Availability (HA) Enabled
            </label>
          </div>

          {/* Section 2: Backup Configuration */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-bold text-foreground">Backup Configuration</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Backup Strategy</label>
                <select value={backupStrategy} onChange={(e) => setBackupStrategy(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {BACKUP_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Full Backup Frequency</label>
                <input value={backupFullFreq} onChange={(e) => setBackupFullFreq(e.target.value)} placeholder="daily" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Incremental/WAL Frequency</label>
                <input value={backupIncrFreq} onChange={(e) => setBackupIncrFreq(e.target.value)} placeholder="every 6 hours" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Retention (days)</label>
                <input type="number" value={backupRetention} onChange={(e) => setBackupRetention(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Backup Location</label>
                <input value={backupLocation} onChange={(e) => setBackupLocation(e.target.value)} placeholder="same-region, cross-region, off-site" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Last Backup Test</label>
                <input value={backupLastTest} onChange={(e) => setBackupLastTest(e.target.value)} placeholder="2025-12-01 or never" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={backupEncrypted} onChange={(e) => setBackupEncrypted(e.target.checked)} className="rounded border-border" />
              Backup Encryption Enabled
            </label>
          </div>

          {/* Section 3: Replication Setup */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-foreground">Replication Setup</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Replication Type</label>
                <select value={replType} onChange={(e) => setReplType(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {REPLICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Topology</label>
                <select value={replTopology} onChange={(e) => setReplTopology(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {TOPOLOGIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Replica Count</label>
                <input type="number" value={replCount} onChange={(e) => setReplCount(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Replica Regions (comma-separated)</label>
                <input value={replRegions} onChange={(e) => setReplRegions(e.target.value)} placeholder="ap-southeast-1, eu-west-1" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Lag Tolerance (seconds)</label>
                <input type="number" value={replLagTolerance} onChange={(e) => setReplLagTolerance(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={replAutoFailover} onChange={(e) => setReplAutoFailover(e.target.checked)} className="rounded border-border" />
              Automatic Failover Enabled
            </label>
          </div>

          {/* Section 4: Compliance & Targets */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-bold text-foreground">Compliance & Recovery Targets</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Industry Sector</label>
                <select value={compIndustry} onChange={(e) => setCompIndustry(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Target RTO (minutes)</label>
                <input type="number" value={compTargetRTO} onChange={(e) => setCompTargetRTO(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Target RPO (minutes)</label>
                <input type="number" value={compTargetRPO} onChange={(e) => setCompTargetRPO(Number(e.target.value))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data Classification</label>
                <select value={compDataClass} onChange={(e) => setCompDataClass(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {DATA_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">DR Test Frequency</label>
                <select value={compDrTestFreq} onChange={(e) => setCompDrTestFreq(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {DR_TEST_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            {/* Regulations multi-select */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">Applicable Regulations</label>
              <div className="flex flex-wrap gap-2">
                {REGULATIONS.map((reg) => (
                  <button
                    key={reg}
                    onClick={() => toggleRegulation(reg)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                      compRegulations.includes(reg)
                        ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400'
                        : 'bg-background border-border text-muted-foreground hover:border-red-300',
                    )}
                  >
                    {reg}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setViewMode('list')}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateAndAnalyze}
              disabled={!formName.trim() || createAssessment.isPending || analyzeDR.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {createAssessment.isPending || analyzeDR.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {createAssessment.isPending ? 'Creating...' : 'Analyzing with AI...'}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Generate DR Strategy
                </>
              )}
            </button>
          </div>

          {(createAssessment.isError || analyzeDR.isError) && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400">
                {(createAssessment.error as { message?: string })?.message ||
                  (analyzeDR.error as { message?: string })?.message ||
                  'An error occurred'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ RESULTS VIEW ═══ */}
      {viewMode === 'results' && selectedAssessment && (
        <div className="space-y-5">
          {/* Back + header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => { setViewMode('list'); setSelectedAssessment(null); setStrategy(null); }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowRight className="w-3 h-3 rotate-180" /> Back to Assessments
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReanalyze}
                disabled={analyzeDR.isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                {analyzeDR.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Re-Analyze
              </button>
            </div>
          </div>

          {/* Assessment title + risk badge */}
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-foreground">{selectedAssessment.name}</h3>
            {selectedAssessment.riskScore !== null && (
              <span className={cn(
                'px-2.5 py-1 rounded-full text-xs font-bold',
                getRiskColor(
                  selectedAssessment.riskScore >= 75 ? 'CRITICAL' :
                  selectedAssessment.riskScore >= 50 ? 'HIGH' :
                  selectedAssessment.riskScore >= 25 ? 'MEDIUM' : 'LOW'
                ).bg,
                getRiskColor(
                  selectedAssessment.riskScore >= 75 ? 'CRITICAL' :
                  selectedAssessment.riskScore >= 50 ? 'HIGH' :
                  selectedAssessment.riskScore >= 25 ? 'MEDIUM' : 'LOW'
                ).text,
              )}>
                Risk Score: {selectedAssessment.riskScore}
              </span>
            )}
          </div>

          {!strategy ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <ShieldAlert className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No Strategy Generated Yet</h3>
              <p className="text-xs text-muted-foreground mb-4">Click "Re-Analyze" to generate an AI-powered DR strategy</p>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border">
                {RESULT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveResultTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                      activeResultTab === tab.id
                        ? 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30',
                    )}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-card border border-border rounded-xl p-5">
                {/* ── Executive Summary ── */}
                {activeResultTab === 'summary' && strategy.executiveSummary && (
                  <div className="space-y-5">
                    {/* Risk Gauge */}
                    <div className="flex items-center gap-6 p-5 bg-secondary/30 rounded-xl">
                      <div className="relative w-24 h-24 shrink-0">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
                          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                            strokeDasharray={`${(strategy.executiveSummary.riskScore / 100) * 264} 264`}
                            strokeLinecap="round"
                            className={cn(
                              strategy.executiveSummary.riskScore >= 75 ? 'text-red-500' :
                              strategy.executiveSummary.riskScore >= 50 ? 'text-orange-500' :
                              strategy.executiveSummary.riskScore >= 25 ? 'text-yellow-500' : 'text-green-500'
                            )}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-bold text-foreground">{strategy.executiveSummary.riskScore}</span>
                          <span className="text-[9px] text-muted-foreground">RISK</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn('px-2 py-0.5 rounded text-xs font-bold', getRiskColor(strategy.executiveSummary.overallRiskLevel).bg, getRiskColor(strategy.executiveSummary.overallRiskLevel).text)}>
                            {strategy.executiveSummary.overallRiskLevel}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-2">{strategy.executiveSummary.headline}</p>
                      </div>
                    </div>

                    {/* Key Findings */}
                    {strategy.executiveSummary.keyFindings?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-blue-500" /> Key Findings
                        </h4>
                        <ul className="space-y-1.5">
                          {strategy.executiveSummary.keyFindings.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Critical Gaps */}
                    {strategy.executiveSummary.criticalGaps?.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <XCircle className="w-4 h-4 text-red-500" /> Critical Gaps
                        </h4>
                        <ul className="space-y-1.5">
                          {strategy.executiveSummary.criticalGaps.map((g, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Risk Assessment ── */}
                {activeResultTab === 'risk' && strategy.riskAssessment && (
                  <div className="space-y-5">
                    {/* Category Scores */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Risk Categories</h4>
                      <div className="space-y-3">
                        {(strategy.riskAssessment.categories ?? []).map((cat, i) => {
                          const rc = getRiskColor(cat.level);
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">{cat.name}</span>
                                <span className={cn('text-xs font-bold px-2 py-0.5 rounded', rc.bg, rc.text)}>{cat.score}/100 · {cat.level}</span>
                              </div>
                              <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                                <div className={cn('h-full rounded-full transition-all', rc.bar)} style={{ width: `${cat.score}%` }} />
                              </div>
                              <p className="text-xs text-muted-foreground">{cat.details}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Vulnerabilities */}
                    {(strategy.riskAssessment.vulnerabilities ?? []).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">Vulnerabilities</h4>
                        <div className="space-y-2">
                          {strategy.riskAssessment.vulnerabilities.map((v, i) => (
                            <div key={i} className="p-3 bg-secondary/30 rounded-lg border border-border">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', getPriorityColor(v.severity))}>
                                  {v.severity}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{v.category}</span>
                              </div>
                              <p className="text-sm text-foreground mb-1">{v.description}</p>
                              <p className="text-xs text-muted-foreground"><strong>Mitigation:</strong> {v.mitigation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Failover Plan ── */}
                {activeResultTab === 'failover' && strategy.failoverPlan && (
                  <div className="space-y-5">
                    {/* Strategy Header */}
                    <div className="flex items-center flex-wrap gap-3 p-4 bg-secondary/30 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-semibold text-foreground">Strategy:</span>
                        <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold uppercase">
                          {strategy.failoverPlan.strategy}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className={cn('font-bold', strategy.failoverPlan.meetsTargetRTO ? 'text-green-600' : 'text-red-600')}>
                          RTO: {strategy.failoverPlan.estimatedRTO} {strategy.failoverPlan.meetsTargetRTO ? '✓' : '✗'}
                        </span>
                        <span className={cn('font-bold', strategy.failoverPlan.meetsTargetRPO ? 'text-green-600' : 'text-red-600')}>
                          RPO: {strategy.failoverPlan.estimatedRPO} {strategy.failoverPlan.meetsTargetRPO ? '✓' : '✗'}
                        </span>
                        <span className="text-muted-foreground">
                          Automation: <strong className="text-foreground">{strategy.failoverPlan.automationLevel}</strong>
                        </span>
                      </div>
                    </div>

                    {strategy.failoverPlan.strategyJustification && (
                      <p className="text-sm text-muted-foreground italic">{strategy.failoverPlan.strategyJustification}</p>
                    )}

                    {/* Failover Steps Timeline */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-3">Failover Procedure</h4>
                      <div className="space-y-0">
                        {(strategy.failoverPlan.steps ?? []).map((step, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-red-600 dark:text-red-400">{step.order}</span>
                              </div>
                              {i < (strategy.failoverPlan.steps?.length ?? 0) - 1 && (
                                <div className="w-px flex-1 bg-border my-1" />
                              )}
                            </div>
                            <div className="pb-4 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{step.phase}</span>
                                <span className="text-xs text-muted-foreground">{step.estimatedTime}</span>
                                {step.automated && <Zap className="w-3 h-3 text-yellow-500" title="Automated" />}
                              </div>
                              <p className="text-sm font-medium text-foreground">{step.action}</p>
                              {step.details && <p className="text-xs text-muted-foreground mt-0.5">{step.details}</p>}
                              <span className="text-[10px] text-muted-foreground">Responsible: {step.responsible}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {strategy.failoverPlan.rollbackPlan && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <h5 className="text-xs font-bold text-yellow-800 dark:text-yellow-400 mb-1">Rollback Plan</h5>
                        <p className="text-xs text-yellow-700 dark:text-yellow-500">{strategy.failoverPlan.rollbackPlan}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Backup Policy ── */}
                {activeResultTab === 'backup' && strategy.backupPolicy && (
                  <div className="space-y-5">
                    {/* Recommended Policy */}
                    {strategy.backupPolicy.recommended && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">Recommended Backup Policy</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { label: 'Full Backup', value: strategy.backupPolicy.recommended.fullFrequency, icon: HardDrive },
                            { label: 'Incremental', value: strategy.backupPolicy.recommended.incrementalFrequency, icon: Clock },
                            { label: 'Retention', value: `${strategy.backupPolicy.recommended.retentionDays} days`, icon: Archive },
                            { label: 'Encryption', value: strategy.backupPolicy.recommended.encryption, icon: Lock },
                            { label: 'Testing', value: strategy.backupPolicy.recommended.testingFrequency, icon: Play },
                            { label: 'WAL Archiving', value: strategy.backupPolicy.recommended.walArchiving ? 'Enabled' : 'Disabled', icon: Database },
                          ].map((item) => (
                            <div key={item.label} className="p-3 bg-secondary/30 rounded-lg border border-border">
                              <div className="flex items-center gap-1.5 mb-1">
                                <item.icon className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">{item.label}</span>
                              </div>
                              <p className="text-sm font-semibold text-foreground">{item.value}</p>
                            </div>
                          ))}
                        </div>
                        {(strategy.backupPolicy.recommended.backupLocations ?? []).length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Locations: </span>
                            {strategy.backupPolicy.recommended.backupLocations.map((loc, i) => (
                              <span key={i} className="px-2 py-0.5 bg-muted rounded text-xs text-foreground">{loc}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Gaps Table */}
                    {(strategy.backupPolicy.gaps ?? []).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3">Current vs Recommended</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Aspect</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Current</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Recommended</th>
                                <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Priority</th>
                              </tr>
                            </thead>
                            <tbody>
                              {strategy.backupPolicy.gaps.map((gap, i) => (
                                <tr key={i} className="border-b border-border/50">
                                  <td className="py-2 px-3 font-medium text-foreground">{gap.aspect}</td>
                                  <td className="py-2 px-3 text-red-600 dark:text-red-400">{gap.current}</td>
                                  <td className="py-2 px-3 text-green-600 dark:text-green-400">{gap.recommended}</td>
                                  <td className="py-2 px-3">
                                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', getPriorityColor(gap.priority))}>
                                      {gap.priority}
                                    </span>
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

                {/* ── Compliance Report ── */}
                {activeResultTab === 'compliance' && strategy.complianceReport && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={cn(
                        'px-3 py-1 rounded-lg text-sm font-bold',
                        strategy.complianceReport.overallStatus === 'COMPLIANT' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        strategy.complianceReport.overallStatus === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}>
                        Overall: {strategy.complianceReport.overallStatus}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(strategy.complianceReport.regulations ?? []).map((reg, i) => (
                        <div key={i} className="p-4 bg-secondary/30 rounded-xl border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-foreground" />
                              <span className="text-sm font-bold text-foreground">{reg.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', getStatusColor(reg.status))}>
                                {reg.status}
                              </span>
                              {reg.score !== undefined && (
                                <span className="text-xs text-muted-foreground">{reg.score}%</span>
                              )}
                            </div>
                          </div>
                          {(reg.gaps ?? []).length > 0 && (
                            <div className="mb-2">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">Gaps:</span>
                              <ul className="mt-1 space-y-0.5">
                                {reg.gaps.map((g, j) => (
                                  <li key={j} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5">
                                    <XCircle className="w-3 h-3 mt-0.5 shrink-0" /> {g}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {(reg.remediation ?? []).length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">Remediation:</span>
                              <ul className="mt-1 space-y-0.5">
                                {reg.remediation.map((r, j) => (
                                  <li key={j} className="text-xs text-green-600 dark:text-green-400 flex items-start gap-1.5">
                                    <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" /> {r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── DR Architecture ── */}
                {activeResultTab === 'architecture' && strategy.architecture && (
                  <div className="space-y-5">
                    {/* Architecture Diagram (visual representation) */}
                    <div className="p-5 bg-secondary/20 rounded-xl border border-border">
                      <h4 className="text-sm font-semibold text-foreground mb-4">Recommended Architecture</h4>

                      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 justify-center">
                        {/* Primary */}
                        {strategy.architecture.recommended?.primary && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl text-center min-w-[160px]">
                            <Database className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                            <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase">{strategy.architecture.recommended.primary.role}</p>
                            <p className="text-sm font-semibold text-foreground">{strategy.architecture.recommended.primary.engine}</p>
                            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                              <Globe className="w-3 h-3" /> {strategy.architecture.recommended.primary.region}
                            </p>
                          </div>
                        )}

                        {/* Arrows + Replicas */}
                        {(strategy.architecture.recommended?.replicas ?? []).length > 0 && (
                          <>
                            <div className="flex items-center">
                              <ArrowRight className="w-5 h-5 text-muted-foreground hidden lg:block" />
                              <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90 lg:hidden" />
                            </div>
                            <div className="flex flex-col gap-3">
                              {strategy.architecture.recommended.replicas.map((rep, i) => (
                                <div key={i} className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-xl text-center min-w-[160px]">
                                  <GitBranch className="w-5 h-5 text-green-600 mx-auto mb-2" />
                                  <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">{rep.role}</p>
                                  <p className="text-xs text-foreground">{rep.replicationType}</p>
                                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                                    <Globe className="w-3 h-3" /> {rep.region}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{rep.purpose}</p>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {/* Backup Targets */}
                        {(strategy.architecture.recommended?.backupTargets ?? []).length > 0 && (
                          <>
                            <div className="flex items-center">
                              <ArrowRight className="w-5 h-5 text-muted-foreground hidden lg:block" />
                              <ArrowRight className="w-5 h-5 text-muted-foreground rotate-90 lg:hidden" />
                            </div>
                            <div className="flex flex-col gap-3">
                              {strategy.architecture.recommended.backupTargets.map((bt, i) => (
                                <div key={i} className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-xl text-center min-w-[160px]">
                                  <Archive className="w-5 h-5 text-orange-600 mx-auto mb-2" />
                                  <p className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase">{bt.type}</p>
                                  <p className="text-xs text-foreground">{bt.frequency}</p>
                                  <p className="text-xs text-muted-foreground">{bt.location}</p>
                                  <p className="text-[10px] text-muted-foreground">Retention: {bt.retention}</p>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {strategy.architecture.dataFlow && (
                        <p className="text-xs text-muted-foreground mt-4 text-center italic">{strategy.architecture.dataFlow}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Recommendations ── */}
                {activeResultTab === 'recommendations' && (strategy.recommendations ?? []).length > 0 && (
                  <div className="space-y-3">
                    {strategy.recommendations.map((rec, i) => (
                      <div key={i} className="p-4 bg-secondary/30 rounded-xl border border-border">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase', getPriorityColor(rec.priority))}>
                            {rec.priority}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">{rec.category}</span>
                          {rec.effort && (
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              Effort: <strong className="text-foreground">{rec.effort}</strong> · {rec.timeline}
                            </span>
                          )}
                        </div>
                        <h5 className="text-sm font-semibold text-foreground mb-1">{rec.title}</h5>
                        <p className="text-xs text-muted-foreground">{rec.description}</p>
                        {rec.impact && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            <strong>Impact:</strong> {rec.impact}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── DR Test Plan ── */}
                {activeResultTab === 'test-plan' && strategy.drTestPlan && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-semibold text-foreground">Recommended Test Frequency:</span>
                      <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold">
                        {strategy.drTestPlan.frequency}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {(strategy.drTestPlan.testTypes ?? []).map((test, i) => (
                        <div key={i} className="p-4 bg-secondary/30 rounded-xl border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-sm font-semibold text-foreground">{test.name}</h5>
                            <span className="text-xs text-muted-foreground">{test.frequency}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{test.description}</p>
                          {(test.successCriteria ?? []).length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">Success Criteria:</span>
                              <ul className="mt-1 space-y-0.5">
                                {test.successCriteria.map((c, j) => (
                                  <li key={j} className="text-xs text-foreground flex items-start gap-1.5">
                                    <Target className="w-3 h-3 text-green-500 mt-0.5 shrink-0" /> {c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default DisasterRecovery;
