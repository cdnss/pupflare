# Gunakan image resmi Deno sebagai image dasar
FROM denoland/deno:latest

# Set direktori kerja di dalam container
WORKDIR /app

# Salin skrip Deno proxy ke direktori kerja di dalam container
# Pastikan file proxy.ts ada di direktori yang sama dengan Dockerfile saat Anda membangun image
COPY index.ts /app/

# Beri tahu Docker bahwa container akan mendengarkan di port 8000 (port yang sama dengan di skrip Anda)
# Ini hanya metadata dan tidak secara otomatis mempublikasikan port
EXPOSE 8080

# Tentukan perintah yang akan dijalankan saat container dimulai
# Ini menjalankan skrip proxy.ts menggunakan deno run dengan izin jaringan
CMD ["deno", "run", "-A", "index.ts"]

# Jika Anda perlu izin lingkungan (misalnya untuk membaca port dari variabel env), gunakan:
# CMD ["deno", "run", "--allow-net", "--allow-env", "proxy.ts"]
# Tapi untuk skrip yang diberikan, --allow-net saja sudah cukup.
