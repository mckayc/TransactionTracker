# ---------- Stage 1: Build frontend ----------
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    # Copy only dependency manifests first (better cache usage)
    COPY package*.json ./
    RUN npm ci
    
    # Copy the rest of the source
    COPY . .
    
    # Build-time args (explicitly documented)
    ARG API_KEY
    ARG BUILD_TIME
    
    # Expose build-time values (useful for debugging)
    ENV VITE_API_KEY=$API_KEY
    ENV BUILD_TIME=$BUILD_TIME
    
    # Build frontend
    RUN npm run build
    
    
    # ---------- Stage 2: Runtime ----------
    FROM node:20-alpine
    
    WORKDIR /app
    
    # Install native build deps only once
    RUN apk add --no-cache python3 make g++
    
    # Copy backend dependency manifests
    COPY package*.json ./
    
    # Install production dependencies only
    RUN npm ci --omit=dev && npm cache clean --force
    
    # Copy backend server
    COPY server.js ./
    
    # Copy built frontend assets
    COPY --from=builder /app/dist ./public
    
    # Create volume mount points
    RUN mkdir -p /app/data/config /app/media/files
    
    # Runtime environment (NOT baked into frontend)
    ENV NODE_ENV=production
    ENV TZ=America/Denver
    
    EXPOSE 3000
    
    CMD ["node", "server.js"]
    