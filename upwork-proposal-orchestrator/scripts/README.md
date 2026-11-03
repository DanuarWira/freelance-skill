# Hermes Upwork Proposal Orchestrator Engine

Mesin orkestrasi multi-agent berbasis Hermes untuk Discord yang secara otomatis menganalisis lowongan Upwork, menyusun proposal berkonversi tinggi, mengaudit kepatuhan, serta memvalidasi kredibilitas teknis dan impresi klien.

---

## 📦 Komponen Script

1. **`index.js`**: Bot Discord listener yang mendengarkan URL Upwork (`https://www.upwork.com/jobs/...`) atau perintah `!proposal [teks]`.
2. **`scraper.js`**: Hybrid extractor (Cheerio fast fetch + Puppeteer headless + fallback parsing teks manual jika terhalang proteksi Cloudflare).
3. **`orchestrator.js`**: Runner multi-agent yang mengorkestrasi Subagent 1 s/d 5 secara sekuensial dan mengelola loop revisi mandiri (maksimal 2x revisi).
4. **`formatters.js`**: Penyusun Rich Discord Embeds dan format markdown siap salin.
5. **`test_pipeline.js`**: Skrip uji mandiri untuk memastikan seluruh logika pipeline berjalan sempurna tanpa memerlukan bot Discord live.

---

## 🛠️ Panduan Instalasi & Penggunaan

### 1. Prasyarat
- Node.js versi 18 ke atas.
- Akun Discord & Bot Token dari [Discord Developer Portal](https://discord.com/developers/applications).
- API Key OpenAI / Hermes endpoint (bisa menggunakan OpenRouter, vLLM, atau OpenAI API).

### 2. Instalasi Dependensi
Buka terminal di folder skrip:
```bash
cd freelance-skill/upwork-proposal-orchestrator/scripts
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Buka `.env` dan isi kredensial Anda:
```env
DISCORD_BOT_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id_here

OPENAI_API_KEY=your_llm_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
HERMES_MODEL=gpt-4o
```

### 4. Uji Mandiri (Offline Pipeline Test)
Sebelum menjalankan bot live, Anda dapat menguji pipeline secara instan dengan mock runner:
```bash
npm run test:pipeline
```

### 5. Menjalankan Bot Discord Live
```bash
npm start
```
Setelah bot online:
- Buka channel Discord tempat bot berada.
- Kirimkan link lowongan Upwork:
  `https://www.upwork.com/jobs/~01abc12345...`
- Bot akan membalas dengan status proses real-time dan menyajikan Rich Embed proposal lengkap setelah dewan reviewer subagent meloloskannya.

---

## 🛡️ Catatan Proteksi Cloudflare Upwork

Upwork secara berkala memperketat sistem proteksi Cloudflare pada halaman lowongan publik. Jika bot mendeteksi adanya challenge captcha atau pemblokiran IP:
- Bot akan secara ramah memberikan instruksi di Discord:
  > *"⚠️ Proteksi Cloudflare Terdeteksi: Bot tidak dapat membaca link Upwork tersebut secara otomatis. Silakan kirimkan kembali dengan menyalin (copy-paste) teks deskripsi pekerjaan di bawah link!"*
- Pengguna cukup menyertakan salinan teks lowongan di pesan Discord yang sama, dan sistem akan langsung memprosesnya secara instan.
