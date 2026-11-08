FROM node:22-alpine
WORKDIR /app
COPY package.json LICENSE ./
COPY src ./src
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
CMD ["node", "src/server/cli.js"]
