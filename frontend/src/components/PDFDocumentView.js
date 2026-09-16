import appLogo from '../assets/vyastha_logo.jpeg';
import html2pdf from 'html2pdf.js';
import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, CheckCircle, ShieldCheck, MessageCircle, Mail, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import api from '../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

export default function PDFDocumentView({ documentData, type = 'INVOICE' }) {
  const printRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [sharingWhatsApp, setSharingWhatsApp] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const isInvoice = type.toUpperCase() === 'INVOICE';
  const docNumber = isInvoice ? documentData?.invoice_number : documentData?.quotation_number;
  const docDate = isInvoice ? documentData?.invoice_date : documentData?.quotation_date;

  const seller = documentData?.seller_details || {};
  const buyer = documentData?.buyer_details || {};
  const bank = documentData?.bank_details || seller?.bank_details || {};
  const items = documentData?.line_items || [];
  const sellerName = seller.company_name || 'Vyastha Enterprise';
  const totalAmount = Number(documentData?.total_amount || 0);

  const [emailTo, setEmailTo] = useState(buyer.email || '');
  const [emailSubject, setEmailSubject] = useState(`${isInvoice ? 'Invoice' : 'Quotation'} ${docNumber || ''} from ${sellerName}`);
  const [emailMessage, setEmailMessage] = useState(
    `Dear ${buyer.company_name || 'Customer'},\n\nPlease find your ${isInvoice ? 'invoice' : 'quotation'} #${docNumber || ''} from ${sellerName}.\n\n${isInvoice ? 'Invoice' : 'Quotation'} Amount: \u20b9${totalAmount.toFixed(2)}\n\nThank you for your business.\n\nRegards,\n${sellerName}`
  );

  const generatePdfDataUri = async () => {
    if (!printRef.current) throw new Error('Document not ready');
    const dataUri = await html2pdf()
      .set({
        margin: 0,
        filename: `${docNumber || 'document'}.pdf`,
        image: { type: 'png', quality: 1 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(printRef.current)
      .output('datauristring');
    return dataUri;
  };

  const buildWhatsAppMessage = () => (
    `Dear ${buyer.company_name || 'Customer'},\n\n` +
    `Please find your ${isInvoice ? 'invoice' : 'quotation'} #${docNumber || ''} from ${sellerName}.\n\n` +
    `${isInvoice ? 'Invoice' : 'Quotation'} Amount: \u20b9${totalAmount.toFixed(2)}\n\n` +
    `Thank you for your business.\n\nRegards,\n${sellerName}`
  );

  const handleWhatsAppShare = async () => {
    setSharingWhatsApp(true);
    try {
      // WhatsApp's click-to-chat link cannot attach a file automatically, so we
      // download the PDF for the user and open WhatsApp with a pre-filled,
      // editable message. The user attaches the just-downloaded PDF in WhatsApp.
      if (printRef.current) {
        await html2pdf()
          .set({
            margin: 0,
            filename: `${docNumber || 'document'}.pdf`,
            image: { type: 'png', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
          })
          .from(printRef.current)
          .save();
      }

      const rawPhone = (buyer.phone || '').replace(/[^0-9]/g, '');
      const phoneWithCountryCode = rawPhone
        ? (rawPhone.length === 10 ? `91${rawPhone}` : rawPhone)
        : '';
      const text = encodeURIComponent(buildWhatsAppMessage());
      const waUrl = phoneWithCountryCode
        ? `https://wa.me/${phoneWithCountryCode}?text=${text}`
        : `https://wa.me/?text=${text}`;

      window.open(waUrl, '_blank', 'noopener,noreferrer');
      toast.success(
        phoneWithCountryCode
          ? 'PDF downloaded. WhatsApp is opening \u2014 attach the downloaded file to send it.'
          : 'PDF downloaded. No saved customer number \u2014 choose a contact in WhatsApp and attach the file.'
      );
    } catch (err) {
      console.error(err);
      toast.error('Could not prepare the document for WhatsApp. Please try again.');
    } finally {
      setSharingWhatsApp(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTo)) {
      toast.error('Enter a valid recipient email address.');
      return;
    }
    if (!documentData?.id) {
      toast.error(`Please save this ${isInvoice ? 'invoice' : 'quotation'} before emailing it.`);
      return;
    }
    setSendingEmail(true);
    try {
      const pdfDataUri = await generatePdfDataUri();
      const endpoint = isInvoice
        ? `/invoices/${documentData.id}/send-email`
        : `/quotations/${documentData.id}/send-email`;
      await api.post(endpoint, {
        to_email: emailTo,
        subject: emailSubject,
        message: emailMessage,
        pdf_base64: pdfDataUri,
      });
      toast.success(`${isInvoice ? 'Invoice' : 'Quotation'} emailed to ${emailTo}`);
      setEmailDialogOpen(false);
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      toast.error(detail || 'Invoice could not be sent. Please check the email address and try again.');
    } finally {
      setSendingEmail(false);
    }
  };

  // UPI Intent URL
  const upiUrl = documentData?.upi_qr_data || `upi://pay?pa=${bank.upi_id || 'business@upi'}&pn=${seller.company_name || 'Vyastha'}&am=${documentData?.total_amount || 0}&cu=INR&tn=${docNumber}`;

  // const handleDownloadPDF = async () => {
  //   if (!printRef.current) return;
  //   setDownloading(true);
  //   try {
  //     const canvas = await html2canvas(printRef.current, {
  //       scale: 2,
  //       useCORS: true,
  //       logging: false,
  //       backgroundColor: '#FFFFFF',
  //     });
  //     const imgData = canvas.toDataURL('image/png');
  //     const pdf = new jsPDF('p', 'mm', 'a4');
  //     const imgWidth = 210;
  //     const pageHeight = 297;
  //     const imgHeight = (canvas.height * imgWidth) / canvas.width;
  //     let heightLeft = imgHeight;
  //     let position = 0;

  //     pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  //     heightLeft -= pageHeight;

  //     while (heightLeft >= 0) {
  //       position = heightLeft - imgHeight;
  //       pdf.addPage();
  //       pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  //       heightLeft -= pageHeight;
  //     }

  //     pdf.save(`${docNumber || 'document'}.pdf`);
  //     toast.success(`${isInvoice ? 'Invoice' : 'Quotation'} PDF downloaded successfully!`);
  //   } catch (err) {
  //     console.error(err);
  //     toast.error("Failed to generate PDF. You can also use the Print button.");
  //   } finally {
  //     setDownloading(false);
  //   }
  // };

    const handleDownloadPDF = async () => {
  if (!printRef.current) return;
  setDownloading(true);
  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `${docNumber || 'document'}.pdf`,
        image: { type: 'png', quality: 1 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(printRef.current)
      .save();
    toast.success(`${isInvoice ? 'Invoice' : 'Quotation'} PDF downloaded successfully!`);
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate PDF. You can also use the Print button.");
  } finally {
    setDownloading(false);
  }
};




  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Control Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center space-x-2 text-slate-700 text-sm font-semibold">
          <ShieldCheck className="text-emerald-600" size={18} />
          <span>Document Preview: <strong className="text-slate-900">{docNumber}</strong></span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handlePrint}
            data-testid="print-document-btn"
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            data-testid="download-pdf-btn"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
          >
            <Download size={15} />
            <span>{downloading ? 'Rendering PDF...' : 'Download Official PDF'}</span>
          </button>
          <button
            type="button"
            onClick={handleWhatsAppShare}
            disabled={sharingWhatsApp}
            data-testid="whatsapp-share-btn"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all disabled:opacity-60"
          >
            {sharingWhatsApp ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
            <span>{sharingWhatsApp ? 'Preparing...' : 'Share on WhatsApp'}</span>
          </button>
          <button
            type="button"
            onClick={() => setEmailDialogOpen(true)}
            data-testid="email-share-btn"
            className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Mail size={15} />
            <span>Send by Email</span>
          </button>
        </div>
      </div>

      {/* Send by Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send {isInvoice ? 'Invoice' : 'Quotation'} #{docNumber} by Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-to">Recipient Email</Label>
              <Input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
                data-testid="email-to-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                data-testid="email-subject-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-message">Message</Label>
              <Textarea
                id="email-message"
                rows={7}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                data-testid="email-message-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={sendingEmail}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail} data-testid="email-send-confirm-btn">
              {sendingEmail ? (
                <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Sending...</span>
              ) : (
                'Send Email'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Sheet (Standard A4 High-Contrast Swiss Business Layout) */}
      <div className="flex justify-center bg-slate-200/50 p-2 sm:p-6 rounded-2xl overflow-x-auto">
        <div
          ref={printRef}
          data-testid="invoice-pdf-document"
          className="bg-white text-slate-900 w-full max-w-[800px] p-8 sm:p-12 shadow-xl border border-slate-200 rounded-lg font-sans text-xs sm:text-sm leading-relaxed"
          style={{ minHeight: '1050px' }}
        >
          {/* Top Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-900 pb-6 gap-6">
            <div className="space-y-1.5 max-w-sm">
              {seller.company_logo && (
                <img 
                  src={seller.company_logo} 
                  alt="Logo" 
                  className="h-12 max-w-[180px] object-contain mb-2"
                />
              )}
              <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase" data-testid="pdf-seller-name">
                {seller.company_name || 'Vyastha Enterprise'}
              </h1>
              {seller.tagline && (
                <p className="text-xs text-slate-500 font-medium italic">{seller.tagline}</p>
              )}
              <p className="text-xs text-slate-600 whitespace-pre-line">{seller.address}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 pt-1 font-mono">
                {seller.gstin_number && <span><strong>GSTIN:</strong> {seller.gstin_number}</span>}
                {seller.pan_number && <span><strong>PAN:</strong> {seller.pan_number}</span>}
                {seller.phone && <span><strong>Ph:</strong> {seller.phone}</span>}
                {seller.email && <span><strong>Email:</strong> {seller.email}</span>}
              </div>
            </div>

            {/* Document Title & Meta */}
            <div className="sm:text-right space-y-1.5 min-w-[200px]">
              <div className="inline-block bg-slate-950 text-white px-3.5 py-1 text-sm font-black tracking-wider uppercase rounded">
                {isInvoice ? 'TAX INVOICE' : 'PRICE QUOTATION'}
              </div>
              <p className="font-mono font-bold text-base text-slate-900 pt-1" data-testid="pdf-doc-number">
                #{docNumber}
              </p>
              <div className="text-xs text-slate-600 space-y-0.5">
                <div><span className="text-slate-400">Date:</span> <strong>{docDate}</strong></div>
                {documentData?.shipping_date && (
                  <div><span className="text-slate-400">Shipping Date:</span> <strong>{documentData.shipping_date}</strong></div>
                )}
                {documentData?.valid_until && (
                  <div><span className="text-slate-400">Valid Until:</span> <strong>{documentData.valid_until}</strong></div>
                )}
                {documentData?.customer_id && (
                  <div><span className="text-slate-400">Customer ID:</span> <strong>{documentData.customer_id}</strong></div>
                )}
                {documentData?.vehicle_number && (
                  <div><span className="text-slate-400">Vehicle No:</span> <strong>{documentData.vehicle_number}</strong></div>
                )}
                {documentData?.reference_quotation_number && (
                  <div><span className="text-slate-400">Ref Quote:</span> <strong className="text-blue-600">{documentData.reference_quotation_number}</strong></div>
                )}
              </div>
            </div>
          </div>

          {/* Buyer / Bill To Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Billed To / Buyer:</p>
              <h3 className="font-bold text-base text-slate-950" data-testid="pdf-buyer-name">
                {buyer.company_name || 'Customer Name'}
              </h3>
              {buyer.contact_person && (
                <p className="text-xs text-slate-600 font-medium">Attn: {buyer.contact_person}</p>
              )}
              <p className="text-xs text-slate-600 whitespace-pre-line mt-1">{buyer.address}</p>
              <div className="flex flex-wrap gap-x-3 text-xs text-slate-600 mt-1 font-mono">
                {buyer.phone && <span>Ph: {buyer.phone}</span>}
                {buyer.email && <span>Email: {buyer.email}</span>}
              </div>
            </div>
            <div className="sm:text-right space-y-1 font-mono text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:text-right font-sans mb-1">Tax Identifiers:</p>
              {buyer.gstin_number && <div><strong>Buyer GSTIN:</strong> {buyer.gstin_number}</div>}
              {buyer.pan_number && <div><strong>Buyer PAN:</strong> {buyer.pan_number}</div>}
              {documentData?.payment_status && isInvoice && (
                <div className="mt-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase font-sans ${
                    documentData.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    Status: {documentData.payment_status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto my-6">
            <table className="w-full text-left border-collapse" data-testid="pdf-items-table">
              <thead>
                <tr className="border-y-2 border-slate-900 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-800">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-center">Unit / Pc</th>
                  <th className="py-2.5 px-3 text-right">Unit Price (₹)</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.map((item, idx) => (
                  <tr key={idx} className="text-xs">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{item.description}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-600">{item.unit || 'pc'}</td>
                    <td className="py-2.5 px-3 text-right font-mono">₹{Number(item.unit_price).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-950">
                      ₹{(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Summary & Auto Calculations */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-t-2 border-slate-900 pt-4 gap-6">
            {/* Bank Info & Dynamic QR Code Section */}
            <div className="flex-1 space-y-4 max-w-sm">
              <div className="border border-slate-200 bg-slate-50 p-3.5 rounded-lg flex items-center space-x-4">
                {/* Dynamic UPI Payment QR Code */}
                {/* <div className="bg-white p-2 border border-slate-300 rounded shadow-sm flex-shrink-0 flex flex-col items-center"> */}
                <div className="border border-slate-200 bg-slate-50 p-3.5 rounded-lg flex items-center space-x-4 avoid-break">
                  <QRCodeSVG 
                    value={upiUrl} 
                    size={84} 
                    level="M" 
                    includeMargin={false}
                  />
                  <span className="text-[9px] font-bold text-slate-700 mt-1 uppercase">Scan & Pay</span>
                </div>

                <div className="text-xs space-y-1">
                  <p className="font-bold text-slate-900 uppercase text-[11px] tracking-wide">Bank & UPI Settlement:</p>
                  {bank.bank_name && <p className="text-slate-600 font-medium">{bank.bank_name} - {bank.branch}</p>}
                  {bank.account_number && <p className="font-mono text-slate-800">A/C: {bank.account_number}</p>}
                  {bank.ifsc && <p className="font-mono text-slate-800">IFSC: {bank.ifsc}</p>}
                  {bank.upi_id && <p className="font-mono text-blue-700 font-bold">UPI: {bank.upi_id}</p>}
                </div>
              </div>
            </div>

            {/* Calculation Totals */}
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-mono font-bold">₹{Number(documentData?.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(documentData?.discount_amount) > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-200 text-emerald-700">
                  <span>Discount ({documentData?.discount_type === 'percentage' ? `${documentData.discount_value}%` : 'Flat'}):</span>
                  <span className="font-mono font-bold">-₹{Number(documentData?.discount_amount || 0).toFixed(2)}</span>
                </div>
              )}
              {Number(documentData?.cgst_amount) > 0 ? (
  <>
    <div className="flex justify-between py-1 border-b border-slate-200">
      <span className="text-slate-600">CGST ({(documentData?.tax_rate || 0) / 2}%):</span>
      <span className="font-mono font-bold">₹{Number(documentData?.cgst_amount || 0).toFixed(2)}</span>
    </div>
    <div className="flex justify-between py-1 border-b border-slate-200">
      <span className="text-slate-600">SGST ({(documentData?.tax_rate || 0) / 2}%):</span>
      <span className="font-mono font-bold">₹{Number(documentData?.sgst_amount || 0).toFixed(2)}</span>
    </div>
  </>
) : (
  <div className="flex justify-between py-1 border-b border-slate-200">
    <span className="text-slate-600">IGST ({documentData?.tax_rate || 0}%):</span>
    <span className="font-mono font-bold">₹{Number(documentData?.igst_amount || 0).toFixed(2)}</span>
  </div>
)}
              <div className="flex justify-between py-2 bg-slate-950 text-white px-3 rounded text-sm font-bold">
                <span>Grand Total:</span>
                <span className="font-mono text-base" data-testid="pdf-grand-total">
                  ₹{Number(documentData?.total_amount || 0).toFixed(2)}
                </span>
              </div>

              {isInvoice && Number(documentData?.amount_paid) > 0 && (
                <>
                  <div className="flex justify-between py-1 text-emerald-700 font-semibold">
                    <span>Amount Paid:</span>
                    <span className="font-mono">₹{Number(documentData.amount_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-slate-200 text-red-700 font-bold">
                    <span>Balance Due:</span>
                    <span className="font-mono">₹{Number(documentData.balance_due || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Terms & Conditions + Signatory Stamp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-slate-200 text-xs">
            <div className="space-y-1.5">
              <p className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Terms & Conditions:</p>
              <p className="text-slate-600 whitespace-pre-line text-[11px] leading-relaxed">
                {documentData?.terms_and_conditions || seller?.default_terms || 'Standard business terms apply.'}
              </p>
              {documentData?.notes && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[11px]">
                  <strong>Special Note:</strong> {documentData.notes}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end justify-end space-y-2 sm:text-right pt-4 sm:pt-0">
              {documentData?.signature_url ? (
                <img 
                  src={documentData.signature_url} 
                  alt="Signature" 
                  className="max-h-16 object-contain border-b border-slate-400 pb-1"
                />
              ) : (
                <div className="h-14 w-40 border-b border-dashed border-slate-400"></div>
              )}
              <p className="font-bold text-slate-950 uppercase text-[11px]">
                For {seller.company_name || 'Vyastha Enterprise'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">Authorized Signatory</p>
            </div>
          </div>
          {/* App Branding Footer */}
          <div className="flex items-center justify-center space-x-1.5 mt-8 pt-4 border-t border-slate-100">
            <img src={appLogo} alt="Vyastha" className="h-4 w-4 rounded object-cover" />
            <span className="text-[9px] text-slate-400 font-medium">Generated with Vyastha</span>
          </div>
        </div>
      </div>
    </div>
  );
}