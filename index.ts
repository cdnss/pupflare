// script_render_and_serve_v16.ts
// Menggunakan import default untuk Puppeteer versi 16.2.0 sesuai saran user
import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts';
import { serve } from 'https://deno.land/std@0.224.0/http/mod.ts'; // Menggunakan modul serve dari std

// URL target Anda
const targetUrl = 'https://cloud.hownetwork.xyz/video.php?id=Lh09YywNWiYqPgQ4bgJmanBVPisnHRseGg5OfSIAb2p1TQ';

// Port untuk server HTTP lokal
const serverPort = 8080;

let renderedHtmlContent: string | null = null;

async function fetchAndRenderPage() {
  console.log(`[Puppeteer] Membuka browser dan menavigasi ke ${targetUrl}...`);

  // Penting: Puppeteer di Deno memerlukan executable Chrome/Chromium.
  // Pastikan Anda memilikinya atau jalankan Deno dengan flag --allow-run.
  // Mode headless: true disarankan untuk server.

  // Menggunakan puppeteer.launch() karena import default 'puppeteer'
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Navigasi ke URL
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    console.log('[Puppeteer] Halaman awal dimuat.');

    // Menunggu hingga elemen iframe muncul.
    console.log('[Puppeteer] Menunggu elemen iframe muncul...');
    const iframeSelector = 'iframe';
    // Gunakan page.waitForSelector melalui objek page yang didapat dari browser
    await page.waitForSelector(iframeSelector, { timeout: 60000 }); // Tunggu hingga 60 detik
    console.log(`[Puppeteer] Elemen iframe (${iframeSelector}) ditemukan atau timeout tercapai.`);

    // Beri sedikit waktu tambahan untuk rendering
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('[Puppeteer] Menunggu 3 detik tambahan.');

    // Mengambil konten HTML dari halaman
    // Gunakan page.content() melalui objek page
    renderedHtmlContent = await page.content();
    console.log('[Puppeteer] Konten HTML halaman berhasil diambil.');

  } catch (error) {
    console.error(`[Puppeteer] Terjadi kesalahan saat mengambil halaman atau menunggu iframe: ${error}`);
    renderedHtmlContent = `
      <h1>Error rendering page</h1>
      <p>Terjadi kesalahan saat Puppeteer mengambil konten atau menunggu iframe:</p>
      <p>${error.message}</p>
      <p>Pastikan Anda memiliki Chrome/Chromium terinstal dan Deno dijalankan dengan --allow-run, --allow-net, --allow-read.</p>
      <p>Anda juga mungkin perlu menjalankan instalasi Puppeteer untuk versi ini: PUPPETEER_PRODUCT=chrome deno run -A --unstable https://deno.land/x/puppeteer@16.2.0/install.ts</p>
    `;
  } finally {
    if (browser) {
        // Menggunakan browser.close() melalui objek browser
        await browser.close();
        console.log('[Puppeteer] Browser ditutup.');
    }
  }
}

// Fungsi handler untuk server HTTP
async function handler(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  if (pathname === '/' && renderedHtmlContent !== null) {
    return new Response(renderedHtmlContent, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  } else if (pathname === '/' && renderedHtmlContent === null) {
     return new Response("Konten halaman sedang diambil oleh Puppeteer. Silakan coba refresh sebentar lagi.", {
       status: 202, // Accepted
       headers: {
         'content-type': 'text/plain; charset=utf-8',
       });
  }
  else {
    return new Response('Halaman tidak ditemukan', { status: 404 });
  }
}

// Jalankan fungsi fetch dan render, lalu mulai server
async function main() {
  await fetchAndRenderPage();

  if (renderedHtmlContent !== null) {
     console.log(`[Server] Konten siap disajikan.`);
  } else {
     console.log(`[Server] Konten tidak berhasil diambil oleh Puppeteer.`);
  }

  console.log(`[Server] Server berjalan di http://localhost:${serverPort}/`);
  console.log(`Akses URL di browser Anda untuk melihat hasilnya.`);
  await serve(handler, { port: serverPort });
}

main();
