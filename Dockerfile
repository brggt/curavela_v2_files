FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 CURAVELA_DATA_DIR=/var/lib/curavela
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /var/lib/curavela && chown node:node /var/lib/curavela
USER node
EXPOSE 3000
VOLUME ["/var/lib/curavela"]
CMD ["node", "server/start.js"]
