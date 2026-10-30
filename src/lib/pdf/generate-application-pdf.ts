import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { formatToIST, formatDatesInText } from "../date";
import type { ApplicationDetail } from "../repos/types";
import { getDb } from "../db";

function sanitizePdfText(text?: string | null): string {
  if (!text) return "";
  // Strip characters outside basic printable ASCII (32-126) and newline to avoid WinAnsi crashes
  return text.replace(/[^\x20-\x7E\n]/g, "?");
}

export interface GeneratePdfOptions {
  downloadAttachment?: (storagePath: string) => Promise<Blob | null>;
  downloadSignature?: (storagePath: string) => Promise<Blob | null>;
  actorNames?: Record<string, string>;
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

  const cleanSubject = sanitizePdfText(formatDatesInText(app.subject));
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

  // Fetch actor names if not supplied
  const actorNames: Record<string, string> = { ...options?.actorNames };
  try {
    const db = getDb();
    const allActorIds = Array.from(
      new Set([
        ...app.steps.map((s) => s.actor_login_id),
        app.applicant_login_id,
      ])
    );
    const missingActorIds = allActorIds.filter((id) => !actorNames[id]);
    if (missingActorIds.length > 0) {
      const { data: people } = await db
        .from("people")
        .select("login_id, name")
        .in("login_id", missingActorIds);
      for (const p of people || []) {
        actorNames[p.login_id] = p.name;
      }
    }
  } catch {
    // Graceful fallback for offline / unit test mock contexts
  }

  const roleKeyToName: Record<string, string> = {
    admin_staff: "Administration Staff",
    hackathon_incharge: "Hackathon Incharge",
    class_teacher: "Class Teacher",
    hod: "Head of Department (HOD)",
    director: "Director",
    account_officer: "Accounts Officer",
  };

  let currentY = height - 365;

  for (const step of app.steps) {
    const isSubmission = step.decision === "submitted";
    const isApprovedOrForwarded =
      step.decision === "approved" || step.decision === "forwarded";

    // Designation & Actor Name
    const stepConfig = app.chain_snapshot ? app.chain_snapshot[step.step_index] : null;
    const designation =
      stepConfig?.label ||
      roleKeyToName[step.step_key] ||
      step.step_key.replace(/_/g, " ").toUpperCase();

    const actorName =
      actorNames[step.actor_login_id] ||
      (isSubmission ? app.applicant_snapshot?.name : null) ||
      step.actor_login_id;

    // Check and download signature image if present
    let embeddedSig: any = null;
    if (step.signature_path) {
      try {
        let sigData: Blob | null = null;
        if (options?.downloadSignature) {
          sigData = await options.downloadSignature(step.signature_path);
        } else {
          const db = getDb();
          const { data, error } = await db.storage
            .from("signatures")
            .download(step.signature_path);
          if (!error && data) {
            sigData = data;
          }
        }
        if (sigData) {
          const buffer = await sigData.arrayBuffer();
          const sigBytes = new Uint8Array(buffer);
          try {
            if (step.signature_path.toLowerCase().endsWith(".png")) {
              embeddedSig = await pdfDoc.embedPng(sigBytes);
            } else {
              embeddedSig = await pdfDoc.embedJpg(sigBytes);
            }
          } catch {
            try {
              embeddedSig = await pdfDoc.embedPng(sigBytes);
            } catch {
              try {
                embeddedSig = await pdfDoc.embedJpg(sigBytes);
              } catch {
                embeddedSig = null;
              }
            }
          }
        }
      } catch (err) {
        console.error("Could not load signature for step:", err);
      }
    }

    // Determine box height
    let boxHeight = 50;
    if (isSubmission) {
      boxHeight = step.comment ? 58 : 46;
    } else {
      if (embeddedSig) {
        boxHeight = 78;
      } else if (step.verification_id && step.comment) {
        boxHeight = 70;
      } else if (step.verification_id || step.comment) {
        boxHeight = 58;
      }
    }

    if (currentY - boxHeight < 60) {
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = height - 60;
    }

    page.drawRectangle({
      x: 40,
      y: currentY - boxHeight,
      width: width - 80,
      height: boxHeight,
      color: lightBgColor,
      borderColor: isSubmission
        ? rgb(0.7, 0.75, 0.82)
        : isApprovedOrForwarded
        ? emeraldColor
        : borderColor,
      borderWidth: 1,
    });

    if (isSubmission) {
      page.drawText("APPLICATION SUBMISSION (APPLICANT)", {
        x: 55,
        y: currentY - 17,
        size: 9.5,
        font: helveticaBold,
        color: primaryColor,
      });

      page.drawText(
        `Submitted by: ${sanitizePdfText(actorName)} (${step.actor_login_id})  |  Date: ${formatToIST(step.at)}`,
        {
          x: 55,
          y: currentY - 31,
          size: 8.5,
          font: helvetica,
          color: grayColor,
        }
      );

      if (step.comment) {
        page.drawText(
          `Applicant Note: "${sanitizePdfText(step.comment).slice(0, 95)}"`,
          {
            x: 55,
            y: currentY - 45,
            size: 8.5,
            font: helvetica,
            color: primaryColor,
          }
        );
      }
    } else {
      const decisionDisplay =
        step.decision === "forwarded" ? "FORWARDED" : step.decision.toUpperCase();
      const stepTitle = `[Step ${step.step_index + 1}] ${designation} - ${decisionDisplay}`;

      page.drawText(stepTitle, {
        x: 55,
        y: currentY - 17,
        size: 9.5,
        font: helveticaBold,
        color: isApprovedOrForwarded ? emeraldColor : primaryColor,
      });

      page.drawText(
        `Verified by: ${sanitizePdfText(actorName)} (${step.actor_login_id})  |  Date: ${formatToIST(step.at)}`,
        {
          x: 55,
          y: currentY - 31,
          size: 8.5,
          font: helvetica,
          color: grayColor,
        }
      );

      let nextY = currentY - 45;
      if (step.comment) {
        const maxLen = embeddedSig ? 55 : 85;
        page.drawText(`Remark: "${sanitizePdfText(step.comment).slice(0, maxLen)}"`, {
          x: 55,
          y: nextY,
          size: 8.5,
          font: helvetica,
          color: primaryColor,
        });
        nextY -= 14;
      }

      if (step.verification_id) {
        page.drawText(`Digital Stamp ID: ${step.verification_id}`, {
          x: 55,
          y: nextY,
          size: 8.5,
          font: courier,
          color: emeraldColor,
        });
      }

      if (embeddedSig) {
        const sigBoxW = 100;
        const sigBoxH = 38;
        const sigDims = embeddedSig.scaleToFit(sigBoxW, sigBoxH);

        page.drawImage(embeddedSig, {
          x: width - 40 - 15 - sigDims.width,
          y: currentY - boxHeight + 18 + (sigBoxH - sigDims.height) / 2,
          width: sigDims.width,
          height: sigDims.height,
        });

        page.drawText("Faculty Signature", {
          x: width - 40 - 15 - sigBoxW / 2 - 25,
          y: currentY - boxHeight + 8,
          size: 7,
          font: helveticaBold,
          color: grayColor,
        });
      }
    }

    currentY -= boxHeight + 10;
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
