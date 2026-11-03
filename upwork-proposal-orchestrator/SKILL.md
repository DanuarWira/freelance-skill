---
name: upwork-proposal-orchestrator
description: Skill orkestrator Hermes untuk memproses link atau teks lowongan Upwork dari Discord via Hermes Gateway, mengeksekusi 5 peran subagent secara berurutan, mengelola siklus revisi mandiri, dan menyajikan proposal siap kirim beserta kartu skor evaluasi.
---

# Upwork Proposal Multi-Agent Orchestrator (Hermes Gateway Native)

Skill ini dirancang khusus untuk **Hermes Agent** yang telah terhubung ke Discord melalui **Hermes Gateway**. 
Tidak diperlukan skrip bot terpisah atau proses latar belakang (`npm start`) tambahan. Hermes sendiri yang bertindak sebagai agen utama (orchestrator), menerima link lowongan dari user di Discord, mengeksekusi 5 peran subagent secara terstruktur, dan membalas langsung ke channel Discord dengan format proposal siap kirim.

---

## 🏛️ Alur Kerja Orkestrasi di Hermes Gateway

Ketika user mengirimkan pesan berisi link Upwork atau deskripsi pekerjaan di Discord:

```mermaid
flowchart TD
    User["👤 User di Discord"] -->|"Kirim Link/Teks Upwork"| Gateway["⚡ Hermes Gateway"]
    Gateway --> Hermes["🤖 Hermes Agent (Orchestrator)"]
    
    subgraph Execution ["Siklus Internal Multi-Agent"]
        Hermes -->|"1. Ekstraksi Info"| Extractor["📥 Job Extractor"]
        Extractor -->|"2. Analisis Masalah & Kebutuhan"| Sub1["🔍 Subagent 1: Job Analyst"]
        Sub1 -->|"3. Draf Proposal & Hook"| Sub2["✍️ Subagent 2: Proposal Drafter"]
        Sub2 -->|"4. Audit Kepatuhan & Skor"| Sub3["📊 Subagent 3: QA Scorer"]
        Sub3 -->|"5. Review Rekan Sejawat Teknis"| Sub4["👨‍💻 Subagent 4: Domain Professional"]
        Sub4 -->|"6. Uji Impresi Klien"| Sub5["💼 Subagent 5: Client Simulator"]
        
        Sub5 --> ReviewCheck{"Keputusan:<br/>Lolos / Revisi?"}
        ReviewCheck -->|"REJECT / Isu Teknis (Maks 2x)"| LoopRevision["🔄 Internal Feedback Loop"]
        LoopRevision -->|"Umpan Balik Kritik"| Sub1
    end
    
    ReviewCheck -->|"APPROVED / Lolos"| DiscordReply["💬 Balas ke Chat Discord"]
    DiscordReply --> User
```

---

## 🛠️ Langkah Eksekusi Hermes (SOP Mandatori)

Setiap kali Anda (Hermes) mendeteksi pesan yang berisi link Upwork (`https://www.upwork.com/...`) atau teks lowongan pekerjaan:

### Langkah 1: Ekstraksi Konten Lowongan
1. Coba baca informasi lowongan dari pesan.
2. Jika user hanya memberikan URL:
   - Gunakan tool browsing bawaan Hermes (jika tersedia), ATAU
   - Jalankan helper CLI:
     ```bash
     node scripts/extract_job.js "<upwork_url>"
     ```
3. **Penanganan Proteksi Cloudflare**:
   Jika halaman Upwork memblokir akses bot otomatis (Cloudflare Challenge):
   - Jangan berhenti dengan error.
   - Balas ramah ke user di Discord:
     > *"⚠️ **Halaman Upwork terproteksi bot/Cloudflare.** Mohon kirimkan link disertai salinan teks deskripsi pekerjaan (copy-paste) agar bisa langsung dianalisis!"*

---

### Langkah 2: Eksekusi 5 Subagent Secara Berurutan

Hermes menjalankan 5 peran evaluasi berikut secara mendalam menggunakan instruksi prompt modular di folder `prompts/`:

#### 🔍 1. Subagent 1: Job Analyst (`prompts/sub1_job_analyst.md`)
- Identifikasi masalah utama (*core problem*), *pain points* klien, tipe klien (founder non-teknis, tech lead, agency), gaya komunikasi, serta daftar *screening questions*.
- Tentukan domain keahlian proyek (misal: UI/UX Mobile Design, Fullstack Next.js/Node, Cloud DevOps).
- Jika ada putaran revisi sebelumnya, sertakan arahan perbaikan (*revision guidance*).

#### ✍️ 2. Subagent 2: Proposal Drafter (`prompts/sub2_proposal_drafter.md`)
- Tulis proposal dengan **aturan ketat Anti-Slop**:
  - ❌ DILARANG membuka dengan salam klise: *"I hope this finds you well"*, *"I am writing to apply"*, *"Dear Hiring Manager"*.
  - ✅ Baris pertama **WAJIB** langsung menyentuh solusi untuk *core problem* klien (*Immediate Hook*).
  - Tunjukkan bukti nyata (*Show, don't tell*) dengan metrik konkrit dari proyek sebelumnya.
  - Berikan *actionable roadmap* 2–3 langkah kerja konkret.
  - Sediakan jawaban tajam dan to-the-point untuk setiap *screening question*.

#### 📊 3. Subagent 3: QA Scorer (`prompts/sub3_qa_scorer.md`)
- Nilai proposal dengan rubrik 0–100:
  - *Hook & Relevansi* (25%)
  - *Kualitas Solusi* (30%)
  - *Tone & Anti-AI Slop Hygiene* (25%)
  - *Kelengkapan Screening Questions* (20%)
- Syarat lolos: Total skor minimal **75/100**.

#### 👨‍💻 4. Subagent 4: Domain Professional (`prompts/sub4_domain_professional.md`)
- Ambil persona **Praktisi Senior / Lead Specialist** di bidang yang sesuai dengan domain lowongan (contoh: *Senior UI/UX Lead* jika desain mobile, *Senior Backend Architect* jika database/API).
- Audit akurasi terminologi teknis, kelayakan estimasi waktu, serta deteksi janji berlebihan (*over-promising*).
- Tetapkan status: `APPROVED` atau `NEEDS_REVISION`.

#### 💼 5. Subagent 5: Client Simulator (`prompts/sub5_client_simulator.md`)
- Ambil persona **Pemilik Lowongan (Klien Upwork)** yang sibuk dan membaca 50+ proposal per hari.
- Evaluasi reaksi 5 detik pertama membaca hook.
- Berikan keputusan: `INTERESTED` (ingin mengundang interview) atau `REJECT` (arsipkan proposal) beserta alasan spesifik.

---

### Langkah 3: Mekanisme Loop Revisi Mandiri

1. **Kondisi Revisi**:
   - Subagent 4 menetapkan `NEEDS_REVISION` ATAU
   - Subagent 5 memutuskan `REJECT`.
2. **Aturan Perulangan**:
   - Gabungkan catatan kritik dari Subagent 4 dan 5.
   - Ulangi proses: Subagent 1 (re-analisis brief) ➔ Subagent 2 (tulis ulang proposal dengan fokus memperbaiki poin penolakan) ➔ Subagent 3, 4, 5 (audit ulang).
   - **Batas Maksimal**: 2x revisi (total 3 putaran).
   - Jika pada putaran ke-3 masih belum sempurna, lanjutkan ke pengiriman dengan status peringatan (`⚠️ WARNING: Batas Maksimal Revisi Tercapai`).

---

### Langkah 4: Format Balasan Discord (Siap Salin & Kaya Informasi)

Kirimkan balasan akhir ke channel Discord dengan format Markdown rapi berikut:

```markdown
## 📝 PROPOSAL UPWORK: [Judul Pekerjaan]
> **Domain:** [Domain Proyek] | **Budget:** [Budget Job]
> **Status:** [✅ Siap Kirim (Lolos Seluruh Reviewer) / ⚠️ Draf Terbaik] | **Putaran:** [1 / 2 / 3]

---

### 🎯 Hook Pembuka (Baris 1):
> "[Kalimat pembuka yang tajam dan langsung menyasar problem klien]"

### 📄 Cover Letter Siap Kirim (1-Click Copy):
```text
[Teks Cover Letter Lengkap yang ditulis Subagent 2, bebas slop AI]
```

### ❓ Jawaban Screening Questions:
**1. [Pertanyaan Klien 1]**
> [Jawaban langsung dan padat]

**2. [Pertanyaan Klien 2]**
> [Jawaban langsung dan padat]

---

### 📊 Multi-Agent Evaluation Scorecard:
- 📈 **Subagent 3 (QA & Anti-Slop):** `[Skor]/100` (Hook: `x/25`, Solusi: `x/30`, Tone: `x/25`)
- 👨‍💻 **Subagent 4 ([Persona Pakar Teknis]):** Status: `[APPROVED]` — *"[Catatan validasi teknis]"*
- 💼 **Subagent 5 (Klien Upwork):** Keputusan: `[INTERESTED / REJECT]` (`[x]% Hire Probability`) — *"[Impresi pertama klien]"*
```
