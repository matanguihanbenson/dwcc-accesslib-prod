#!/usr/bin/env node

/**
 * Script to verify duplicate prevention implementation across the DWCC AccessLib API
 * This script checks that all critical endpoints have proper duplicate prevention
 */

const fs = require('fs');
const path = require('path');

// Routes that should have duplicate prevention
const criticalRoutes = [
  // Book management
  { path: 'app/api/books/route.ts', operation: 'POST', description: 'Creating books' },
  { path: 'app/api/book-categories/route.ts', operation: 'POST', description: 'Creating book categories' },
  
  // User management  
  { path: 'app/api/library-users/route.ts', operation: 'POST', description: 'Creating library users' },
  { path: 'app/api/users/register-admin/route.ts', operation: 'POST', description: 'Creating admin accounts' },
  
  // Transaction management
  { path: 'app/api/borrowing-transactions/route.ts', operation: 'POST', description: 'Creating borrow requests' },
  { path: 'app/api/borrowing-transactions/[transaction_id]/approve/route.ts', operation: 'PATCH', description: 'Approving transactions' },
  
  // System configuration
  { path: 'app/api/departments/route.ts', operation: 'POST', description: 'Creating departments' },
  { path: 'app/api/programs/route.ts', operation: 'POST', description: 'Creating programs' },
];

const baseDir = process.cwd();

console.log('🔍 Checking Duplicate Prevention Implementation\n');
console.log('=' .repeat(60));

let allImplemented = true;
let totalChecked = 0;
let implementedCount = 0;

for (const route of criticalRoutes) {
  totalChecked++;
  const filePath = path.join(baseDir, route.path);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ File not found: ${route.path}`);
      allImplemented = false;
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for duplicate prevention import
    const hasImport = (
      content.includes('withDuplicatePreventionByBody') && 
      (content.includes("from '@/lib/duplicate-prevention'") || content.includes('from "@/lib/duplicate-prevention"'))
    );
    
    // Check for wrapped export (more flexible pattern)
    const hasWrappedExport = (
      content.includes(`export const ${route.operation} = withDuplicatePreventionByBody(`) ||
      content.includes(`export const ${route.operation} = withAuth(\n  withDuplicatePreventionByBody(`) ||
      content.includes(`${route.operation} = withDuplicatePreventionByBody(`) ||
      content.includes(`${route.operation} = withAuth(\n  withDuplicatePreventionByBody(`) ||
      // Check for the nested pattern used in books route
      (content.includes(`export const ${route.operation} = withAuth(`) && content.includes('withDuplicatePreventionByBody('))
    );
    
    if (hasImport && hasWrappedExport) {
      console.log(`✅ ${route.path}`);
      console.log(`   Operation: ${route.operation} - ${route.description}`);
      
      // Extract configuration details
      const configMatch = content.match(/{\s*([^}]+)\s*}\s*\)\s*$/);
      if (configMatch) {
        const config = configMatch[1];
        console.log(`   Config: {${config.trim()}}`);
      }
      console.log('');
      implementedCount++;
    } else {
      console.log(`❌ ${route.path}`);
      console.log(`   Operation: ${route.operation} - ${route.description}`);
      console.log(`   Issues:`);
      if (!hasImport) console.log(`     - Missing import of withDuplicatePreventionByBody`);
      if (!hasWrappedExport) console.log(`     - ${route.operation} not wrapped with duplicate prevention`);
      console.log('');
      allImplemented = false;
    }
    
  } catch (error) {
    console.log(`❌ Error reading ${route.path}: ${error.message}\n`);
    allImplemented = false;
  }
}

console.log('=' .repeat(60));
console.log(`\n📊 Summary:`);
console.log(`   Total routes checked: ${totalChecked}`);
console.log(`   Implemented: ${implementedCount}`);
console.log(`   Missing: ${totalChecked - implementedCount}`);
console.log(`   Coverage: ${Math.round((implementedCount / totalChecked) * 100)}%`);

if (allImplemented) {
  console.log('\n🎉 All critical routes have duplicate prevention implemented!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some routes are missing duplicate prevention implementation.');
  console.log('   Please review the failed checks above.');
  process.exit(1);
}
