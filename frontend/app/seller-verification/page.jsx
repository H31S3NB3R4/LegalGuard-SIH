'use client';

// Seller verification (pre-upload validator) - reskinned per design.md
// (tododesign Phase 4). Preserves ALL existing functionality: category
// selection, description + declared weight/dimensions, image upload AND
// webcam capture, staged loading, and the readiness report from
// POST /api/seller/check-upload-text. The readiness report reuses the same
// ChecklistRow component as the Phase 3 product report.

import React, { useRef, useState } from 'react';
import {
  Upload,
  Camera,
  X,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Shield,
  Image as ImageIcon,
  Weight,
  Ruler,
  Trash2,
} from 'lucide-react';
import AppShell from '../../components/AppShell';
import {
  CardHeader,
  ChecklistRow,
  ProgressRing,
  EmptyState,
  StatusPill,
} from '../../components/ui';
import { categoryMeta, severityMeta } from '../../lib/design';
import {
  mergeFindings,
  normalizeViolations,
  violationSummary,
  reportScore,
} from '../../lib/report';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const CATEGORIES = [
  { value: 'amazon', label: 'General (Amazon)' },
  { value: 'food', label: 'Food & Beverages' },
  { value: 'skincare', label: 'Skincare & Cosmetics' },
  { value: 'electric', label: 'Electronics & Electricals' },
  { value: 'book', label: 'Books & Stationery' },
];

export default function SellerVerification() {
  const [category, setCategory] = useState('amazon');
  const [description, setDescription] = useState('');
  const [actualWeight, setActualWeight] = useState('');
  const [actualDimensions, setActualDimensions] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);

  // Webcam capture (preserved)
  const [showWebcam, setShowWebcam] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const startWebcam = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setCameraStream(stream);
      setShowWebcam(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((err) => {
            console.error('Error playing video:', err);
            setCameraError('Failed to start video playback');
          });
        }
      }, 100);
      setError(null);
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Failed to access camera. Please check permissions.');
      setError('Failed to access camera: ' + err.message);
      setShowWebcam(false);
    }
  };

  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowWebcam(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (
      videoRef.current &&
      canvasRef.current &&
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
    ) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], 'webcam-capture-' + Date.now() + '.jpg', {
              type: 'image/jpeg',
            });
            handleAddImages([file]);
          }
        },
        'image/jpeg',
        0.9
      );
    }
  };

  const handleAddImages = (files) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const incoming = Array.from(files).filter((f) => allowed.includes(f.type));
    if (incoming.length === 0) {
      setError('Only JPG, PNG and WEBP images are allowed.');
      return;
    }
    setImages((prev) => {
      const next = [...prev, ...incoming].slice(0, 10);
      setImagePreviews(
        next.map((img) =>
          typeof img === 'string' ? img : URL.createObjectURL(img)
        )
      );
      return next;
    });
    setError(null);
  };

  const handleFileChange = (e) => {
    handleAddImages(e.target.files);
    e.target.value = '';
  };

  const removeImage = (index) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setImagePreviews(
        next.map((img) =>
          typeof img === 'string' ? img : URL.createObjectURL(img)
        )
      );
      return next;
    });
  };

  // Submit to the pre-upload validator (preserved)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (images.length < 1) {
      setError('Please upload or capture at least 1 product image');
      return;
    }

    if (!description.trim()) {
      setError('Please provide a product description');
      return;
    }

    setLoading(true);
    setValidationResult(null);
    setLoadingStage('Uploading product data...');

    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('actual_weight', actualWeight.trim());
      formData.append('actual_dimensions', actualDimensions.trim());
      images.forEach((image) => formData.append('images', image));

      const stages = [
        'Uploading images...',
        'Running OCR analysis...',
        'AI validation in progress...',
        'Checking compliance...',
        'Generating report...',
      ];
      let idx = 0;
      const interval = setInterval(() => {
        if (idx < stages.length) setLoadingStage(stages[idx++]);
      }, 1800);

      const response = await fetch(
        API_BASE_URL + '/api/seller/check-upload-text',
        {
          method: 'POST',
          body: formData,
          credentials: 'include',
        }
      );

      clearInterval(interval);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Validation failed');

      setValidationResult(data.feedback);
      setLoadingStage('');
    } catch (err) {
      setError(err.message || 'Validation failed');
      setLoadingStage('');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setValidationResult(null);
    setImages([]);
    setImagePreviews([]);
    setDescription('');
    setActualWeight('');
    setActualDimensions('');
    setCategory('amazon');
    setError(null);
    stopWebcam();
  };

  const meta = categoryMeta(category);
  const feedback = validationResult;
  const feedbackScore = reportScore(feedback);
  const findings = mergeFindings(feedback);
  const violations = normalizeViolations(feedback);
  const summary = violationSummary(feedback);
  const status = String(feedback?.analysis_status || '').toLowerCase();
  const indeterminate =
    !feedback || status.includes('indeterminate') || status.includes('demo_pending');

  return (
    <AppShell title="Seller Verification">
      <div className={'space-y-6 ' + (feedback ? '' : 'max-w-3xl')}>
        {/* Validator form */}
        <section className="bg-surface border border-default rounded-card shadow-card p-6">
          <CardHeader
            title="Pre-upload validator"
            subtitle="Check a listing against Legal Metrology rules before it goes live"
          />
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">
                Product category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => {
                  const cm = categoryMeta(c.value === 'amazon' ? 'generic' : c.value);
                  const active = category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={
                        'inline-flex items-center gap-2 h-9 px-3.5 rounded-pill border text-sm font-medium transition-colors ' +
                        (active
                          ? 'bg-nav-active text-white border-nav-active'
                          : 'bg-surface text-secondary border-default hover:text-primary hover:border-muted')
                      }
                    >
                      <span
                        className="w-2 h-2 rounded-pill"
                        style={{ backgroundColor: active ? '#fff' : cm.color }}
                      />
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-2">
                Product description (as it will appear on the listing)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the product: title, features, materials, usage instructions, etc."
                rows={4}
                className="w-full px-4 py-3 rounded-tile border border-default bg-surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors resize-none"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-xs text-secondary">
                  Characters: {description.length}
                </p>
                <p className="text-xs text-muted">Recommended: 100+ characters</p>
              </div>
            </div>

            {/* Weight + dimensions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-default rounded-tile p-4">
                <label className="flex items-center gap-2 text-xs font-medium text-secondary mb-2">
                  <Weight className="w-4 h-4" />
                  Actual weight (declared)
                </label>
                <input
                  type="text"
                  value={actualWeight}
                  onChange={(e) => setActualWeight(e.target.value)}
                  placeholder="e.g., 250g, 1.5kg"
                  className="w-full h-10 px-3.5 rounded-pill border border-default bg-surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="border border-default rounded-tile p-4">
                <label className="flex items-center gap-2 text-xs font-medium text-secondary mb-2">
                  <Ruler className="w-4 h-4" />
                  Actual dimensions (declared)
                </label>
                <input
                  type="text"
                  value={actualDimensions}
                  onChange={(e) => setActualDimensions(e.target.value)}
                  placeholder="e.g., 15x10x5 cm"
                  className="w-full h-10 px-3.5 rounded-pill border border-default bg-surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Images + webcam (preserved) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs font-medium text-secondary">
                  <ImageIcon className="w-4 h-4" />
                  Product images ({images.length}/10)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={showWebcam ? stopWebcam : startWebcam}
                    className={
                      'inline-flex items-center gap-1.5 h-8 px-3 rounded-pill border text-xs font-semibold transition-colors ' +
                      (showWebcam
                        ? 'bg-surface text-critical border-critical'
                        : 'bg-surface text-primary border-default hover:border-muted')
                    }
                  >
                    {showWebcam ? (
                      <>
                        <X className="w-3.5 h-3.5" /> Close camera
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" /> Use camera
                      </>
                    )}
                  </button>
                  <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Upload
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {showWebcam ? (
                <div className="mt-3 border border-default rounded-tile p-4 bg-page">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium text-secondary">
                      Camera preview
                    </p>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill bg-nav-active text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capture photo
                    </button>
                  </div>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full max-h-64 object-contain rounded-tile bg-surface"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  {cameraError ? (
                    <p className="mt-2 text-xs text-critical">{cameraError}</p>
                  ) : null}
                </div>
              ) : null}

              {imagePreviews.length > 0 ? (
                <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {imagePreviews.map((src, i) => (
                    <div
                      key={i}
                      className="relative border border-default rounded-tile overflow-hidden group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={'Capture ' + (i + 1)}
                        className="w-full h-20 object-cover bg-page"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-pill bg-surface border border-default flex items-center justify-center text-critical hover:border-critical transition-colors"
                        aria-label={'Remove image ' + (i + 1)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Upload clear photos of the product label (front, back, and any
                  mandatory declarations).
                </p>
              )}
            </div>

            {error ? (
              <div className="flex items-start gap-2 border border-critical rounded-tile p-3 text-sm text-critical">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}

            {loading && loadingStage ? (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingStage}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="h-10 px-6 rounded-pill bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Validate listing
                  </>
                )}
              </button>
              {feedback ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="h-10 px-5 rounded-pill border border-default text-sm font-medium text-secondary hover:text-primary hover:border-muted transition-colors"
                >
                  Start over
                </button>
              ) : null}
            </div>
          </form>
        </section>

        {/* Readiness report - reuses the Phase 3 checklist + violations layout */}
        {feedback ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader
                  title="Readiness report"
                  subtitle={feedback.estimated_approval_chance
                    ? 'Estimated approval chance: ' + feedback.estimated_approval_chance
                    : undefined}
                />
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <ProgressRing
                    value={feedbackScore}
                    size={120}
                    thickness={9}
                    label="Readiness score"
                    centerValue={
                      feedbackScore === null
                        ? 'N/A'
                        : Math.round(feedbackScore) + '%'
                    }
                    centerLabel={'Grade ' + (feedback.compliance_grade || 'N/A')}
                  />
                  <div className="flex-1 space-y-3 w-full">
                    <div
                      className={
                        'inline-flex items-center gap-2 h-9 px-4 rounded-pill border text-sm font-semibold ' +
                        (indeterminate
                          ? 'bg-surface text-secondary border-default'
                          : feedback.ready_for_upload
                            ? 'bg-surface text-success border-success'
                            : 'bg-surface text-critical border-critical')
                      }
                    >
                      {indeterminate ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : feedback.ready_for_upload ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                      {indeterminate
                        ? 'Analysis pending - do not upload yet'
                        : feedback.ready_for_upload
                          ? 'Ready for upload'
                          : 'Not ready for upload'}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Critical', value: summary.critical, tone: 'var(--color-critical)' },
                        { label: 'Major', value: summary.major, tone: 'var(--color-warning)' },
                        { label: 'Minor', value: summary.minor, tone: 'var(--color-secondary)' },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="border border-default rounded-tile p-3 text-center"
                        >
                          <p
                            className="text-2xl font-bold tabular-nums"
                            style={{ color: item.tone }}
                          >
                            {item.value}
                          </p>
                          <p className="mt-0.5 text-xs text-secondary">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Weight / dimension validation results (preserved feature) */}
                {feedback.validation_results ? (
                  <div className="mt-5 border border-default rounded-tile p-4">
                    <h4 className="text-sm font-semibold text-primary mb-3">
                      Declared vs. package values
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {['weight_validation', 'dimension_validation'].map((key) => {
                        const v = feedback.validation_results?.[key];
                        if (!v) return null;
                        const ok = String(v.status || '').toLowerCase() === 'match';
                        return (
                          <div key={key} className="border border-default rounded-tile p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-secondary">
                                {key === 'weight_validation' ? 'Weight' : 'Dimensions'}
                              </p>
                              <StatusPill tone={ok ? 'success' : 'critical'}>
                                {v.status || 'unknown'}
                              </StatusPill>
                            </div>
                            <p className="mt-2 text-xs text-secondary">
                              Declared: {v.seller_declared || 'N/A'}
                            </p>
                            <p className="text-xs text-secondary">
                              Package shows: {v.ocr_extracted || 'N/A'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>

              {/* Declaration checklist (same ChecklistRow as Phase 3) */}
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader
                  title="Declaration checklist"
                  subtitle="Each mandatory declaration with the layer that verified it"
                />
                {findings.length === 0 ? (
                  <EmptyState
                    icon={AlertCircle}
                    title="No declaration findings available"
                    hint="The validator could not extract declarations from these images."
                  />
                ) : (
                  findings.map((f) => (
                    <ChecklistRow
                      key={f.requirement}
                      requirement={f.requirement}
                      status={f.status}
                      layer={f.layer}
                      value={f.value}
                    />
                  ))
                )}
              </section>

              {/* Issues grouped by severity (design.md severity tokens) */}
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader
                  title="Issues to fix"
                  subtitle="Grouped by severity - critical, major, minor"
                />
                {summary.total === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No issues found"
                    hint={
                      indeterminate
                        ? 'Analysis has not completed yet.'
                        : 'All evaluated declarations look good.'
                    }
                  />
                ) : (
                  <div className="space-y-5">
                    {['critical', 'major', 'minor'].map((severity) => {
                      const items = violations[severity];
                      if (!items || items.length === 0) return null;
                      const sm = severityMeta(severity);
                      return (
                        <div key={severity}>
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="w-2.5 h-2.5 rounded-pill"
                              style={{ backgroundColor: sm.color }}
                            />
                            <h4 className="text-sm font-semibold text-primary capitalize">
                              {severity}
                            </h4>
                            <span className="text-xs text-muted">{items.length}</span>
                          </div>
                          <div className="divide-y divide-default">
                            {items.map((v, i) => (
                              <div key={v.name + '-' + i} className="py-3">
                                <p className="text-sm font-medium text-primary">
                                  {v.name}
                                </p>
                                {v.description ? (
                                  <p className="mt-1 text-xs text-secondary">
                                    {v.description}
                                  </p>
                                ) : null}
                                {v.remedy ? (
                                  <p className="mt-1 text-xs">
                                    <span className="font-medium text-primary">Fix:</span>{' '}
                                    <span className="text-secondary">{v.remedy}</span>
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Right column - assessment + image analysis */}
            <div className="space-y-6">
              <section className="bg-surface border border-default rounded-card shadow-card p-6">
                <CardHeader title="AI assessment" />
                {feedback.assessment ? (
                  <p className="text-sm leading-relaxed text-secondary whitespace-pre-line">
                    {feedback.assessment}
                  </p>
                ) : (
                  <p className="text-sm text-muted">No assessment available.</p>
                )}
              </section>

              {feedback.recommendations?.length ? (
                <section className="bg-surface border border-default rounded-card shadow-card p-6">
                  <CardHeader title="Recommendations" />
                  <ul className="space-y-2">
                    {feedback.recommendations.map((rec, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-secondary"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {feedback.image_analysis ? (
                <section className="bg-surface border border-default rounded-card shadow-card p-6">
                  <CardHeader title="Image analysis" />
                  <div className="space-y-2 text-xs text-secondary">
                    <p>Quality: {feedback.image_analysis.quality || 'unknown'}</p>
                    {typeof feedback.image_analysis.confidence === 'number' ? (
                      <p>
                        Confidence: {Math.round(feedback.image_analysis.confidence * 100)}%
                      </p>
                    ) : null}
                    {feedback.image_analysis.symbols_found?.length ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {feedback.image_analysis.symbols_found.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center h-6 px-2.5 rounded-pill bg-page border border-default text-[11px] font-medium text-secondary"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
