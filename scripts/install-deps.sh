#!/bin/bash

# Install dependencies for all services

HOMEBANKING_DIR="/Users/cesar.saravia/Projects/python-ms/homebanking"

echo "📦 Installing dependencies for all services..."
echo ""

# API Gateway
echo "📦 Installing API Gateway dependencies..."
cd "$HOMEBANKING_DIR/services/api-gateway"
npm install
echo "✅ API Gateway dependencies installed"
echo ""

# Auth Service
echo "📦 Installing Auth Service dependencies..."
cd "$HOMEBANKING_DIR/services/auth-service"
npm install
echo "✅ Auth Service dependencies installed"
echo ""

# Account Service
echo "📦 Installing Account Service dependencies..."
cd "$HOMEBANKING_DIR/services/account-service"
pip install -r requirements.txt
echo "✅ Account Service dependencies installed"
echo ""

# Transaction Service
echo "📦 Installing Transaction Service dependencies..."
cd "$HOMEBANKING_DIR/services/transaction-service"
mvn clean install -DskipTests
echo "✅ Transaction Service dependencies installed"
echo ""

# Notification Service
echo "📦 Installing Notification Service dependencies..."
cd "$HOMEBANKING_DIR/services/notification-service"
pip install -r requirements.txt
echo "✅ Notification Service dependencies installed"
echo ""

echo "✅ All dependencies installed successfully!"
