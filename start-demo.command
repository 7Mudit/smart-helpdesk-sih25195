#!/bin/bash
# Double-click this file to start the Smart Helpdesk demo.
# It installs dependencies and seeds the database on first run.

cd "$(dirname "$0")" || exit 1

echo ""
echo "  Smart Helpdesk — SIH25195 (Ministry of Power)"
echo "  ============================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed."
  echo "  Download it from https://nodejs.org (choose the LTS version), then run this again."
  echo ""
  read -r -p "  Press Enter to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  First run — installing dependencies. This takes a couple of minutes..."
  npm install || { echo "  Install failed."; read -r -p "  Press Enter to close."; exit 1; }
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ ! -f prisma/dev.db ]; then
  echo "  Setting up the database with demo data..."
  npm run setup || { echo "  Setup failed."; read -r -p "  Press Enter to close."; exit 1; }
fi

echo ""
echo "  Starting the app..."
echo "  Open http://localhost:3000 in your browser."
echo ""
echo "  Demo logins (one-click buttons on the login page):"
echo "    Admin     admin@mop.gov.in"
echo "    Agent     agent@mop.gov.in"
echo "    Employee  employee@mop.gov.in"
echo "    Password  password123"
echo ""
echo "  Press Ctrl+C in this window to stop the app."
echo ""

npm run dev
