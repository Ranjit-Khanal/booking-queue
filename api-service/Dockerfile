FROM node:18-alpine

WORKDIR /app

# Copy shared types and config
COPY shared /app/shared
COPY tsconfig.base.json /app/tsconfig.base.json

# Copy package files
COPY api-service/package*.json ./
COPY api-service/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY api-service/src ./src

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
