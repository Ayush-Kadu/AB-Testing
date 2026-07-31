#!/bin/bash

# Test script for WABA Accounts endpoints
# Usage: ./TEST_WABA_ENDPOINTS.sh

TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2Q5MDkyY2ExZjgwYTJjOGZhOGEzZTIiLCJpYXQiOjE3NjU5NTQ1OTh9.RvlImJXHGprQ5q032XlGInpntlCEM2kMzB7ENTdEMN8"
BASE_URL="https://urlpt-api.onrender.com/api/auth/whatsapp/multi-tenant/waba-accounts"

echo "🧪 Testing WABA Accounts Endpoints"
echo "=================================="
echo ""

echo "1️⃣ Testing Health Endpoint (No Auth Required)..."
echo "---------------------------------------------------"
curl -X GET "${BASE_URL}/health" \
  -H "Content-Type: application/json" \
  -H "Origin: https://urlpt.technians.in" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""

echo "2️⃣ Testing Auth Test Endpoint (Auth Required)..."
echo "---------------------------------------------------"
curl -X GET "${BASE_URL}/test" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Origin: https://urlpt.technians.in" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""

echo "3️⃣ Testing Main WABA Accounts Endpoint (Auth + Meta API)..."
echo "---------------------------------------------------"
curl -X GET "${BASE_URL}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Origin: https://urlpt.technians.in" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "Response received"
echo ""

echo "✅ Testing complete!"

