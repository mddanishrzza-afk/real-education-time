// ============================================================
// Certificate PDF generation using jsPDF
// Produces a professional certificate with branding, borders,
// score, date, certificate id and a signature line.
// ============================================================
import { jsPDF } from 'jspdf'
import { formatDate } from '../utils/helpers'

export async function generateCertificatePDF({
  studentName,
  quizName,
  score,
  percentage,
  grade,
  certId,
  date = new Date(),
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297
  const H = 210

  // Background
  doc.setFillColor(247, 250, 255)
  doc.rect(0, 0, W, H, 'F')

  // Outer decorative border
  doc.setDrawColor(16, 71, 118)
  doc.setLineWidth(1.2)
  doc.rect(6, 6, W - 12, H - 12)

  // Inner border
  doc.setDrawColor(38, 120, 199)
  doc.setLineWidth(0.5)
  doc.rect(10, 10, W - 20, H - 20)

  // Header branding
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(16, 71, 118)
  doc.text('REAL EDUCATION TIME', W / 2, 38, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(90, 90, 100)
  doc.text('Learn • Practice • Test • Improve', W / 2, 46, { align: 'center' })

  // Divider
  doc.setDrawColor(38, 120, 199)
  doc.setLineWidth(0.6)
  doc.line(90, 52, W - 90, 52)

  // Certificate of achievement
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(210, 140, 0)
  doc.text('CERTIFICATE OF ACHIEVEMENT', W / 2, 66, { align: 'center' })

  // Presented to
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(60, 60, 70)
  doc.text('This certificate is proudly presented to', W / 2, 82, { align: 'center' })

  // Student name
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(16, 71, 118)
  doc.text(studentName || 'Student', W / 2, 98, { align: 'center' })

  // For completing
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(60, 60, 70)
  doc.text('For successfully completing', W / 2, 112, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(16, 71, 118)
  doc.text(quizName || 'the course', W / 2, 124, { align: 'center' })

  // Score box
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(60, 60, 70)
  doc.text(`Score: ${score}   |   Percentage: ${percentage}%   |   Grade: ${grade}`, W / 2, 140, { align: 'center' })

  // Date and ID
  doc.setFontSize(10)
  doc.setTextColor(110, 110, 120)
  doc.text(`Date: ${formatDate(date)}`, 30, H - 30)
  doc.text(`Certificate ID: ${certId}`, W - 30, H - 30, { align: 'right' })

  // Signature line
  doc.setDrawColor(90, 90, 100)
  doc.line(30, H - 22, 90, H - 22)
  doc.setFontSize(10)
  doc.text('Authorized Signatory', 60, H - 17, { align: 'center' })

  // Save as PDF
  const filename = `RET_Certificate_${certId}.pdf`
  doc.save(filename)
  return filename
}
