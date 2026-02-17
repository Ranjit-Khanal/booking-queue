FROM node:18-alpine

# Build shared package first (optimized for layer caching)
WORKDIR /app/shared

# Copy package files first (for dependency caching)
COPY shared/package*.json ./

# Install dependencies (this layer will be cached if package.json doesn't change)
RUN npm install

# Copy config and source files (after dependencies are installed)
COPY shared/tsconfig.json ./
COPY shared/src ./src

# Build shared package
RUN npm run build

# Switch to app directory for service build
WORKDIR /app

# Copy root config (relative path for extends)
COPY tsconfig.base.json ./tsconfig.base.json

# Copy service package files first (for dependency caching)
COPY worker-service/package*.json ./
COPY worker-service/tsconfig.json ./

# Install service dependencies (this layer will be cached if package.json doesn't change)
RUN npm install

# Copy service source files (after dependencies are installed)
COPY worker-service/src ./src

# Build TypeScript
# RUN npm run build

CMD ["npm", "start"]
