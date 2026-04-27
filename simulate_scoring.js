
/**
 * Simulasi Perhitungan Skor Checklist
 * Sesuai dengan logika di ChecklistView.tsx dan pdfService.ts
 */

const simulateScoring = () => {
    // 1. Mock Data Checklist
    const mockChecklist = {
        title: "Audit Kebersihan Outlet",
        scoring_enabled: true,
        items: [
            {
                id: "1",
                question: "Apakah area depan bersih?",
                type: "yes-no",
                category: "Eksterior",
                weight: 1,
                scoring_enabled: true,
                value: "yes",
                score: 3 // Excellent
            },
            {
                id: "2",
                question: "Kondisi tempat sampah",
                type: "text",
                category: "Eksterior",
                weight: 2,
                scoring_enabled: true,
                value: "Sedikit penuh",
                score: 1 // Fair
            },
            {
                id: "3",
                question: "Kerapihan seragam staf",
                type: "yes-no",
                category: "Personalia",
                weight: 1.5,
                scoring_enabled: true,
                value: "yes",
                score: 2 // Good
            },
            {
                id: "4",
                question: "Catatan tambahan (Tanpa Skor)",
                type: "text",
                category: "Lain-lain",
                weight: 1,
                scoring_enabled: false, // Item ini tidak dihitung skornya
                value: "Semua aman",
                score: 0
            }
        ]
    };

    console.log(`=== Simulasi Perhitungan: ${mockChecklist.title} ===\n`);

    let totalScore = 0;
    let maxScore = 0;
    const categoryScores = {};

    // 2. Logika Perhitungan (Sama dengan di aplikasi)
    mockChecklist.items.forEach(item => {
        const cat = item.category || 'Uncategorized';
        if (!categoryScores[cat]) categoryScores[cat] = { total: 0, max: 0 };

        if (item.scoring_enabled || (typeof item.score === 'number' && item.score > 0)) {
            const weight = item.weight || 1;
            const score = typeof item.score === 'number' ? item.score : 0;
            
            const itemPoints = score * weight;
            const itemMaxPoints = 3 * weight;

            totalScore += itemPoints;
            maxScore += itemMaxPoints;

            categoryScores[cat].total += itemPoints;
            categoryScores[cat].max += itemMaxPoints;

            console.log(`Item: ${item.question}`);
            console.log(`  - Kategori: ${cat}`);
            console.log(`  - Skor: ${score} / 3`);
            console.log(`  - Bobot: ${weight}`);
            console.log(`  - Hasil: ${score} * ${weight} = ${itemPoints}`);
            console.log(`  - Max: 3 * ${weight} = ${itemMaxPoints}\n`);
        } else {
            console.log(`Item: ${item.question} (Scoring Disabled - Dilewati)\n`);
        }
    });

    const scorePercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

    // 3. Output Hasil Akhir
    console.log("=== Ringkasan Kategori ===");
    Object.entries(categoryScores).forEach(([cat, scores]) => {
        if (scores.max > 0) {
            const catPercent = Math.round((scores.total / scores.max) * 100);
            console.log(`${cat}: ${scores.total} / ${scores.max} (${catPercent}%)`);
        }
    });

    console.log("\n=== Hasil Akhir ===");
    console.log(`Total Skor: ${totalScore}`);
    console.log(`Skor Maksimal: ${maxScore}`);
    console.log(`Persentase Total: ${scorePercentage}%`);
};

simulateScoring();
