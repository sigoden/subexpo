FROM sigoden/node:native as builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY node_modules/.prisma/client/schema.prisma ./
RUN yarn --production && yarn prisma generate

FROM sigoden/node:slim
ENV NODE_ENV production
WORKDIR /app
COPY --from=builder /app .
COPY .next ./.next
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]