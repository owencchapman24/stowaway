import { useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen, AppText, Button, InlineBanner, ScreenHeader, uiStyles } from '../ui/components';
import { diagnosticAllowed } from '../epub-spike/policy';
import { exportNativeEpubReport, runNativeEpubSuite, runNativeEpubCase, selectNativeEpub } from '../epub-spike/native';
import { PERFORMANCE_CASES, type PerformanceCase } from '../epub-spike/corpus';
import type { Report } from '../epub-spike/report';

export default function EpubDiagnostic() {
  const [busy, setBusy] = useState(false), [report, setReport] = useState<Report | null>(null), [status, setStatus] = useState('Ready');
  const active = useRef<AbortController | null>(null), mounted = useRef(true), picking = useRef(false);
  const currentReport = useRef<Report | null>(null), attempt = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener('change', (state) => { if (state !== 'active' && !picking.current) active.current?.abort(); });
    return () => { mounted.current = false; active.current?.abort(); sub.remove(); };
  }, []);
  async function run(kind: 'quick' | 'extended' | 'selected' | 'export' | PerformanceCase) {
    if (!diagnosticAllowed() || active.current) return;
    // A retained export handler must read the latest attempt, never its old closure.
    const exportReport = kind === 'export' ? currentReport.current : null;
    if (kind === 'export' && !exportReport) return;
    if (kind !== 'export') { attempt.current++; currentReport.current = null; setReport(null); }
    const id = attempt.current, abort = new AbortController(); active.current = abort; setBusy(true); setStatus(`Attempt ${id}: working…`);
    try {
      if (kind === 'export' && exportReport) { await exportNativeEpubReport(exportReport); if (mounted.current) setStatus(`Attempt ${id}: share sheet closed.`); }
      else {
        picking.current = kind === 'selected';
        const result = kind === 'selected' ? await selectNativeEpub(abort.signal) : PERFORMANCE_CASES.includes(kind as PerformanceCase) ? await runNativeEpubCase(kind as PerformanceCase, abort.signal) :
          await runNativeEpubSuite(kind === 'extended' ? 'extended' : 'quick', abort.signal,
            (done, total) => { if (mounted.current) setStatus(`Attempt ${id}: ${done} / ${total} tests`); });
        if (mounted.current) { currentReport.current = result; setReport(result); setStatus(result ? `Attempt ${id}: suite ${result.summary.verdict}` : `Attempt ${id}: file selection cancelled; no current report.`); }
      }
    } catch { if (mounted.current) {
      if (kind !== 'export') { currentReport.current = null; setReport(null); }
      setStatus(kind === 'export' ? `Attempt ${id}: report export failed; retry explicitly.` : `Attempt ${id} failed before a report was produced. File-provider, storage or policy failure; retry explicitly.`);
    } }
    finally { picking.current = false; active.current = null; if (mounted.current) setBusy(false); }
  }
  return <AppScreen><ScrollView contentContainerStyle={uiStyles.content}>
    <ScreenHeader title="EPUB feasibility" action={<Button label="Back to Library" text="Library" onPress={() => router.back()} disabled={busy} />} />
    {!diagnosticAllowed() ? <InlineBanner message="This diagnostic is disabled for this build." /> : <View style={{ gap: 16 }}>
      <AppText>Internal M1a diagnostic. Results are temporary. Your Library is unchanged.</AppText>
      <Button label="Run EPUB Test Suite" text="Run EPUB Test Suite" variant="primary" disabled={busy} onPress={() => { void run('quick'); }} />
      <Button label="Run Extended Security and Performance Suite" text="Run Extended Suite" disabled={busy} onPress={() => { void run('extended'); }} />
      <Button label="Select EPUB File" text="Select EPUB File" disabled={busy} onPress={() => { void run('selected'); }} />
      <AppText>Single-case investigation (does not replace the suites):</AppText>
      {PERFORMANCE_CASES.map((id) => <Button key={id} label={`Investigate ${id}`} text={id} disabled={busy} onPress={() => { void run(id); }} />)}
      {busy && <Button label="Cancel diagnostic" text="Cancel" onPress={() => active.current?.abort()} />}
      <View accessibilityLiveRegion="polite"><AppText>{status}</AppText></View>
      {report && <><AppText>Report {report.attemptId} · {report.metadata.tier} · {report.summary.verdict}{ '\n' }{report.summary.passed} passed · {report.summary.failed} failed · {report.summary.skipped} skipped{ '\n' }
        Longest timer stall: {Math.round(report.summary.longestStallMs)} ms{ '\n' }Cleanup failures: {report.summary.cleanupFailures}</AppText>
        <Button label="Export JSON Report" text="Export JSON Report" disabled={busy} onPress={() => { void run('export'); }} /></>}
    </View>}
  </ScrollView></AppScreen>;
}
