FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npm run build

RUN npx prisma generate

EXPOSE 10000

CMD [ "node", "dist/index.js" ]