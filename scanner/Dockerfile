FROM sigoden/node:native as builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY node_modules/.prisma/client/schema.prisma ./
RUN yarn --production && yarn prisma generate

FROM sigoden/node:slim
WORKDIR /app
COPY --from=builder /app .
COPY dist ./dist
CMD ["node", "dist/index.js"]