#!/bin/bash

# Test script for booking queue system
# Make sure all services are running before executing

echo "🧪 Testing Distributed Booking Queue System"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Checks
echo -e "${BLUE}1. Testing Health Checks...${NC}"
echo "API Service:"
curl -s http://localhost:3000/health | jq .
echo ""
echo "Queue Service:"
curl -s http://localhost:3001/health | jq .
echo ""
echo "Stream Service:"
curl -s http://localhost:3002/health | jq .
echo ""
echo "Kafka Service:"
curl -s http://localhost:3003/health | jq .
echo ""
echo "Monitoring Service:"
curl -s http://localhost:3004/health | jq .
echo ""

# Test 2: Create Booking
echo -e "${BLUE}2. Creating Booking (publishes to all 3 queues)...${NC}"
RESPONSE=$(curl -s -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-test-123",
    "hotelId": "hotel-test-456",
    "checkIn": "2024-01-15",
    "checkOut": "2024-01-20",
    "guests": 2,
    "roomType": "deluxe"
  }')

echo "$RESPONSE" | jq .

BOOKING_ID=$(echo "$RESPONSE" | jq -r '.bookingId')
echo -e "${GREEN}Booking ID: $BOOKING_ID${NC}"
echo ""

# Test 3: Check Booking Status
if [ "$BOOKING_ID" != "null" ]; then
  echo -e "${BLUE}3. Checking Booking Status...${NC}"
  sleep 2
  curl -s "http://localhost:3000/api/bookings/$BOOKING_ID/status" | jq .
  echo ""
fi

# Test 4: Queue Statistics
echo -e "${BLUE}4. Queue Statistics...${NC}"
echo "BullMQ Stats:"
curl -s http://localhost:3001/stats | jq .
echo ""
echo "Redis Streams Stats:"
curl -s http://localhost:3002/stats | jq .
echo ""
echo "Kafka Stats:"
curl -s http://localhost:3003/stats | jq .
echo ""

# Test 5: Dashboard
echo -e "${BLUE}5. Monitoring Dashboard...${NC}"
curl -s http://localhost:3004/dashboard | jq .
echo ""

# Test 6: Delayed Booking
echo -e "${BLUE}6. Creating Delayed Booking (BullMQ)...${NC}"
curl -s -X POST http://localhost:3000/api/bookings/delayed \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-delayed-123",
    "hotelId": "hotel-delayed-456",
    "checkIn": "2024-01-15",
    "checkOut": "2024-01-20",
    "delaySeconds": 5
  }' | jq .
echo ""

echo -e "${GREEN}✅ Tests completed!${NC}"
echo ""
echo "💡 Tips:"
echo "  - Check worker logs: docker-compose logs worker-service"
echo "  - View dashboard: http://localhost:3004/dashboard"
echo "  - Monitor queues: http://localhost:3001/stats"

