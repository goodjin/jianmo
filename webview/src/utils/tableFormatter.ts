/**
 * Markdown Table Formatter
 * Automatically formats markdown tables with proper column alignment
 */

/**
 * Detect if a line is a table separator row (e.g., |---|)
 */
function isTableSeparator(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]*\|[\s|:-]*\|?$/.test(line);
}

/**
 * Detect if content contains a table
 */
export function containsTable(content: string): boolean {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (isTableSeparator(line)) {
      // Check if there's a header row above
      if (i > 0 && lines[i - 1].trim().startsWith('|')) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get column alignment from separator row
 * Returns: 'left' | 'center' | 'right' for each column
 */
function getColumnAlignments(separatorLine: string): string[] {
  const cells = separatorLine.split('|').filter(s => s.trim());
  return cells.map(cell => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
      return 'center';
    } else if (trimmed.endsWith(':')) {
      return 'right';
    } else if (trimmed.startsWith(':')) {
      return 'left';
    }
    return 'left';
  });
}

/**
 * Pad cell content to specified width with alignment
 */
function padCell(content: string, width: number, alignment: string): string {
  const cellContent = content || '';
  const padding = width - cellContent.length;
  
  if (padding <= 0) return cellContent;
  
  switch (alignment) {
    case 'right':
      return ' '.repeat(padding) + cellContent;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + cellContent + ' '.repeat(rightPad);
    default: // left
      return cellContent + ' '.repeat(padding);
  }
}

/**
 * Format a single markdown table
 */
function formatTable(tableLines: string[]): string[] {
  if (tableLines.length < 2) return tableLines;
  
  // Parse all rows
  const rows = tableLines.map(line => {
    // Remove leading/trailing | and split
    const cells = line.trim().split('|').filter((_, i, arr) => {
      // Skip first and last elements (they are the leading/trailing | separators)
      // Only keep them if they have actual content (handles tables without outer |)
      if (i === 0 || i === arr.length - 1) {
        return arr[i].trim() !== '';
      }
      // Keep all middle cells (including empty ones) to preserve column structure
      return true;
    });
    return cells.map(cell => cell.trim());
  });
  
  // Check if we have a valid table (header + separator)
  if (rows.length < 2) return tableLines;
  
  // Get alignments from separator row
  const alignments = getColumnAlignments(rows[1].join('|'));
  
  // Calculate max width for each column
  const numCols = Math.max(...rows.map(row => row.length));
  const columnWidths: number[] = [];
  
  for (let col = 0; col < numCols; col++) {
    let maxWidth = 3; // Minimum width for ---
    for (const row of rows) {
      const cell = row[col] || '';
      if (col === 1 && row === rows[1]) {
        // Separator row - use minimum width
        maxWidth = Math.max(maxWidth, 3);
      } else {
        maxWidth = Math.max(maxWidth, cell.length);
      }
    }
    columnWidths[col] = maxWidth;
  }
  
  // Reconstruct table with proper formatting
  const formattedRows = rows.map((row, rowIndex) => {
    const cells: string[] = [];
    
    for (let col = 0; col < numCols; col++) {
      const cell = row[col] || '';
      
      if (rowIndex === 1) {
        // Separator row - format as ---, :---, :---:, or ---:
        const alignment = alignments[col] || 'left';
        let sep = '-'.repeat(columnWidths[col]);
        if (alignment === 'center') {
          sep = ':' + sep.substring(1, sep.length - 1) + ':';
        } else if (alignment === 'right') {
          sep = sep.substring(0, sep.length - 1) + ':';
        } else if (alignment === 'left') {
          sep = ':' + sep.substring(1);
        }
        cells.push(sep);
      } else {
        cells.push(padCell(cell, columnWidths[col], alignments[col]));
      }
    }
    
    return '| ' + cells.join(' | ') + ' |';
  });
  
  return formattedRows;
}

/**
 * Find and format all tables in the content
 * Returns the formatted content
 */
export function formatTablesInContent(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check if this line is a table header (starts with |)
    if (line.startsWith('|') && !isTableSeparator(line)) {
      // Found a potential table, collect all table lines
      const tableLines: string[] = [lines[i]];
      
      // Look ahead for more table lines
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('|') || isTableSeparator(nextLine)) {
          tableLines.push(lines[j]);
          j++;
        } else {
          break;
        }
      }
      
      // Format the table
      const formattedTable = formatTable(tableLines);
      result.push(...formattedTable);
      i = j;
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  
  return result.join('\n');
}

/**
 * Debounced table formatter for real-time editing
 */
export function createTableFormatter(delay: number = 300) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return {
    format: (content: string): string => {
      // Quick check if content has table potential
      if (!content.includes('|')) {
        return content;
      }
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Return formatted immediately (sync version for simplicity)
      return formatTablesInContent(content);
    },
    
    formatAsync: async (content: string): Promise<string> => {
      // Quick check if content has table potential
      if (!content.includes('|')) {
        return content;
      }
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      return new Promise<string>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve(formatTablesInContent(content));
        }, delay);
      });
    },
    
    cancel: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };
}
