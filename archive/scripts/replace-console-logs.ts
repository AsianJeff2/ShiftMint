/**
 * Script to replace console.log/error/warn with structured logger
 *
 * Usage: npx tsx scripts/replace-console-logs.ts
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

interface Replacement {
  file: string;
  oldPattern: RegExp;
  newPattern: string;
  description: string;
}

const replacements: Replacement[] = [
  {
    file: 'all',
    oldPattern: /console\.error\(/g,
    newPattern: 'logger.error(',
    description: 'console.error → logger.error',
  },
  {
    file: 'all',
    oldPattern: /console\.warn\(/g,
    newPattern: 'logger.warn(',
    description: 'console.warn → logger.warn',
  },
  {
    file: 'all',
    oldPattern: /console\.log\(/g,
    newPattern: 'logger.info(',
    description: 'console.log → logger.info',
  },
  {
    file: 'all',
    oldPattern: /console\.debug\(/g,
    newPattern: 'logger.debug(',
    description: 'console.debug → logger.debug',
  },
];

interface FileStats {
  path: string;
  replacements: number;
  patterns: string[];
}

async function replaceConsoleInFile(filePath: string): Promise<FileStats | null> {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let replacementCount = 0;
  const patternsFound: string[] = [];

  // Check if file uses console statements
  const hasConsole = /console\.(log|error|warn|debug)\(/.test(content);
  if (!hasConsole) {
    return null;
  }

  // Apply replacements
  for (const replacement of replacements) {
    const matches = content.match(replacement.oldPattern);
    if (matches) {
      content = content.replace(replacement.oldPattern, replacement.newPattern);
      modified = true;
      replacementCount += matches.length;
      patternsFound.push(replacement.description);
    }
  }

  // Add logger import if modified and not already present
  if (modified) {
    const hasLoggerImport = /from ['"]@\/lib\/infrastructure\/Logger['"]/.test(content) ||
                           /from ['"]\.\.\/lib\/infrastructure\/Logger['"]/.test(content) ||
                           /from ['"]\.\.\/\.\.\/lib\/infrastructure\/Logger['"]/.test(content);

    if (!hasLoggerImport) {
      // Determine correct import path based on file location
      const relativePath = path.relative(path.dirname(filePath), 'lib/infrastructure/Logger');
      const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      const normalizedPath = importPath.replace(/\\/g, '/').replace(/\.ts$/, '');

      // Add import after existing imports or at the top
      const importStatement = `import { logger } from '${normalizedPath}';\n`;

      // Find the last import statement
      const importRegex = /import\s+.*from\s+['"].*['"];?\n/g;
      const imports = content.match(importRegex);

      if (imports && imports.length > 0) {
        const lastImport = imports[imports.length - 1];
        const lastImportIndex = content.lastIndexOf(lastImport);
        content = content.slice(0, lastImportIndex + lastImport.length) +
                 importStatement +
                 content.slice(lastImportIndex + lastImport.length);
      } else {
        // No imports found, add at the top
        content = importStatement + content;
      }
    }

    fs.writeFileSync(filePath, content, 'utf8');

    return {
      path: filePath,
      replacements: replacementCount,
      patterns: patternsFound,
    };
  }

  return null;
}

async function main() {
  console.log('🔍 Searching for console.log/error/warn statements...\n');

  // Only process backend files (electron/backend) to avoid UI logging
  const patterns = [
    'electron/backend/**/*.{ts,js}',
  ];

  const allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/dist-electron/**'],
      absolute: true,
    });
    allFiles.push(...files);
  }

  console.log(`Found ${allFiles.length} backend files to process\n`);

  const modifiedFiles: FileStats[] = [];
  let totalReplacements = 0;

  for (const file of allFiles) {
    const result = await replaceConsoleInFile(file);
    if (result) {
      modifiedFiles.push(result);
      totalReplacements += result.replacements;
      console.log(`✓ ${path.relative(process.cwd(), result.path)}`);
      console.log(`  ${result.replacements} replacements: ${result.patterns.join(', ')}\n`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Files modified: ${modifiedFiles.length}`);
  console.log(`  Total replacements: ${totalReplacements}`);

  if (modifiedFiles.length === 0) {
    console.log('\n✨ No console statements found in backend files!');
  } else {
    console.log('\n⚠️  Next steps:');
    console.log('  1. Review the changes with git diff');
    console.log('  2. Remove any debug console.logs that are no longer needed');
    console.log('  3. Add structured metadata to important logs');
    console.log('  4. Run tests to ensure nothing broke');
  }
}

main().catch(console.error);
