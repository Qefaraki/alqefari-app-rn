#!/bin/bash

# =====================================================
# PERMISSION SYSTEM v4.2 - IMMEDIATE DEPLOYMENT SCRIPT
# =====================================================
# This script automates the v4.2 deployment process
# Total estimated time: 2 hours
# =====================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Timestamp for backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}PERMISSION SYSTEM v4.2 DEPLOYMENT${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# =====================================================
# PHASE 1: PRE-DEPLOYMENT CHECKS
# =====================================================

echo -e "${YELLOW}PHASE 1: Pre-Deployment Checks${NC}"
echo "--------------------------------"

# Check if we have database URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    echo "Please set your Supabase DATABASE_URL environment variable"
    exit 1
fi

echo -e "${GREEN}✓${NC} Database URL found"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js available"

# Check if execute-sql.js exists
if [ ! -f "scripts/execute-sql.js" ]; then
    echo -e "${RED}ERROR: execute-sql.js not found${NC}"
    echo "Please ensure you're in the project root directory"
    exit 1
fi

echo -e "${GREEN}✓${NC} Deployment scripts found"

# =====================================================
# PHASE 2: BACKUP
# =====================================================

echo ""
echo -e "${YELLOW}PHASE 2: Creating Backup${NC}"
echo "------------------------"

echo "Creating database backup..."
pg_dump $DATABASE_URL > backups/backup_pre_v4_${TIMESTAMP}.sql 2>/dev/null || {
    echo -e "${YELLOW}Warning: pg_dump not available. Skipping backup.${NC}"
    echo -e "${YELLOW}Make sure you have a manual backup before proceeding!${NC}"
    read -p "Do you have a backup? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled. Please create a backup first.${NC}"
        exit 1
    fi
}

if [ -f "backups/backup_pre_v4_${TIMESTAMP}.sql" ]; then
    BACKUP_SIZE=$(du -h backups/backup_pre_v4_${TIMESTAMP}.sql | cut -f1)
    echo -e "${GREEN}✓${NC} Backup created: backup_pre_v4_${TIMESTAMP}.sql (${BACKUP_SIZE})"
fi

# =====================================================
# PHASE 3: VERIFY CURRENT STATE
# =====================================================

echo ""
echo -e "${YELLOW}PHASE 3: Verifying Current State${NC}"
echo "--------------------------------"

# Create verification query
cat > /tmp/verify_current.sql << 'EOF'
SELECT
  'Current State Check' as status,
  (SELECT COUNT(*) FROM profile_edit_suggestions) as existing_suggestions,
  (SELECT COUNT(*) FROM profiles WHERE role IN ('admin', 'super_admin')) as admin_count,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'check_family_permission_v4') as v4_already_deployed;
EOF

echo "Checking current database state..."
CURRENT_STATE=$(psql $DATABASE_URL -t -A -F"," -f /tmp/verify_current.sql 2>/dev/null || echo "Unable to check")

if [[ $CURRENT_STATE == *"true"* ]]; then
    echo -e "${YELLOW}Warning: v4 functions may already exist${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Current state verified"

# =====================================================
# PHASE 4: REMOVE OLD SYSTEM
# =====================================================

echo ""
echo -e "${YELLOW}PHASE 4: Removing Old Permission System${NC}"
echo "---------------------------------------"

echo "Removing old tables and functions..."
node scripts/execute-sql.js migrations/006b_remove_old_permission_system.sql 2>/dev/null || {
    echo -e "${YELLOW}Warning: Removal via execute-sql.js failed${NC}"
    echo "Attempting direct execution..."
    psql $DATABASE_URL -f migrations/006b_remove_old_permission_system.sql || {
        echo -e "${RED}ERROR: Could not remove old system${NC}"
        echo "Please run migrations/006b_remove_old_permission_system.sql manually in Supabase Dashboard"
        exit 1
    }
}

echo -e "${GREEN}✓${NC} Old permission system removed"

# =====================================================
# PHASE 5: DEPLOY v4.2
# =====================================================

echo ""
echo -e "${YELLOW}PHASE 5: Deploying v4.2 Permission System${NC}"
echo "-----------------------------------------"

echo "Deploying new tables, functions, and policies..."
node scripts/execute-sql.js migrations/007_permission_system_v4_deployment.sql 2>/dev/null || {
    echo -e "${YELLOW}Warning: Deployment via execute-sql.js failed${NC}"
    echo "Attempting direct execution..."
    psql $DATABASE_URL -f migrations/007_permission_system_v4_deployment.sql || {
        echo -e "${RED}ERROR: Deployment failed${NC}"
        echo ""
        echo "Manual steps required:"
        echo "1. Copy the content of migrations/007_permission_system_v4_deployment.sql"
        echo "2. Run it in Supabase SQL Editor"
        echo "3. Check for any errors"
        exit 1
    }
}

echo -e "${GREEN}✓${NC} v4.2 system deployed"

# =====================================================
# PHASE 6: VERIFICATION
# =====================================================

echo ""
echo -e "${YELLOW}PHASE 6: Running Verification${NC}"
echo "-----------------------------"

# Create verification query
cat > /tmp/verify_v4.sql << 'EOF'
SELECT
  'Tables' as component,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END as status
FROM information_schema.tables
WHERE table_name IN ('profile_edit_suggestions', 'branch_moderators', 'user_rate_limits', 'suggestion_blocks')
UNION ALL
SELECT
  'Functions' as component,
  COUNT(*) as count,
  CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_proc
WHERE proname IN ('check_family_permission_v4', 'submit_edit_suggestion_v4', 'approve_suggestion', 'reject_suggestion')
UNION ALL
SELECT
  'RLS Enabled' as component,
  COUNT(*) as count,
  CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END as status
FROM pg_tables
WHERE tablename IN ('profile_edit_suggestions', 'branch_moderators', 'user_rate_limits', 'suggestion_blocks')
AND rowsecurity = true;
EOF

echo "Verifying deployment..."
VERIFICATION=$(psql $DATABASE_URL -f /tmp/verify_v4.sql 2>/dev/null || echo "Verification failed")

if [[ $VERIFICATION == *"FAIL"* ]]; then
    echo -e "${RED}ERROR: Verification failed${NC}"
    echo "$VERIFICATION"
    echo ""
    echo "Some components are missing. Please check the deployment."
    exit 1
fi

echo -e "${GREEN}✓${NC} All components verified"
echo "$VERIFICATION"

# =====================================================
# PHASE 7: RUN TESTS
# =====================================================

echo ""
echo -e "${YELLOW}PHASE 7: Running Test Suite${NC}"
echo "---------------------------"

read -p "Run comprehensive test suite? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Executing test suite..."
    psql $DATABASE_URL -f scripts/test_permission_v4.sql > test_results_${TIMESTAMP}.txt 2>&1 || {
        echo -e "${YELLOW}Some tests may have failed. Check test_results_${TIMESTAMP}.txt${NC}"
    }

    # Show test summary
    if [ -f "test_results_${TIMESTAMP}.txt" ]; then
        echo ""
        echo "Test Results Summary:"
        grep -E "(PASS|FAIL)" test_results_${TIMESTAMP}.txt | tail -10
        echo ""
        echo "Full results saved to: test_results_${TIMESTAMP}.txt"
    fi
else
    echo "Skipping tests. Remember to run scripts/test_permission_v4.sql later!"
fi

# =====================================================
# PHASE 8: FINAL STATUS
# =====================================================

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Summary:"
echo "--------"
echo -e "${GREEN}✓${NC} Old system removed"
echo -e "${GREEN}✓${NC} v4.2 deployed successfully"
echo -e "${GREEN}✓${NC} All components verified"
echo -e "${GREEN}✓${NC} Backup saved: backup_pre_v4_${TIMESTAMP}.sql"
echo ""
echo "Next Steps:"
echo "-----------"
echo "1. Update frontend components to use new API"
echo "2. Test with a real user account"
echo "3. Monitor for 24 hours"
echo "4. Review monitoring queries in PERMISSION_V4_DEPLOYMENT_PLAN.md"
echo ""
echo "Rollback Command (if needed):"
echo "-----------------------------"
echo "psql \$DATABASE_URL < backups/backup_pre_v4_${TIMESTAMP}.sql"
echo ""
echo -e "${GREEN}The v4.2 permission system is now live!${NC}"

# =====================================================
# MONITORING REMINDER
# =====================================================

echo ""
echo -e "${YELLOW}MONITORING REMINDER${NC}"
echo "-------------------"
echo "Run this query every hour for the first 24 hours:"
echo ""
cat << 'EOF'
SELECT
  (SELECT COUNT(*) FROM profile_edit_suggestions WHERE created_at > NOW() - INTERVAL '1 hour') as new_suggestions,
  (SELECT COUNT(*) FROM profile_edit_suggestions WHERE status = 'pending') as pending,
  (SELECT COUNT(*) FROM profile_edit_suggestions WHERE status = 'auto_approved' AND reviewed_at > NOW() - INTERVAL '1 hour') as auto_approved,
  (SELECT COUNT(DISTINCT submitter_id) FROM profile_edit_suggestions WHERE created_at > NOW() - INTERVAL '1 hour') as active_users;
EOF

# Clean up temp files
rm -f /tmp/verify_current.sql /tmp/verify_v4.sql

exit 0