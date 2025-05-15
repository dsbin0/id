# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock) files
COPY package*.json ./
COPY prisma ./prisma/

# Install app dependencies
# If you have a package-lock.json, using `npm ci` is recommended for reproducible builds
RUN npm install

# Bundle app source
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Expose the port the app runs on
EXPOSE 10000

# Define the command to run your app
CMD [ "node", "dist/index.js" ]

# Add build command for typescript if not already in package.json scripts
# This Dockerfile assumes you have a build script in your package.json that compiles TypeScript to JavaScript in a /dist folder.
# If not, you would add a RUN tsc command here, after installing typescript globally or as a dev dependency.
# For example, if your tsconfig.json outputs to ./dist:
# RUN npm install -g typescript
# RUN tsc

