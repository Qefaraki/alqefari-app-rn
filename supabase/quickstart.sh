#!/bin/bash

echo "🚀 Alqefari Family Tree - Supabase Backend Setup"
echo "================================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null
then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
else
    echo "✅ Supabase CLI is installed"
fi

echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Initialize Supabase in this project:"
echo "   supabase init"
echo ""
echo "2. Link to your existing Supabase project:"
echo "   supabase link --project-ref ezkioroyhzpavmbfavyn"
echo "   (Password: FwxS5z3MseYqRy2Q)"
echo ""
echo "3. Push database migrations:"
echo "   supabase db push"
echo ""
echo "4. Start local development:"
echo "   supabase start"
echo ""
echo "5. Open Supabase Studio:"
echo "   supabase dashboard"
echo ""
echo "📚 Documentation:"
echo "   - Backend Implementation Guide: docs/backend-implementation.md"
echo "   - Setup Instructions: supabase/setup.md"
echo ""
echo "🔐 Security Reminder:"
echo "   - Never commit .env files"
echo "   - Keep service role keys secret"
echo ""