import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Checklist, User, Task, TaskPriority } from '../types';

// Extend the jsPDF interface to include autoTable
// FIX: Removed module augmentation for 'jspdf' which was causing a "module not found" error during compilation.
// Calls to the `autoTable` method from the jspdf-autotable plugin are now cast to `any`
// to bypass static type checking. This is consistent with how other plugin properties
// (like `lastAutoTable`) are already accessed in this file.

const getImageAsDataURI = async (source: string, mimeType: string = 'image/jpeg'): Promise<string | null> => {
    if (!source) return null;
    if (!source.startsWith('http') && source.length > 200) {
        return `data:${mimeType};base64,${source}`;
    }
    try {
        const response = await fetch(`${source}?t=${new Date().getTime()}`);
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
        console.error(`Could not get image as data URI from ${source}:`, error);
        return null;
    }
};


export const generateAuditReportPDF = async (
    checklist: Checklist,
    auditor: User | null,
    logoUrl: string,
    imageOverrides?: Record<string, string>
): Promise<Blob> => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // --- Header ---
    const logoDataURI = await getImageAsDataURI(logoUrl);
    if (logoDataURI) {
        doc.addImage(logoDataURI, 'JPEG', 15, 10, 40, 20);
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
      checklist.items.map(async item => {
        if (item.evidenceType === 'video') {
            if (imageOverrides && imageOverrides[item.id]) {
                const uri = await getImageAsDataURI(imageOverrides[item.id]);
                return uri ? [uri] : [];
            }
            return [];
        }
        return Promise.all((item.photoEvidence || []).map(photoSrc => getImageAsDataURI(photoSrc || '', 'image/jpeg')));
      })
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
        if (item.evidenceType === 'video' && Array.isArray(item.photoEvidence)) {
             value = `${item.photoEvidence.length} video(s) attached`;
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
        head: [['#', 'Question', 'Answer', 'Notes', 'Photos/Videos']],
        body: tableData,
        theme: 'striped',
        styles: { fontSize: 9, cellPadding: 2, valign: 'middle' },
        headStyles: { fillColor: [128, 0, 0] },
        columnStyles: {
            4: { cellWidth: 60, minCellHeight: 50 }, // Increased width for larger photos
        },
        didDrawCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 4) {
                // Ensure we are on the correct page for adding links
                if (doc.internal.getCurrentPageInfo().pageNumber !== data.pageNumber) {
                    doc.setPage(data.pageNumber);
                }

                const item = checklist.items[data.row.index];
                
                if (item.evidenceType === 'video') {
                     const count = item.photoEvidence?.length || 0;
                     if (count > 0) {
                         // Draw a video thumbnail placeholder (Gray box with Play icon)
                         const thumbnailHeight = 30; 
                         const thumbnailWidth = 45; 
                         
                         // Center the thumbnail
                         const x = data.cell.x + (data.cell.width - thumbnailWidth) / 2;
                         const y = data.cell.y + (data.cell.height - thumbnailHeight) / 2;

                         // Check for override image
                         const overrideImage = itemImages[data.row.index]?.[0];

                         if (overrideImage) {
                             try {
                                doc.addImage(overrideImage, 'JPEG', x, y, thumbnailWidth, thumbnailHeight);
                             } catch (e) {
                                console.error("Error adding video thumbnail override:", e);
                                // Fallback to gray box
                                doc.setFillColor(60, 60, 60); 
                                doc.roundedRect(x, y, thumbnailWidth, thumbnailHeight, 2, 2, 'F');
                             }
                         } else {
                             // Draw Thumbnail Background (Dark Gray)
                             doc.setFillColor(60, 60, 60); 
                             doc.roundedRect(x, y, thumbnailWidth, thumbnailHeight, 2, 2, 'F');
                         }
                         
                         // Draw Play Icon (White Triangle)
                         doc.setFillColor(255, 255, 255);
                         const triX = x + (thumbnailWidth / 2) - 3;
                         const triY = y + (thumbnailHeight / 2) - 4;
                         doc.triangle(triX, triY, triX, triY + 8, triX + 7, triY + 4, 'F');
                         
                         const firstUrl = item.photoEvidence?.[0];
                         if (firstUrl && firstUrl.startsWith('http')) {
                             // Link covering the thumbnail
                             doc.link(x, y, thumbnailWidth, thumbnailHeight, { url: firstUrl });

                             // Add explicit "Open Video" text link below
                             doc.setTextColor(0, 0, 255);
                             doc.setFontSize(8);
                             const text = "Open Video";
                             const textWidth = doc.getTextWidth(text);
                             const textX = x + (thumbnailWidth - textWidth) / 2;
                             const textY = y + thumbnailHeight + 4;
                             doc.text(text, textX, textY);
                             doc.link(textX, textY - 3, textWidth, 4, { url: firstUrl });
                         }
                     }
                     return;
                }

                const imagesForRow = itemImages[data.row.index];
                if (imagesForRow && imagesForRow.length > 0) {
                    const maxImagesToShow = 2; // Reduced to 2 to make them larger
                    const padding = 2;
                    const availableWidth = data.cell.width - (padding * 2);
                    const imgSize = Math.min(45, (availableWidth - (padding * (maxImagesToShow - 1))) / maxImagesToShow);
                    
                    imagesForRow.slice(0, maxImagesToShow).forEach((imgDataUri, imgIndex) => {
                        if (imgDataUri) {
                            const x = data.cell.x + padding + (imgIndex * (imgSize + padding));
                            const y = data.cell.y + (data.cell.height - imgSize) / 2;
                            try {
                                doc.addImage(imgDataUri, 'JPEG', x, y, imgSize, imgSize);
                                const photoUrl = item.photoEvidence?.[imgIndex];
                                if (photoUrl && photoUrl.startsWith('http')) {
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
    const signatureDataURI = await getImageAsDataURI(checklist.auditor_signature || '', 'image/png');
    if (signatureDataURI) {
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
        doc.addImage(signatureDataURI, 'PNG', 15, yPos, 80, 40);
        yPos += 50;
    }

    const selfieDataURI = await getImageAsDataURI(checklist.auditor_selfie || '', 'image/jpeg');
    if (selfieDataURI) {
        if (yPos > pageHeight - 80) {
            doc.addPage();
            yPos = 20;
        } else {
            yPos += 15;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Auditor Selfie', 15, yPos);
        yPos += 5;
        doc.addImage(selfieDataURI, 'JPEG', 15, yPos, 60, 60);
    }
    
    return doc.output('blob');
};

export const generateFindingsReportPDF = async (
  findings: Task[],
  checklists: Checklist[],
  users: User[],
  reportTitle: string
): Promise<Blob> => {
  const doc = new jsPDF();
  let yPos = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle || 'Findings Report', 105, yPos, { align: 'center' });
  yPos += 12;

  const checklistMap = new Map<string, Checklist>(checklists.map(c => [c.id, c]));
  const userMap = new Map<string, User>(users.map(u => [u.id, u]));

  const toResolvedDate = (proofUrl?: string | null) => {
    if (!proofUrl) return '';
    const match = /proofs\/(?:[^_]+)_([0-9]+)\.jpg/.exec(proofUrl);
    if (match && match[1]) {
      const ts = Number(match[1]);
      if (!Number.isNaN(ts)) return new Date(ts).toISOString().split('T')[0];
    }
    return '';
  };

  const images = await Promise.all(
    findings.map(f => Promise.all([
      getImageAsDataURI(f.photo || '', 'image/jpeg'),
      getImageAsDataURI(f.proof_of_fix || '', 'image/jpeg')
    ]))
  );

  const body = findings.map(f => {
    const checklist = f.checklist_id ? checklistMap.get(f.checklist_id) : undefined;
    const location = checklist?.location || '';
    const auditTitle = checklist?.title || '';
    const assignee = f.assigned_to ? userMap.get(f.assigned_to)?.name || '' : '';
    const status = f.status || '';
    const priority = f.priority || '' as unknown as TaskPriority;
    const due = f.due_date || '';
    const resolved = status === 'resolved' ? toResolvedDate(f.proof_of_fix) : '';
    const created = f.created_at ? new Date(f.created_at).toISOString().split('T')[0] : '';
    return [f.title, location, auditTitle, String(priority), status, due, resolved, assignee, created, '', ''];
  });

  (doc as any).autoTable({
    startY: yPos,
    head: [['Title', 'Location', 'Audit', 'Priority', 'Status', 'Due', 'Resolved', 'Assignee', 'Created', 'Evidence', 'Proof of Fix']],
    body,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [128, 0, 0] },
    didDrawCell: (data: any) => {
      if (data.section === 'body' && (data.column.index === 9 || data.column.index === 10)) {
        const rowIdx = data.row.index;
        const colIdx = data.column.index;
        const imgDataUri = colIdx === 9 ? images[rowIdx]?.[0] : images[rowIdx]?.[1];
        if (imgDataUri) {
          const padding = 2;
          const availableWidth = data.cell.width - (padding * 2);
          const availableHeight = data.cell.height - (padding * 2);
          const size = Math.min(24, availableWidth, availableHeight);
          const x = data.cell.x + (data.cell.width - size) / 2;
          const y = data.cell.y + (data.cell.height - size) / 2;
          try {
            doc.addImage(imgDataUri, 'JPEG', x, y, size, size);
            const f = findings[rowIdx];
            const url = colIdx === 9 ? f.photo : f.proof_of_fix;
            if (url && url.startsWith('http')) {
              doc.link(x, y, size, size, { url });
            }
          } catch {}
        }
      }
    }
  });

  return doc.output('blob');
};
