FROM mcr.microsoft.com/playwright:v1.50.1-noble

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code and assets
COPY . .

# Set default port for cloud web services
ENV PORT=3000
EXPOSE 3000

# Start automation scheduler daemon
CMD ["npm", "start"]
