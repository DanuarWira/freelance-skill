/**
 * test_pipeline.js - Automated Test for Upwork Multi-Agent Proposal Pipeline
 * Menguji aliran ekstraksi scraper, delegasi Sub 1 -> Sub 2 -> Sub 3 -> Sub 4 -> Sub 5,
 * serta formatting output tanpa memerlukan bot Discord live.
 */

const UpworkScraper = require('./scraper');
const ProposalOrchestrator = require('./orchestrator');
const DiscordFormatter = require('./formatters');

async function runTest() {
  console.log('🧪 Memulai Pengujian Otomatis Pipeline Multi-Agent Upwork...\n');

  const scraper = new UpworkScraper();
  const orchestrator = new ProposalOrchestrator({ isMock: true });

  // 1. Uji Scraper Ekstraksi Teks Lowongan
  console.log('--- Test 1: Ekstraksi Job Parser ---');
  const sampleJobText = `
UI/UX Redesign for Mobile Fintech App (iOS & Android)
Budget: $2,500 Fixed-price
Skills: Figma, UI/UX Design, Mobile App Design, User Flow, Design System

Description:
We are looking for a top-tier UI/UX designer to redesign our cryptocurrency & payment wallet mobile app.
Currently, our onboarding flow is converting poorly with a 45% drop-off at identity verification (KYC).
We need an intuitive, clean, modern design with an interactive Figma prototype ready for our Flutter engineering team.

Screening Questions:
Question 1: Sertakan contoh redesign fintech yang pernah Anda kerjakan!
Question 2: Berapa lama waktu yang Anda butuhkan untuk menghasilkan prototype pertama?
`;

  const extracted = await scraper.extractJob(sampleJobText);
  if (!extracted.success) {
    throw new Error('Gagal mengekstrak job posting!');
  }
  console.log('✅ Ekstraksi job berhasil!');
  console.log(`- Judul: ${extracted.data.title}`);
  console.log(`- Budget: ${extracted.data.budget}`);
  console.log(`- Screening Questions: ${extracted.data.screeningQuestions.length} pertanyaan terdeteksi.\n`);

  // 2. Uji Eksekusi Pipeline Multi-Agent (Ronde 1 Langsung Lolos)
  console.log('--- Test 2A: Pipeline Eksekusi (Direct Approval) ---');
  const pipelineResult = await orchestrator.runPipeline(extracted.data, (progress) => {
    console.log(`  > ${progress.message}`);
  });

  if (!pipelineResult.success || pipelineResult.iterationsRun !== 1) {
    throw new Error('Pipeline Test 2A gagal!');
  }
  console.log(`✅ Test 2A lolos di Iterasi ke-${pipelineResult.iterationsRun} dengan status: ${pipelineResult.status}\n`);

  // 2B. Uji Loop Revisi Mandiri (Simulasi Klien Menolak di Putaran 1 -> Revisi Sukses di Putaran 2)
  console.log('--- Test 2B: Siklus Revisi Mandiri (Subagent 5 Rejects -> Auto Revisi) ---');
  const revisionOrchestrator = new ProposalOrchestrator({ isMock: true, mockRejectFirstRound: true });
  const revisionResult = await revisionOrchestrator.runPipeline(extracted.data, (progress) => {
    console.log(`  > ${progress.message}`);
  });

  if (!revisionResult.success || revisionResult.iterationsRun !== 2) {
    throw new Error('Pipeline Test 2B (Revisi Loop) gagal!');
  }
  console.log(`✅ Test 2B lolos revisi di Iterasi ke-${revisionResult.iterationsRun} dengan status: ${revisionResult.status}\n`);

  // 3. Uji Formatter Markdown & Embed
  console.log('\n--- Test 3: Output Formatting Check ---');
  const plainMarkdown = DiscordFormatter.formatPlainMarkdown(extracted.data, pipelineResult);
  console.log('Output Markdown Pratinjau:\n');
  console.log(plainMarkdown);

  console.log('\n🎉 SELURUH PENGUJIAN OTOMATIS PIPELINE BERHASIL! 100% PASS.');
}

runTest().catch((err) => {
  console.error('❌ Terjadi kesalahan pada test pipeline:', err);
  process.exit(1);
});
