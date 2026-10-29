import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatToIST } from "../date";
import type { ApplicationDetail } from "../repos/types";
import { getDb } from "../db";

function sanitizePdfText(text?: string | null): string {
  if (!text) return "";
  // Strip characters outside basic printable ASCII (32-126) and newline to avoid WinAnsi crashes
  return text.replace(/[^\x20-\x7E\n]/g, "?");
}

export interface GeneratePdfOptions {
  downloadAttachment?: (storagePath: string) => Promise<Blob | null>;
}

export async function generateApplicationPdf(
  app: ApplicationDetail,
  options?: GeneratePdfOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  const primaryColor = rgb(0.08, 0.12, 0.2); // Slate 900
  const emeraldColor = rgb(0.02, 0.45, 0.25); // Emerald 700
  const grayColor = rgb(0.4, 0.45, 0.5); // Slate 500
  const lightBgColor = rgb(0.97, 0.98, 0.99); // Slate 50
  const borderColor = rgb(0.85, 0.88, 0.92);

  // --- PAGE 1: COVER & APPLICATION SUMMARY ---
  let page = pdfDoc.addPage([595.28, 841.89]); // A4: 595 x 842 points
  const { width, height } = page.getSize();

  // Header banner
  page.drawRectangle({
    x: 40,
    y: height - 90,
    width: width - 80,
    height: 60,
    color: primaryColor,
  });

  page.drawText("SYMBIOSIS INSTITUTE OF TECHNOLOGY (SIT), NAGPUR", {
    x: 55,
    y: height - 55,
    size: 11,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("ApproveIt - Official Paperless Approval Dossier", {
    x: 55,
    y: height - 72,
    size: 10,
    font: helvetica,
    color: rgb(0.8, 0.85, 0.9),
  });

  // Application Title & Status Box
  page.drawRectangle({
    x: 40,
    y: height - 190,
    width: width - 80,
    height: 85,
    color: lightBgColor,
    borderColor: borderColor,
    borderWidth: 1,
  });

  page.drawText("APPLICATION RECORD", {
    x: 55,
    y: height - 125,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });

  const cleanSubject = sanitizePdfText(app.subject);
  page.drawText(cleanSubject.slice(0, 75), {
    x: 55,
    y: height - 145,
    size: 13,
    font: helveticaBold,
    color: primaryColor,
  });

  page.drawText(`Type: ${app.type.toUpperCase()}  |  ID: ${app.id.slice(0, 18)}...`, {
    x: 55,
    y: height - 165,
    size: 9,
    font: courier,
    color: grayColor,
  });

  page.drawText(`Status: APPROVED`, {
    x: 55,
    y: height - 180,
    size: 10,
    font: helveticaBold,
    color: emeraldColor,
  });

  // Student Identity Snapshot Box
  page.drawRectangle({
    x: 40,
    y: height - 310,
    width: width - 80,
    height: 105,
    color: lightBgColor,
    borderColor: borderColor,
    borderWidth: 1,
  });

  page.drawText("APPLICANT IDENTITY SNAPSHOT (FROZEN AT SUBMISSION)", {
    x: 55,
    y: height - 225,
    size: 9,
    font: helveticaBold,
    color: grayColor,
  });

  const snap = app.applicant_snapshot;
  page.drawText(`Student Name: ${sanitizePdfText(snap.name)}`, {
    x: 55,
    y: height - 245,
    size: 10,
    font: helveticaBold,
    color: primaryColor,
  });

  page.drawText(`PRN / Roll No: ${snap.login_id}`, {
    x: 55,
    y: height - 262,
    size: 10,
    font: helvetica,
    color: primaryColor,
  });

  page.drawText(`Department & Batch: ${snap.department || "CSE"} (${snap.batch || "2024-28"})`, {
    x: 55,
    y: height - 279,
    size: 10,
    font: helvetica,
    color: primaryColor,
  });

  page.drawText(`Semester & Section: Semester ${snap.semester || 1} - Sec ${snap.section || "A"}`, {
    x: 55,
    y: height - 296,
    size: 10,
    font: helvetica,
    color: primaryColor,
  });

  // Timeline / Stamps Section Header
  page.drawText("MULTI-STEP VERIFICATION & STAMP RECORD", {
    x: 40,
    y: height - 340,
    size: 10,
    font: helveticaBold,
    color: primaryColor,
  });

  let currentY = height - 365;

  for (const step of app.steps) {
    if (currentY < 120) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = height - 60;
    }

    const isApprovedOrForwarded =
      step.decision === "approved" || step.decision === "forwarded";

    const boxHeight = step.verification_id ? 72 : 45;

    page.drawRectangle({
      x: 40,
      y: currentY - boxHeight,
      width: width - 80,
      height: boxHeight,
      color: lightBgColor,
      borderColor: isApprovedOrForwarded ? emeraldColor : borderColor,
      borderWidth: 1,
    });

    const stepTitle = `[Step ${step.step_index + 1}] ${step.step_key.toUpperCase()} - Decision: ${step.decision.toUpperCase()}`;
    page.drawText(stepTitle, {
      x: 55,
      y: currentY - 18,
      size: 9.5,
      font: helveticaBold,
      color: isApprovedOrForwarded ? emeraldColor : primaryColor,
    });

    page.drawText(`Actor: ${step.actor_login_id}  |  Date: ${formatToIST(step.at)}`, {
      x: 55,
      y: currentY - 32,
      size: 8.5,
      font: helvetica,
      color: grayColor,
    });

    if (step.comment) {
      page.drawText(`Remark: "${sanitizePdfText(step.comment).slice(0, 80)}"`, {
        x: 55,
        y: currentY - 45,
        size: 8.5,
        font: helvetica,
        color: primaryColor,
      });
    }

    if (step.verification_id) {
      page.drawText(`Digital Verification Stamp ID: ${step.verification_id}`, {
        x: 55,
        y: currentY - 60,
        size: 8.5,
        font: courier,
        color: emeraldColor,
      });
    }

    currentY -= boxHeight + 12;
  }

  // --- ATTACHMENTS MERGING ---
  if (app.attachments && app.attachments.length > 0) {
    let attIdx = 1;

    for (const att of app.attachments) {
      try {
        let fileData: Blob | null = null;

        if (options?.downloadAttachment) {
          fileData = await options.downloadAttachment(att.storage_path);
        } else {
          const db = getDb();
          const { data, error: downloadErr } = await db.storage
            .from("attachments")
            .download(att.storage_path);
          if (!downloadErr && data) {
            fileData = data;
          }
        }

        if (!fileData) {
          // Add placeholder page for missing/corrupt attachment
          const attPage = pdfDoc.addPage([595.28, 841.89]);
          attPage.drawText(`Attachment ${attIdx}: ${sanitizePdfText(att.original_name)}`, {
            x: 40,
            y: height - 50,
            size: 11,
            font: helveticaBold,
            color: primaryColor,
          });
          attPage.drawText("Error: Attachment file could not be retrieved from storage.", {
            x: 40,
            y: height - 80,
            size: 10,
            font: helvetica,
            color: rgb(0.8, 0.1, 0.1),
          });
          attIdx++;
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        if (att.mime === "application/pdf") {
          try {
            const externalDoc = await PDFDocument.load(bytes);
            const copiedPages = await pdfDoc.copyPages(
              externalDoc,
              externalDoc.getPageIndices()
            );

            for (let i = 0; i < copiedPages.length; i++) {
              const p = pdfDoc.addPage(copiedPages[i]);
              p.drawText(`Attachment ${attIdx}: ${sanitizePdfText(att.original_name)} (Page ${i + 1}/${copiedPages.length})`, {
                x: 30,
                y: p.getHeight() - 20,
                size: 8,
                font: helvetica,
                color: grayColor,
              });
            }
          } catch {
            const attPage = pdfDoc.addPage([595.28, 841.89]);
            attPage.drawText(`Attachment ${attIdx}: ${sanitizePdfText(att.original_name)}`, {
              x: 40,
              y: height - 50,
              size: 11,
              font: helveticaBold,
              color: primaryColor,
            });
            attPage.drawText("Note: PDF attachment contains unsupported format or compression; raw file preserved.", {
              x: 40,
              y: height - 80,
              size: 10,
              font: helvetica,
              color: grayColor,
            });
          }
        } else if (att.mime.startsWith("image/")) {
          try {
            const image =
              att.mime === "image/png"
                ? await pdfDoc.embedPng(bytes)
                : await pdfDoc.embedJpg(bytes);

            const imgPage = pdfDoc.addPage([595.28, 841.89]);
            imgPage.drawText(`Attachment ${attIdx}: ${sanitizePdfText(att.original_name)}`, {
              x: 40,
              y: height - 40,
              size: 11,
              font: helveticaBold,
              color: primaryColor,
            });

            // Scale image proportionally within 515 x 720 box
            const maxW = 515;
            const maxH = 720;
            const imgDims = image.scaleToFit(maxW, maxH);

            imgPage.drawImage(image, {
              x: 40 + (maxW - imgDims.width) / 2,
              y: 50 + (maxH - imgDims.height) / 2,
              width: imgDims.width,
              height: imgDims.height,
            });
          } catch {
            const attPage = pdfDoc.addPage([595.28, 841.89]);
            attPage.drawText(`Attachment ${attIdx}: ${sanitizePdfText(att.original_name)}`, {
              x: 40,
              y: height - 50,
              size: 11,
              font: helveticaBold,
              color: primaryColor,
            });
            attPage.drawText("Image attachment could not be decoded.", {
              x: 40,
              y: height - 80,
              size: 10,
              font: helvetica,
              color: grayColor,
            });
          }
        }

        attIdx++;
      } catch (err: unknown) {
        console.error("Error processing attachment in PDF:", err);
      }
    }
  }

  // --- COMPULSORY FOOTER ON EVERY SINGLE PAGE ---
  const allPages = pdfDoc.getPages();
  const totalPages = allPages.length;

  for (let i = 0; i < totalPages; i++) {
    const p = allPages[i];
    const footerText =
      "Internal electronic record. Not a legal digital signature.";
    const pageNumText = `Page ${i + 1} of ${totalPages}`;

    p.drawText(footerText, {
      x: 40,
      y: 18,
      size: 8,
      font: helvetica,
      color: grayColor,
    });

    p.drawText(pageNumText, {
      x: p.getWidth() - 95,
      y: 18,
      size: 8,
      font: helvetica,
      color: grayColor,
    });
  }

  return await pdfDoc.save();
}
