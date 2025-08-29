#!/bin/bash
# Deploy migrations to Supabase
# Run this script to apply all database migrations in the correct order

echo "🚀 Starting Supabase migration deployment..."
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Error: Supabase CLI is not installed${NC}"
    echo "Please install it from: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Function to run a migration
run_migration() {
    local file=$1
    local description=$2
    
    echo -e "${YELLOW}Running: $description${NC}"
    echo "File: $file"
    
    if supabase db push --file "$file"; then
        echo -e "${GREEN}✅ Success: $description${NC}"
        echo ""
    else
        echo -e "${RED}❌ Failed: $description${NC}"
        echo "Please check the error above and fix before continuing"
        exit 1
    fi
}

# Start migrations
echo "📋 Migration Plan:"
echo "1. Migrate existing tables to v2 schema"
echo "2. Create validation functions"
echo "3. Create admin functions (async)"
echo "4. Create safe access functions"
echo "5. Create bulk operations and dashboard"
echo ""

read -p "Continue with migrations? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration cancelled"
    exit 0
fi

echo ""
echo "🔄 Starting migrations..."
echo ""

# Run migrations in order
run_migration "supabase/migrations/100_migrate_existing_to_v2.sql" \
    "Transform existing schema to v2"

run_migration "supabase/migrations/002_create_validation_functions.sql" \
    "Create validation functions"

run_migration "supabase/migrations/009_create_admin_functions_v2.sql" \
    "Create async admin functions"

run_migration "supabase/migrations/011_create_safe_access_functions.sql" \
    "Create safe frontend access functions"

run_migration "supabase/migrations/012_create_bulk_operations.sql" \
    "Create bulk operations and dashboard"

echo ""
echo -e "${GREEN}✅ All migrations completed successfully!${NC}"
echo ""

# Deploy Edge Functions
echo -e "${YELLOW}Deploying Edge Functions...${NC}"

if supabase functions deploy recalculate-layout; then
    echo -e "${GREEN}✅ Edge Functions deployed successfully${NC}"
else
    echo -e "${RED}❌ Edge Function deployment failed${NC}"
    echo "You can try deploying manually with:"
    echo "  supabase functions deploy recalculate-layout"
fi

echo ""
echo "📊 Next Steps:"
echo "1. Run the validation dashboard to check data integrity:"
echo "   SELECT * FROM admin_validation_dashboard();"
echo ""
echo "2. Update the frontend using docs/frontend-update-guide.md"
echo ""
echo "3. Test the application thoroughly"
echo ""
echo -e "${GREEN}🎉 Database migration complete!${NC}"