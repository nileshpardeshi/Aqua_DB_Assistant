import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '../components/layout/app-layout';
import { Dashboard } from '../pages/dashboard';
import { Settings } from '../pages/settings';
import { AuditLogs } from '../pages/audit-logs';
import { ProjectWorkspace } from '../pages/project-workspace';
import { ProjectOverview } from '../pages/project-overview';
import { SchemaIntelligence } from '../pages/schema-intelligence';
import { ErDiagram } from '../pages/er-diagram';
import { QueryIntelligence } from '../pages/query-intelligence';
import { PerformanceLab } from '../pages/performance-lab';
import { DataLifecycle } from '../pages/data-lifecycle';
import { MigrationStudio } from '../pages/migration-studio';
import { Connections } from '../pages/connections';
import { SQLConverterPage } from '../pages/sql-converter';
import { JPAQueryLabPage } from '../pages/jpa-query-lab';
import { DocumentationGenerator } from '../pages/documentation-generator';
import { AIUsageDashboard } from '../pages/ai-usage-dashboard';
import { NotFound } from '../pages/not-found';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'audit-logs',
        element: <AuditLogs />,
      },
      {
        path: 'ai-usage',
        element: <AIUsageDashboard />,
      },
      // Independent tools
      {
        path: 'tools/sql-converter',
        element: <SQLConverterPage />,
      },
      {
        path: 'tools/jpa-lab',
        element: <JPAQueryLabPage />,
      },
      {
        path: 'tools/connections',
        element: <Connections />,
      },
      // Project workspace
      {
        path: 'project/:projectId',
        element: <ProjectWorkspace />,
        children: [
          {
            index: true,
            element: <ProjectOverview />,
          },
          {
            path: 'schema',
            element: <SchemaIntelligence />,
          },
          {
            path: 'schema/er-diagram',
            element: <ErDiagram />,
          },
          {
            path: 'query',
            element: <QueryIntelligence />,
          },
          {
            path: 'performance',
            element: <PerformanceLab />,
          },
          {
            path: 'docs',
            element: <DocumentationGenerator />,
          },
          {
            path: 'data-lifecycle',
            element: <DataLifecycle />,
          },
          {
            path: 'migrations',
            element: <MigrationStudio />,
          },
          {
            path: 'connections',
            element: <Connections />,
          },
        ],
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

export default router;
