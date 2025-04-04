FROM denoland/deno:latest
WORKDIR /app

COPY index.ts .
 
EXPOSE 8000

CMD ["deno", "run", "-A", "index.ts"]
