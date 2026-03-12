import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { analyzeJPAQuery } from '../services/jpa-analyzer.service.js';
import { convertDialect as convertDialectService } from '../services/dialect-converter.service.js';
import { sqlParserService } from '../services/sql-parser/index.js';
import { detectDialectWithScores } from '../services/sql-parser/dialect-detector.js';

// ---------- Analyze JPA Query ----------

export const analyzeJPA = asyncHandler(async (req: Request, res: Response) => {
  const { jpql, dialect, entityContext, dataVolumes } = req.body as {
    jpql: string;
    dialect: string;
    entityContext?: string;
    dataVolumes?: number[];
  };

  if (!jpql || !dialect) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'jpql and dialect are required',
      },
    });
    return;
  }

  const result = await analyzeJPAQuery({
    jpql,
    dialect,
    entityContext,
    dataVolumes,
  });

  res.json({
    success: true,
    data: result,
  });
});

// ---------- Convert SQL ----------

export const convertSQL = asyncHandler(async (req: Request, res: Response) => {
  const { sql, sourceDialect, targetDialect } = req.body as {
    sql: string;
    sourceDialect: string;
    targetDialect: string;
  };

  if (!sql || !sourceDialect || !targetDialect) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'sql, sourceDialect, and targetDialect are required',
      },
    });
    return;
  }

  const result = convertDialectService(sql, sourceDialect, targetDialect);

  res.json({
    success: true,
    data: result,
  });
});

// ---------- Validate SQL ----------

export const validateSQL = asyncHandler(async (req: Request, res: Response) => {
  const { sql, dialect } = req.body as {
    sql: string;
    dialect?: string;
  };

  if (!sql) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'sql is required',
      },
    });
    return;
  }

  const parseResult = sqlParserService.parseSQL(sql, dialect);
  const hasErrors = parseResult.errors.some((e) => e.severity === 'error');

  res.json({
    success: true,
    data: {
      valid: !hasErrors,
      errors: parseResult.errors.map((e) => e.message),
      tablesFound: parseResult.tables.length,
      dialect: parseResult.dialect,
    },
  });
});

// ---------- Detect Dialect ----------

export const detectDialect = asyncHandler(async (req: Request, res: Response) => {
  const { sql } = req.body as { sql: string };

  if (!sql) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'sql is required',
      },
    });
    return;
  }

  const result = detectDialectWithScores(sql);

  res.json({
    success: true,
    data: result,
  });
});
