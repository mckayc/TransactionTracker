# Stage 1: Build the frontend application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG API_KEY
ENV API_KEY=$API_KEY
RUN npm run build
# Stage 2: Setup the backend server
FROM node:20-alpine
WORKDIR /app
# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js .
COPY --from=builder /app/dist ./public
RUN mkdir -p /app/data/config
EXPOSE 3000
CMD ["node", "server.js"]
