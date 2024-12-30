# Use the official Deno image as the base image.
FROM denoland/deno:alpine-1.38.5 AS build

# Set the working directory inside the container.
WORKDIR /app

# Copy only the necessary files.
COPY . .

# Compile the project
RUN deno compile --output ./index index.ts

# Start a fresh stage for the final image
FROM denoland/deno:alpine-1.38.5 AS runtime

# Set the working directory inside the container.
WORKDIR /app

# Copy only the necessary file.
COPY --from=build /app/index /app/index

# Expose the port that the application listens on.
EXPOSE 8000

# Define the command to run the application.
CMD ["./index"]
