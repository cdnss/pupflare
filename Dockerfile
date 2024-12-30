FROM denoland/deno:latest

EXPOSE 8000
COPY . .
CMD ["deno", "run", "--allow-all", "index.ts"]
