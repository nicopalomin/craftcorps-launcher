FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/

# Install dependencies
RUN apk add --no-cache openssl
RUN npm install

# Copy source code
COPY . .

# Build (This will trigger switch-provider.js if DATABASE_URL is set, but mostly just compiles TS)
RUN npm run build

# Expose Port
EXPOSE 3000

# Start Command (Wait for DB manually or use wait-for/depends_on)
CMD ["npm", "start"]
