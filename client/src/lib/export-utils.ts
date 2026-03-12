import { toPng, toSvg } from 'html-to-image';

// ── PNG Export ────────────────────────────────────────────────────────────────

export async function exportDiagramAsPNG(): Promise<void> {
  const element = document.querySelector('.react-flow') as HTMLElement;
  if (!element) return;

  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    quality: 1,
  });

  const link = document.createElement('a');
  link.download = 'er-diagram.png';
  link.href = dataUrl;
  link.click();
}

// ── SVG Export ────────────────────────────────────────────────────────────────

export async function exportDiagramAsSVG(): Promise<void> {
  const element = document.querySelector('.react-flow') as HTMLElement;
  if (!element) return;

  const dataUrl = await toSvg(element, {
    backgroundColor: '#ffffff',
  });

  const link = document.createElement('a');
  link.download = 'er-diagram.svg';
  link.href = dataUrl;
  link.click();
}

// ── DDL Generation ────────────────────────────────────────────────────────────

export function generateDDL(
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      dataType: string;
      nullable: boolean;
      isPrimaryKey: boolean;
      defaultValue?: string | null;
    }>;
  }>,
  dialect: string
): string {
  let ddl = `-- Generated DDL for ${dialect}\n-- ${new Date().toISOString()}\n\n`;

  for (const table of tables) {
    ddl += `CREATE TABLE ${table.name} (\n`;
    const columnDefs = table.columns.map((col) => {
      let def = `  ${col.name} ${col.dataType}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    });

    // Add primary key constraint
    const pkColumns = table.columns.filter((c) => c.isPrimaryKey);
    if (pkColumns.length > 0) {
      columnDefs.push(
        `  PRIMARY KEY (${pkColumns.map((c) => c.name).join(', ')})`
      );
    }

    ddl += columnDefs.join(',\n');
    ddl += '\n);\n\n';
  }

  return ddl;
}

// ── Text File Download ────────────────────────────────────────────────────────

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
