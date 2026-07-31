#!/bin/bash

# Test script to verify WABA accounts endpoint with auth

echo "Testing WABA accounts endpoint..."
echo ""

# Replace YOUR_AUTH_TOKEN with actual user auth token
AUTH_TOKEN="YOUR_AUTH_TOKEN_HERE"

echo "1. Testing OPTIONS (CORS preflight)..."
curl -X OPTIONS "https://urlpt-api.onrender.com/api/auth/whatsapp/multi-tenant/waba-accounts" \
  -H "Origin: https://urlpt.technians.in" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v

echo ""
echo ""
echo "2. Testing GET with auth token..."
curl -X GET "https://urlpt-api.onrender.com/api/auth/whatsapp/multi-tenant/waba-accounts" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H "Origin: https://urlpt.technians.in" \
  -H "Content-Type: application/json" \
  -v

