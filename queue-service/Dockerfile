FROM node:18-alpine

WORKDIR /app

# Copy shared types and config
COPY shared /app/shared
COPY tsconfig.base.json /app/tsconfig.base.json

# Copy package files
COPY queue-service/package*.json ./
COPY queue-service/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY queue-service/src ./src

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
