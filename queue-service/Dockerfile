FROM node:18-alpine

WORKDIR /app

# Build shared package first
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
WORKDIR /app/shared
RUN npm install && npm run build
WORKDIR /app

# Copy root config (relative path for extends)
COPY tsconfig.base.json ./tsconfig.base.json

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
