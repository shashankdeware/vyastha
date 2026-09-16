import React, { useRef, useState } from 'react';
import { X, Check, RotateCcw, Upload } from 'lucide-react';

export default function SignatureModal({ isOpen, onClose, onSave, currentSignature }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState('draw'); // 'draw' or 'upload'
  const [uploadedImage, setUploadedImage] = useState(currentSignature || '');

  if (!isOpen) return null;

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0F172A';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setUploadedImage('');
  };

  const handleSave = () => {
    if (mode === 'draw') {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        onSave(dataUrl);
      }
    } else {
      onSave(uploadedImage);
    }
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <h3 className="font-bold text-base tracking-tight" data-testid="signature-modal-title">
            Authorized Signature
          </h3>
          <button 
            onClick={onClose}
            data-testid="signature-modal-close-btn"
            className="text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Mode Switch */}
          <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-100 mb-4">
            <button
              type="button"
              data-testid="sig-mode-draw-btn"
              onClick={() => setMode('draw')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'draw' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
            >
              Draw Signature
            </button>
            <button
              type="button"
              data-testid="sig-mode-upload-btn"
              onClick={() => setMode('upload')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'upload' ? 'bg-white shadow text-blue-600' : 'text-slate-600'}`}
            >
              Upload Signature Stamp/Image
            </button>
          </div>

          {mode === 'draw' ? (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={440}
                  height={180}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  data-testid="signature-canvas"
                  className="cursor-crosshair bg-white w-full"
                />
                <div className="absolute bottom-2 text-[10px] text-slate-400 pointer-events-none">
                  Sign inside the box
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleClear}
                  data-testid="signature-clear-btn"
                  className="flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-red-600"
                >
                  <RotateCcw size={14} />
                  <span>Clear Signature</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50">
                {uploadedImage ? (
                  <div className="space-y-3">
                    <img 
                      src={uploadedImage} 
                      alt="Signature preview" 
                      className="max-h-32 mx-auto object-contain bg-white p-2 border rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setUploadedImage('')}
                      className="text-xs text-red-600 underline font-medium"
                    >
                      Remove & Choose Another
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <Upload size={32} className="text-slate-400 mb-2" />
                    <span className="text-sm font-semibold text-slate-700">Click to upload signature stamp</span>
                    <span className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP (Transparent PNG recommended)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      data-testid="signature-file-input"
                      className="hidden" 
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            data-testid="signature-cancel-btn"
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            data-testid="signature-apply-btn"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm flex items-center space-x-1.5"
          >
            <Check size={14} />
            <span>Save Signature</span>
          </button>
        </div>
      </div>
    </div>
  );
}