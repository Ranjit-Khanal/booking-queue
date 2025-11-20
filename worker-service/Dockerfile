FROM node:18-alpine

WORKDIR /app

# Copy shared types and config
COPY shared /app/shared
COPY tsconfig.base.json /app/tsconfig.base.json

# Copy package files
COPY worker-service/package*.json ./
COPY worker-service/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY worker-service/src ./src

# Build TypeScript
RUN npm run build

CMD ["npm", "start"]
