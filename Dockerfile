# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first for layer caching
COPY package*.json ./

# Install all dependencies (--ignore-scripts prevents the "prepare" hook
# from running before source files are available)
RUN npm ci --ignore-scripts

# Copy source and config
COPY tsconfig.json ./
COPY src/ ./src/

# Now build explicitly
RUN npx tsc && npx shx chmod +x dist/*.js

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Expose the MCP server port (default 8007)
EXPOSE 8007

# Run the server
CMD ["node", "dist/index.js"]
