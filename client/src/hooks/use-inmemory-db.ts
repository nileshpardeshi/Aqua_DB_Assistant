import { useState, useCallback, useRef } from 'react';
import initSqlJs, { type Database } from 'sql.js';

export interface InMemoryTableResult {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  status: 'success' | 'failed';
  error?: string;
  durationMs: number;
}

export interface InMemoryExecResult {
  tables: InMemoryTableResult[];
  totalDurationMs: number;
  statementsExecuted: number;
  statementsFailed: number;
}

/**
 * Hook for executing SQL in an in-memory SQLite database (via sql.js WASM).
 * Works entirely in the browser — no server required.
 */
export function useInMemoryDB() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<InMemoryExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dbRef = useRef<Database | null>(null);

  const execute = useCallback(async (sql: string) => {
    setIsExecuting(true);
    setError(null);
    setResult(null);

    const startTime = performance.now();

    try {
      // Initialize sql.js with WASM served from public folder
      const SQL = await initSqlJs({
        locateFile: () => '/sql-wasm.wasm',
      });

      // Close previous DB if exists
      if (dbRef.current) {
        dbRef.current.close();
      }

      const db = new SQL.Database();
      dbRef.current = db;

      // Normalize SQL: split by semicolons, filter empty
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'));

      let statementsExecuted = 0;
      let statementsFailed = 0;
      const failedStatements: string[] = [];

      // Execute each statement
      for (const stmt of statements) {
        try {
          db.run(stmt);
          statementsExecuted++;
        } catch (err) {
          statementsFailed++;
          failedStatements.push(
            `${stmt.substring(0, 80)}... → ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Query all tables created
      const tablesResult = db.exec(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      );

      const tableNames: string[] = tablesResult.length > 0
        ? tablesResult[0].values.map((row) => String(row[0]))
        : [];

      // For each table, get columns and rows
      const tables: InMemoryTableResult[] = [];
      for (const tableName of tableNames) {
        const tStart = performance.now();
        try {
          // Get row count
          const countResult = db.exec(`SELECT COUNT(*) FROM "${tableName}"`);
          const rowCount = countResult.length > 0 ? Number(countResult[0].values[0][0]) : 0;

          // Get sample data (up to 100 rows)
          const dataResult = db.exec(`SELECT * FROM "${tableName}" LIMIT 100`);

          let columns: string[] = [];
          let rows: Record<string, unknown>[] = [];

          if (dataResult.length > 0) {
            columns = dataResult[0].columns;
            rows = dataResult[0].values.map((row) => {
              const record: Record<string, unknown> = {};
              columns.forEach((col, i) => {
                record[col] = row[i];
              });
              return record;
            });
          } else {
            // Table exists but has no data — get columns from pragma
            const pragmaResult = db.exec(`PRAGMA table_info("${tableName}")`);
            if (pragmaResult.length > 0) {
              columns = pragmaResult[0].values.map((row) => String(row[1]));
            }
          }

          tables.push({
            tableName,
            columns,
            rows,
            rowCount,
            status: 'success',
            durationMs: Math.round(performance.now() - tStart),
          });
        } catch (err) {
          tables.push({
            tableName,
            columns: [],
            rows: [],
            rowCount: 0,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            durationMs: Math.round(performance.now() - tStart),
          });
        }
      }

      const totalDurationMs = Math.round(performance.now() - startTime);

      const execResult: InMemoryExecResult = {
        tables,
        totalDurationMs,
        statementsExecuted,
        statementsFailed,
      };

      // If some statements failed but we still have results, include details
      if (statementsFailed > 0 && tables.length === 0) {
        setError(
          `All ${statementsFailed} statement(s) failed.\n\n` +
          failedStatements.join('\n\n')
        );
      } else if (statementsFailed > 0) {
        // Partial success — attach failed info to result
        execResult.tables.push({
          tableName: '⚠ Failed Statements',
          columns: ['statement', 'error'],
          rows: failedStatements.map((f) => {
            const [stmt, ...errParts] = f.split(' → ');
            return { statement: stmt, error: errParts.join(' → ') };
          }),
          rowCount: statementsFailed,
          status: 'failed',
          error: `${statementsFailed} statement(s) failed`,
          durationMs: 0,
        });
      }

      setResult(execResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExecuting(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (dbRef.current) {
      dbRef.current.close();
      dbRef.current = null;
    }
    setResult(null);
    setError(null);
  }, []);

  return {
    execute,
    cleanup,
    isExecuting,
    result,
    error,
  };
}
