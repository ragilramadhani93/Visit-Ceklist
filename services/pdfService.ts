import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Checklist, ChecklistItem, User } from '../types';

// Extend the jsPDF interface to include autoTable
// FIX: Removed module augmentation for 'jspdf' which was causing a "module not found" error during compilation.
// Calls to the `autoTable` method from the jspdf-autotable plugin are now cast to `any`
// to bypass static type checking. This is consistent with how other plugin properties
// (like `lastAutoTable`) are already accessed in this file.

const getImageAsBase64 = async (url: string): Promise<string | null> => {
    if (!url) return null;
    try {
        // Use a cache-busting query parameter to avoid CORS issues with cached images from Supabase
        const response = await fetch(`${url}?t=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Could not get image as base64 from ${url}:`, error);
        return null; // Return null if fetching fails
    }
};


export const generateAuditReportPDF = async (
    checklist: Checklist,
    auditor: User | null,
    logoUrl: string
): Promise<Blob> => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // --- Header ---
    const logoBase64 = await getImageAsBase64(logoUrl);
    if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', 15, 10, 40, 20);
    }
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Audit Report', 105, 20, { align: 'center' });
    yPos = 40;

    // --- Audit Details ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Audit Details', 15, yPos);
    yPos += 5;

    // FIX: Cast `doc` to `any` to call the `autoTable` method from the plugin.
    (doc as any).autoTable({
        startY: yPos,
        body: [
            ['Checklist Title', checklist.title],
            ['Location', checklist.location],
            ['Auditor', auditor?.name || 'N/A'],
            ['Check-in Time', checklist.check_in_time ? new Date(checklist.check_in_time).toLocaleString() : 'N/A'],
            ['Check-out Time', checklist.check_out_time ? new Date(checklist.check_out_time).toLocaleString() : 'N/A'],
            ['Status', checklist.status],
        ],
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [128, 0, 0] },
        columnStyles: { 0: { fontStyle: 'bold' } },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // --- Checklist Items with Inline Photos ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Checklist Items', 15, yPos);
    yPos += 5;

    // Pre-fetch all item images to be embedded in the table
    const itemImages = await Promise.all(
      checklist.items.map(item =>
        Promise.all((item.photoEvidence || []).map(photoUrl => getImageAsBase64(photoUrl || '')))
      )
    );

    const tableData = checklist.items.map((item, index) => {
        let value = item.value;
        if (item.type === 'yes-no') {
            if (value === 'yes') value = 'Yes';
            if (value === 'no') value = 'No';
            if (value === 'red-flag') value = 'Red Flag';
        }
        // For 'photo' type, value is an array, show count instead.
        if (item.type === 'photo' && Array.isArray(value)) {
            value = `${value.length} photo(s) attached`;
        }
        return [
            index + 1,
            item.question,
            value || 'N/A',
            item.note || '',
            '' // This column is a placeholder; the image will be drawn manually.
        ];
    });

    (doc as any).autoTable({
        startY: yPos,
        head: [['#', 'Question', 'Answer', 'Notes', 'Photos']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [128, 0, 0] },
        columnStyles: {
            4: { cellWidth: 40, minCellHeight: 25 }, // Increased width for multiple photos
        },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
                const imagesForRow = itemImages[data.row.index];
                if (imagesForRow && imagesForRow.length > 0) {
                    const item = checklist.items[data.row.index];
                    const maxImagesToShow = 3;
                    const padding = 1;
                    const availableWidth = data.cell.width - (padding * 2);
                    const imgSize = Math.min(20, (availableWidth - (padding * (maxImagesToShow - 1))) / maxImagesToShow);
                    
                    imagesForRow.slice(0, maxImagesToShow).forEach((imgBase64, imgIndex) => {
                        if (imgBase64) {
                            const x = data.cell.x + padding + (imgIndex * (imgSize + padding));
                            const y = data.cell.y + (data.cell.height - imgSize) / 2;
                            try {
                                doc.addImage(imgBase64, 'JPEG', x, y, imgSize, imgSize);
                                const photoUrl = item.photoEvidence?.[imgIndex];
                                if (photoUrl) {
                                    doc.link(x, y, imgSize, imgSize, { url: photoUrl });
                                }
                            } catch (e) {
                                console.error("Error adding image to PDF table cell:", e);
                            }
                        }
                    });
                }
            }
        },
    });

    yPos = (doc as any).lastAutoTable.finalY;

    // --- Signature ---
    const signatureBase64 = await getImageAsBase64(checklist.auditor_signature || '');
    if (signatureBase64) {
        if (yPos > pageHeight - 60) { // Check if space is sufficient for the signature
            doc.addPage();
            yPos = 20;
        } else {
            yPos += 15;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Auditor Signature', 15, yPos);
        yPos += 5;
        doc.addImage(signatureBase64, 'PNG', 15, yPos, 80, 40);
    }
    
    return doc.output('blob');
};