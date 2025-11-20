FROM node:18-alpine

WORKDIR /app

# Copy shared types and config
COPY shared /app/shared
COPY tsconfig.base.json /app/tsconfig.base.json

# Copy package files
COPY kafka-service/package*.json ./
COPY kafka-service/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY kafka-service/src ./src

# Build TypeScript
RUN npm run build

EXPOSE 3003

CMD ["npm", "start"]
