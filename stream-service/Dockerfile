FROM node:18-alpine

WORKDIR /app

# Copy shared types and config
COPY shared /app/shared
COPY tsconfig.base.json /app/tsconfig.base.json

# Copy package files
COPY stream-service/package*.json ./
COPY stream-service/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY stream-service/src ./src

# Build TypeScript
RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]
