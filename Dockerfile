# ---------- Stage 1: Build frontend ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    # Copy dependency manifests
    COPY package*.json ./
    
    # Install deps (no lockfile present)
    RUN npm install
    
    # Copy rest of source
    COPY . .
    
    # Build-time metadata (non-secret)
    ARG BUILD_TIME
    ENV BUILD_TIME=$BUILD_TIME
    
    # Build frontend
    RUN npm run build
    
    
    # ---------- Stage 2: Runtime ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    # Native build deps for better-sqlite3
    RUN apk add --no-cache python3 make g++
    
    # Copy backend manifests
    COPY package*.json ./
    
    # Install production deps only
    RUN npm install --omit=dev && npm cache clean --force
    
    # Copy backend server
    COPY server.js ./
    
    # Copy built frontend
    COPY --from=builder /app/dist ./public
    
    # Create volume mount points
    RUN mkdir -p /app/data/config /app/media/files
    
    ENV NODE_ENV=production
    ENV TZ=America/Denver
    
    EXPOSE 3000
    
    CMD ["node", "server.js"]
    