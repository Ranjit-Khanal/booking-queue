FROM node:18-alpine

WORKDIR /app

# Copy shared types and config
COPY shared /app/shared
COPY tsconfig.base.json /app/tsconfig.base.json

# Copy package files
COPY monitoring-service/package*.json ./
COPY monitoring-service/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY monitoring-service/src ./src

# Build TypeScript
RUN npm run build

EXPOSE 3004

CMD ["npm", "start"]
