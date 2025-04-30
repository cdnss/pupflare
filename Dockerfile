# Menggunakan image Deno terbaru
FROM denoland/deno:latest

# Mengatur direktori kerja di dalam container
WORKDIR /app

# Menyalin script aplikasi Deno ke dalam direktori kerja
COPY index.ts .

# --- Menambahkan langkah instalasi Puppeteer ---
# Perintah ini akan mengunduh executable browser (Chromium)
# yang dibutuhkan Puppeteer saat image dibangun.
# PUPPETEER_PRODUCT=chrome memberi preferensi/konfigurasi untuk produk 'chrome'.
# -A memberikan semua izin (diperlukan untuk download dan instalasi).
# --unstable diperlukan untuk beberapa API Deno yang digunakan oleh script instalasi.
# Menggunakan versi Puppeteer yang sama dengan yang digunakan di script Anda.
RUN PUPPETEER_PRODUCT=chrome deno run -A --unstable-* https://deno.land/x/puppeteer@16.2.0/install.ts
# -----------------------------------------------

# Mengekspos port yang digunakan oleh aplikasi (jika aplikasi mendengarkan di port 8080)
EXPOSE 8080

# Perintah yang dijalankan saat container dimulai
# -A memberikan semua izin ke script index.ts (sesuai dengan CMD asli Anda)
CMD ["deno", "run", "-A", "index.ts"]
