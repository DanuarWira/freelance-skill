/**
 * orchestrator.js - Multi-Agent Proposal Pipeline Engine
 * Mengorkestrasi Subagent 1 -> Subagent 2 -> Subagent 3 -> Subagent 4 -> Subagent 5
 * beserta loop revisi mandiri.
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

class ProposalOrchestrator {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || 'dummy-key';
    this.baseURL = config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = config.model || process.env.HERMES_MODEL || 'gpt-4o';
    this.maxRevisions = config.maxRevisions || parseInt(process.env.MAX_REVISION_CYCLES || '2', 10);
    this.isMock = Boolean(config.isMock);
    this.mockRejectFirstRound = Boolean(config.mockRejectFirstRound);

    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseURL
    });

    this.promptsDir = path.resolve(__dirname, '../prompts');
    this.loadSystemPrompts();
  }

  loadSystemPrompts() {
    this.prompts = {
      sub1: this.readPromptFile('sub1_job_analyst.md'),
      sub2: this.readPromptFile('sub2_proposal_drafter.md'),
      sub3: this.readPromptFile('sub3_qa_scorer.md'),
      sub4: this.readPromptFile('sub4_domain_professional.md'),
      sub5: this.readPromptFile('sub5_client_simulator.md')
    };
  }

  readPromptFile(filename) {
    const fullPath = path.join(this.promptsDir, filename);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
    return '';
  }

  /**
   * Helper pemanggilan LLM dengan parsing JSON otomatis
   */
  async callAgent(systemPrompt, userPrompt, temperature = 0.4) {
    if (this.isMock) {
      return this.generateMockResponse(systemPrompt, userPrompt);
    }

    const response = await this.openai.chat.completions.create({
      model: this.model,
      temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.choices[0].message.content;
    try {
      return JSON.parse(content);
    } catch {
      // Fallback pembersihan tag markdown jika ada
      const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    }
  }

  /**
   * Mock response generator untuk automated pipeline test
   */
  generateMockResponse(systemPrompt, userPrompt) {
    if (systemPrompt.includes('Job Analyst System Prompt')) {
      return {
        domain: 'UI/UX Mobile App Design',
        coreProblem: 'Aplikasi fintech klien mengalami churn rate tinggi saat onboarding pengguna baru karena antarmuka terlalu rumit.',
        clientType: 'Fintech Founder',
        clientTone: 'Direct and results-oriented',
        trapPhrase: null,
        keyRequirements: ['Figma prototype', 'Redesign onboarding flow', 'Design system tokenization'],
        painPoints: ['Drop-off rate 45% di step verifikasi KYC', 'Inkonsistensi komponen mobile'],
        winningAngle: 'Fokus pada penyederhanaan langkah KYC menjadi 3 tap tanpa mengorbankan kepatuhan regulasi.',
        screeningQuestions: [
          {
            question: 'Sertakan contoh redesign fintech yang pernah Anda kerjakan!',
            keyPointToAddress: 'Tunjukkan studi kasus metrik konversi naik dari 55% ke 82%.'
          }
        ],
        revisionGuidance: null
      };
    }

    if (systemPrompt.includes('Proposal Drafter System Prompt')) {
      return {
        hook: 'Melihat 45% pengguna drop-off pada tahap verifikasi KYC aplikasi fintech Anda, solusinya bukan sekadar mempercantik visual, melainkan memecah formulir menjadi progressive disclosure 3 langkah dengan feedback mikro instan.',
        coverLetter: 'Melihat 45% pengguna drop-off pada tahap verifikasi KYC aplikasi fintech Anda, solusinya bukan sekadar mempercantik visual, melainkan memecah formulir menjadi progressive disclosure 3 langkah dengan feedback mikro instan.\n\nPada proyek redesign aplikasi pembayaran digital sebelumnya, pendekatan ini berhasil memangkas waktu pengisian dokumen sebesar 60% dan melipatgandakan tingkat aktivasi akun dari 55% ke 84% dalam 30 hari pertama.\n\nRencana eksekusi 2 minggu pertama:\n1. Audit heuristik & mapping bottleneck pada screen registrasi & KYC saat ini.\n2. Rancang interactive Figma prototype high-fidelity dengan token design system yang siap di-handoff ke developer mobile.\n3. Uji usability singkat pada 5 pengguna untuk memastikan tidak ada friction tersisa.\n\nSeluruh komponen akan dibangun dengan Auto Layout Figma dan siap ekspor ke React Native / Flutter.\n\nApakah Anda ada waktu luang 10 menit besok untuk quick call via Upwork Messages guna melihat teardown kilat alur KYC ini?',
        screeningAnswers: [
          {
            question: 'Sertakan contoh redesign fintech yang pernah Anda kerjakan!',
            answer: 'Saya mendesain ulang flow onboarding PayEase (SaaS Fintech), menghasilkan penurunan drop-off rate sebesar 32% dan rating app store naik dari 3.4 ke 4.7.'
          }
        ],
        estimatedTimeline: '2-3 minggu',
        proposedMilestones: [
          { name: 'Milestone 1: Heuristic Audit & Wireframing', duration: '5 hari', deliverable: 'Audit UX & Figma Wireframe' },
          { name: 'Milestone 2: High-Fi Prototype & Handoff', duration: '9 hari', deliverable: 'Figma Tokenized UI & Developer Guide' }
        ]
      };
    }

    if (systemPrompt.includes('QA & Scorer System Prompt')) {
      return {
        totalScore: 92,
        parameterScores: {
          hookAndRelevance: 24,
          solutionQuality: 28,
          antiSlopHygiene: 24,
          completeness: 16
        },
        strengths: [
          'Hook baris pertama langsung merujuk pada drop-off KYC tanpa basa-basi.',
          'Bebas dari kata klise AI generik.',
          'Pemberian milestone kerja sangat terukur.'
        ],
        weaknesses: ['CTA bisa dibuat lebih spesifik pada zona waktu klien.'],
        slopPhrasesDetected: [],
        recommendations: 'Pertahankan hook tajam ini.',
        isQAPassed: true
      };
    }

    if (systemPrompt.includes('Domain Professional System Prompt')) {
      return {
        assumedPersona: 'Senior UI/UX & Product Design Lead',
        technicalStatus: 'APPROVED',
        technicalScore: 90,
        technicalStrengths: [
          'Penggunaan pendekatan progressive disclosure pada KYC sangat tepat secara psikologi kognitif.',
          'Penyebutan auto-layout Figma dan developer handoff membuktikan kedalaman teknis praktisi.'
        ],
        technicalRedFlags: [],
        expertAdvice: 'Pastikan menyertakan pertimbangan kepatuhan regulasi data privasi (GDPR / ISO) pada tahap handoff.'
      };
    }

    if (systemPrompt.includes('Client Simulator System Prompt')) {
      if (this.mockRejectFirstRound && !this._mockHasRejectedOnce) {
        this._mockHasRejectedOnce = true;
        return {
          clientDecision: 'REJECT',
          clientFirstImpression: 'Penjelasan awal masih agak mengambang, belum membuktikan solusi teknis KYC secara gamblang.',
          reasonsForDecision: ['Kurang tajam pada metrik konversi KYC'],
          likelihoodToHirePercentage: 40,
          clientFeedbackForImprovement: 'Tolong berikan studi kasus spesifik pemangkasan step registrasi dan sertakan durasi milestone yang pasti.'
        };
      }

      return {
        clientDecision: 'INTERESTED',
        clientFirstImpression: 'Langsung paham masalah drop-off KYC saya, bukan proposal template sampah.',
        reasonsForDecision: [
          'Menawarkan angka dan bukti konkret dari proyek sebelumnya.',
          'Tidak membuang waktu saya dengan pengenalan diri yang panjang.'
        ],
        likelihoodToHirePercentage: 92,
        clientFeedbackForImprovement: 'Sudah sangat memikat untuk diundang chat interview.'
      };
    }

    return {};
  }

  /**
   * Menjalankan seluruh sekuens orkestrator dari Sub 1 s/d Sub 5 dengan loop revisi
   */
  async runPipeline(jobData, progressCallback = () => {}) {
    let currentIteration = 1;
    let revisionFeedback = null;
    const history = [];

    const jobContextStr = `
=== DETAIL LOWONGAN UPWORK ===
Judul: ${jobData.title}
Budget/Rate: ${jobData.budget || 'Not specified'}
Keahlian Diminta: ${(jobData.skills || []).join(', ') || 'N/A'}
Deskripsi:
${jobData.description}

Pertanyaan Penyaring (Screening Questions):
${(jobData.screeningQuestions || []).map((q, i) => `${i + 1}. ${q}`).join('\n') || 'Tidak ada'}
==============================
`;

    while (currentIteration <= this.maxRevisions + 1) {
      const isRevision = currentIteration > 1;
      progressCallback({
        stage: 'iteration_start',
        iteration: currentIteration,
        isRevision,
        message: isRevision 
          ? `🔄 Memulai Siklus Revisi #${currentIteration - 1}...` 
          : '🚀 Memulai Analisis Multi-Agent...'
      });

      // --- SUBAGENT 1: Job Analyst ---
      progressCallback({ stage: 'sub1', message: '🔍 Subagent 1 (Job Analyst) sedang membedah kebutuhan & celah job...' });
      const sub1Prompt = isRevision
        ? `${jobContextStr}\n\nCATATAN KRITIK UNTUK REVISI DARI PUTARAN SEBELUMNYA:\n${JSON.stringify(revisionFeedback, null, 2)}`
        : jobContextStr;
      const sub1Result = await this.callAgent(this.prompts.sub1, sub1Prompt);

      // --- SUBAGENT 2: Proposal Drafter ---
      progressCallback({ stage: 'sub2', message: '✍️ Subagent 2 (Proposal Drafter) sedang menulis proposal berkonversi tinggi...' });
      const sub2Prompt = `
Berikut data pekerjaan dan hasil analisis intelijen dari Subagent 1:
${JSON.stringify(sub1Result, null, 2)}

Teks asli lowongan:
${jobContextStr}
`;
      const sub2Result = await this.callAgent(this.prompts.sub2, sub2Prompt);

      // --- SUBAGENT 3: QA & Scorer ---
      progressCallback({ stage: 'sub3', message: '📊 Subagent 3 (QA Scorer) sedang mengaudit kepatuhan & skor anti-slop...' });
      const sub3Prompt = `
Evaluasi draf proposal berikut terhadap kriteria lowongan:
DRAF PROPOSAL:
${JSON.stringify(sub2Result, null, 2)}

INTELLIGENCE BRIEF:
${JSON.stringify(sub1Result, null, 2)}

DATA ASLI JOB:
${jobContextStr}
`;
      const sub3Result = await this.callAgent(this.prompts.sub3, sub3Prompt);

      // --- SUBAGENT 4: Domain Professional ---
      progressCallback({ stage: 'sub4', message: `👨‍💻 Subagent 4 (Domain Expert: ${sub1Result.domain}) sedang memvalidasi kelayakan teknis...` });
      const sub4Prompt = `
Domain Pekerjaan: ${sub1Result.domain}
Evaluasi draf proposal ini dari kacamata praktisi senior:
PROPOSAL:
${JSON.stringify(sub2Result, null, 2)}

JOB DETAILS:
${jobContextStr}
`;
      const sub4Result = await this.callAgent(this.prompts.sub4, sub4Prompt);

      // --- SUBAGENT 5: Client Simulator ---
      progressCallback({ stage: 'sub5', message: '💼 Subagent 5 (Client Simulator) sedang membaca proposal dari kacamata pemberi kerja...' });
      const sub5Prompt = `
Anda adalah klien yang memposting lowongan ini:
${jobContextStr}

Apakah Anda tertarik mengundang freelancer ini berdasarkan proposal berikut?
PROPOSAL:
${JSON.stringify(sub2Result, null, 2)}
`;
      const sub5Result = await this.callAgent(this.prompts.sub5, sub5Prompt);

      // Simpan riwayat ronde ini
      const roundRecord = {
        iteration: currentIteration,
        sub1: sub1Result,
        sub2: sub2Result,
        sub3: sub3Result,
        sub4: sub4Result,
        sub5: sub5Result
      };
      history.push(roundRecord);

      // Cek Kondisi Kelulusan
      const isTechApproved = sub4Result.technicalStatus === 'APPROVED';
      const isClientInterested = sub5Result.clientDecision === 'INTERESTED';
      const isQAPassed = sub3Result.isQAPassed !== false && (sub3Result.totalScore >= 75);

      if (isTechApproved && isClientInterested && isQAPassed) {
        progressCallback({
          stage: 'pipeline_passed',
          iteration: currentIteration,
          message: '✅ Proposal lolos verifikasi seluruh subagent!'
        });

        return {
          success: true,
          status: 'APPROVED',
          iterationsRun: currentIteration,
          finalProposal: sub2Result,
          scorecard: {
            qaScore: sub3Result.totalScore,
            techScore: sub4Result.technicalScore,
            clientLikelihood: sub5Result.likelihoodToHirePercentage
          },
          subagents: {
            analyst: sub1Result,
            drafter: sub2Result,
            qa: sub3Result,
            domainExpert: sub4Result,
            clientSimulator: sub5Result
          },
          history
        };
      }

      // Jika belum lolos dan masih ada sisa kuota revisi
      if (currentIteration <= this.maxRevisions) {
        revisionFeedback = {
          failedIteration: currentIteration,
          techFeedback: {
            status: sub4Result.technicalStatus,
            redFlags: sub4Result.technicalRedFlags,
            expertAdvice: sub4Result.expertAdvice
          },
          clientFeedback: {
            decision: sub5Result.clientDecision,
            firstImpression: sub5Result.clientFirstImpression,
            rejectionReasons: sub5Result.reasonsForDecision,
            improvementAdvice: sub5Result.clientFeedbackForImprovement
          },
          qaFeedback: {
            score: sub3Result.totalScore,
            weaknesses: sub3Result.weaknesses
          }
        };

        progressCallback({
          stage: 'revision_triggered',
          iteration: currentIteration,
          message: `⚠️ Proposal butuh perbaikan: ${sub5Result.clientDecision === 'REJECT' ? 'Klien menolak' : 'Kritik teknis'}. Memulai revisi...`
        });

        currentIteration++;
      } else {
        // Kuota revisi habis, kembalikan versi terbaik dengan status peringatan
        progressCallback({
          stage: 'pipeline_max_revisions',
          iteration: currentIteration,
          message: '⚠️ Batas maksimal revisi tercapai. Menyajikan draf terbaik dengan catatan evaluasi.'
        });

        return {
          success: true,
          status: 'WARNING_MAX_REVISIONS',
          iterationsRun: currentIteration,
          finalProposal: sub2Result,
          scorecard: {
            qaScore: sub3Result.totalScore,
            techScore: sub4Result.technicalScore,
            clientLikelihood: sub5Result.likelihoodToHirePercentage
          },
          subagents: {
            analyst: sub1Result,
            drafter: sub2Result,
            qa: sub3Result,
            domainExpert: sub4Result,
            clientSimulator: sub5Result
          },
          history,
          unresolvedCritiques: revisionFeedback
        };
      }
    }
  }
}

module.exports = ProposalOrchestrator;
