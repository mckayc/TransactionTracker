# Stage 1: Build the React frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (needed for the build process)
RUN npm install

# Copy the entire source code into the builder
COPY . .
# Run the build script (Vite creates the /dist folder)
RUN npm run build

# Stage 2: Final Production Runtime
FROM node:20-alpine

WORKDIR /app

# Install native build tools required for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files for production dependency install
COPY package*.json ./
# Install only production dependencies (no dev dependencies)
RUN npm install --omit=dev && npm cache clean --force

# Copy the backend server file
COPY server.js ./

# FIX: Copy built files from the builder to 'dist' (matches server.js path)
COPY --from=builder /app/dist ./dist

# Create persistent storage locations for SQLite and Documents
RUN mkdir -p /app/data/config /app/media/files

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]