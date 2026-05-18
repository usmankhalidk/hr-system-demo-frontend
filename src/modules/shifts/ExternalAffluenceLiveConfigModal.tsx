import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Building2, Info, UserRound } from 'lucide-react';
import { getAvatarUrl, getStoreLogoUrl } from '../../api/client';
import {
  ExternalAffluenceCalculationSettings,
  ExternalAffluenceConfigurationResponse,
  getExternalAffluenceConfiguration,
  updateExternalAffluenceConfiguration,
} from '../../api/externalAffluence';
import { useAuth } from '../../context/AuthContext';

type SlotWeightState = Record<string, string>;
type ParamHelpKey = 'visitorsPerStaff' | 'lowMaxStaff' | 'mediumMaxStaff' | 'coverageTolerance' | 'slotWeights';

interface Props {
  storeId: number;
  onClose: () => void;
  onSaved?: () => void;
}

function buildWeightState(settings: ExternalAffluenceCalculationSettings): SlotWeightState {
  const state: SlotWeightState = {};
  for (const slot of settings.slotWeights) {
    state[slot.timeSlot] = String(slot.weight);
  }
  return state;
}

export default function ExternalAffluenceLiveConfigModal({
  storeId,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const { targetCompanyId } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [config, setConfig] = useState<ExternalAffluenceConfigurationResponse | null>(null);
  const [visitorsPerStaff, setVisitorsPerStaff] = useState<string>('10');
  const [lowMaxStaff, setLowMaxStaff] = useState<string>('2');
  const [mediumMaxStaff, setMediumMaxStaff] = useState<string>('4');
  const [coverageTolerance, setCoverageTolerance] = useState<string>('0.4');
  const [slotWeights, setSlotWeights] = useState<SlotWeightState>({});
  const [hoveredHelpKey, setHoveredHelpKey] = useState<ParamHelpKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExternalAffluenceConfiguration({ storeId, targetCompanyId: targetCompanyId ?? undefined });
      setConfig(data);
      setVisitorsPerStaff(String(Math.max(1, Math.round(data.settings.visitorsPerStaff))));
      setLowMaxStaff(String(data.settings.lowMaxStaff));
      setMediumMaxStaff(String(data.settings.mediumMaxStaff));
      setCoverageTolerance(String(data.settings.coverageTolerance));
      setSlotWeights(buildWeightState(data.settings));
    } catch {
      setError(t('errors.DEFAULT'));
    } finally {
      setLoading(false);
    }
  }, [storeId, t, targetCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedSlotWeights = useMemo(() => {
    if (!config) return [] as Array<{ timeSlot: string; weight: number }>;
    return [...config.settings.slotWeights].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  }, [config]);

  const parameterHelp = useMemo<Record<ParamHelpKey, string>>(() => ({
    visitorsPerStaff: t('shifts.affluence_staff_per_visitor_hint', 'Set how many visitors one staff member should handle. Example: 10 means 1 staff for 10 visitors.'),
    lowMaxStaff: t('shifts.affluence_low_max_staff_hint', 'If estimated visitors in a slot are up to this value, that slot tag is Low.'),
    mediumMaxStaff: t('shifts.affluence_medium_max_staff_hint', 'If estimated visitors in a slot are above Low and up to this value, that slot tag is Medium.'),
    coverageTolerance: t('shifts.affluence_coverage_tolerance_hint', 'Gap status compares recommended vs scheduled staff per slot; if the gap stays within this margin, status stays Balanced.'),
    slotWeights: t('shifts.affluence_slot_weights_hint', 'Default is 0.25 for each slot (equal split).'),
  }), [t]);

  const storeLogoUrl = getStoreLogoUrl(config?.localStoreLogoFilename ?? null);
  const integratedByAvatarUrl = getAvatarUrl(config?.integration.mappedByAvatarFilename ?? null);

  const integratedByName = useMemo(() => {
    if (!config) return '-';
    const fullName = `${config.integration.mappedByName ?? ''} ${config.integration.mappedBySurname ?? ''}`.trim();
    return fullName || t('common.na', 'N/A');
  }, [config, t]);

  const integratedAt = useMemo(() => {
    if (!config?.integration.mappedAt) return null;
    const dt = new Date(config.integration.mappedAt);
    if (Number.isNaN(dt.getTime())) return config.integration.mappedAt;
    return dt.toLocaleString();
  }, [config]);

  function normalizeNumber(value: string, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
  }

  function normalizeVisitorsPerStaff(value: string, fallback: number): number {
    const parsed = Number(value);
    const rounded = Number.isFinite(parsed) ? Math.round(parsed) : Math.round(fallback);
    return Math.max(1, rounded);
  }

  function renderHelpLabel(label: string, helpKey: ParamHelpKey): JSX.Element {
    const open = hoveredHelpKey === helpKey;
    return (
      <div
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, width: 'fit-content' }}
        onMouseEnter={() => setHoveredHelpKey(helpKey)}
        onMouseLeave={() => setHoveredHelpKey(null)}
      >
        <span>{label}</span>
        <span
          style={{
            width: 15,
            height: 15,
            borderRadius: 999,
            border: '1px solid rgba(46,86,122,0.35)',
            color: '#2e567a',
            display: 'inline-grid',
            placeItems: 'center',
            background: '#fff',
          }}
        >
          <Info size={10} />
        </span>

        {open ? (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 8,
              zIndex: 15,
              width: 260,
              fontSize: 11,
              lineHeight: 1.45,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(95,62,47,0.25)',
              background: '#fff9f2',
              color: '#5f3e2f',
              boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
            }}
          >
            {parameterHelp[helpKey]}
          </div>
        ) : null}
      </div>
    );
  }

  async function handleSave() {
    if (!config) return;

    setSaving(true);
    setError(null);
    try {
      const payloadSlotWeights = sortedSlotWeights.map((slot) => ({
        timeSlot: slot.timeSlot,
        weight: normalizeNumber(slotWeights[slot.timeSlot] ?? String(slot.weight), slot.weight),
      }));

      const updated = await updateExternalAffluenceConfiguration({
        storeId,
        targetCompanyId: targetCompanyId ?? undefined,
        visitorsPerStaff: normalizeVisitorsPerStaff(visitorsPerStaff, config.settings.visitorsPerStaff),
        lowMaxStaff: Math.round(normalizeNumber(lowMaxStaff, config.settings.lowMaxStaff)),
        mediumMaxStaff: Math.round(normalizeNumber(mediumMaxStaff, config.settings.mediumMaxStaff)),
        coverageTolerance: normalizeNumber(coverageTolerance, config.settings.coverageTolerance),
        slotWeights: payloadSlotWeights,
      });

      setConfig(updated);
      setNotice(t('shifts.affluence_config_saved', 'Configuration updated'));
      if (onSaved) onSaved();
      setTimeout(() => setNotice(null), 2200);
    } catch {
      setError(t('errors.DEFAULT'));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(13,33,55,0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 980,
          maxHeight: '88vh',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{
          background: 'linear-gradient(135deg, #5f3e2f 0%, #2e567a 100%)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', marginBottom: 3 }}>
              {t('shifts.affluence_heading')}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
              {t('shifts.affluence_config_title', 'External Affluence Configuration')}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
          >
            x
          </button>
        </div>

        {notice && (
          <div style={{ padding: '8px 20px', background: 'rgba(22,163,74,0.1)', borderBottom: '1px solid rgba(22,163,74,0.2)', fontSize: 13, color: '#16a34a' }}>
            {notice}
          </div>
        )}

        {error && (
          <div style={{ padding: '8px 20px', background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)', fontSize: 13, color: 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
            {error}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16 }}>x</button>
          </div>
        )}

        <div style={{ padding: 18, overflowY: 'auto', display: 'grid', gap: 14 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{t('common.loading')}</div>
          ) : config ? (
            <>
              <div
                style={{
                  border: '1px solid #d8c6b5',
                  borderRadius: 12,
                  padding: 12,
                  background: 'linear-gradient(160deg, #f8f3ec 0%, #edf5fb 100%)',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: '#5f3e2f' }}>{t('shifts.affluence_integration_details', 'Store Integration')}</div>

                <div
                  style={{
                    border: '1px solid rgba(95,62,47,0.2)',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.85)',
                    padding: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    overflowX: 'auto',
                  }}
                >
                  <div
                    style={{
                      minWidth: 190,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: '#f1f5f9',
                        border: '1px solid rgba(46,86,122,0.22)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#2e567a',
                      }}
                    >
                      {storeLogoUrl ? (
                        <img src={storeLogoUrl} alt={config.localStoreName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Building2 size={18} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 800, color: '#5f3e2f' }}>{config.localStoreName}</div>
                      <div>{config.localStoreCode}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: '1px dashed rgba(46,86,122,0.45)',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#2e567a',
                      flexShrink: 0,
                      background: '#fff',
                    }}
                  >
                    <ArrowLeftRight size={14} />
                  </div>

                  <div style={{ minWidth: 250, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div style={{ fontWeight: 700, color: '#2e567a' }}>{t('shifts.affluence_external_store', 'External store')}</div>
                    <div>
                      {config.integration.mapped
                        ? `${config.integration.externalStoreCode ?? '-'} - ${config.integration.externalStoreName ?? '-'}`
                        : t('shifts.affluence_not_mapped', 'Not mapped yet')}
                    </div>
                    {config.integration.notes ? (
                      <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>{config.integration.notes}</div>
                    ) : null}
                  </div>

                  <div style={{ minWidth: 220, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        overflow: 'hidden',
                        border: '1px solid rgba(46,86,122,0.32)',
                        background: '#f1f5f9',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#2e567a',
                      }}
                    >
                      {integratedByAvatarUrl ? (
                        <img src={integratedByAvatarUrl} alt={integratedByName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <UserRound size={16} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 700, color: '#2e567a' }}>{t('shifts.affluence_integrated_by', 'Integrated by')}</div>
                      <div>{integratedByName}</div>
                      {integratedAt ? <div style={{ color: 'var(--text-muted)' }}>{integratedAt}</div> : null}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: '#fff' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#2e567a', marginBottom: 10 }}>{t('shifts.affluence_formula_parameters', 'Calculation Parameters')}</div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(220px, 320px)' }}>
                  <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                    {renderHelpLabel(t('shifts.affluence_visitors_per_staff', 'Visitors for 1 staff'), 'visitorsPerStaff')}
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={visitorsPerStaff}
                      onChange={(event) => setVisitorsPerStaff(event.target.value)}
                      style={{ padding: '7px 9px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}
                    />
                  </label>

                </div>

                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {renderHelpLabel(t('shifts.affluence_slot_weights', 'Slot Weights'), 'slotWeights')}
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: 620, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))' }}>
                      {sortedSlotWeights.map((slot) => (
                        <label key={slot.timeSlot} style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                          {slot.timeSlot}
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.01}
                            value={slotWeights[slot.timeSlot] ?? String(slot.weight)}
                            onChange={(event) => setSlotWeights((prev) => ({ ...prev, [slot.timeSlot]: event.target.value }))}
                            style={{ padding: '7px 9px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, border: '1px solid #dbe4ee', borderRadius: 10, padding: 10, background: '#f8fbff', display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2e567a' }}>
                    {t('shifts.affluence_level_rules_section', 'Level & Gap Rules')}
                  </div>

                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      {renderHelpLabel(t('shifts.affluence_low_max_staff', 'Low visitors up to'), 'lowMaxStaff')}
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={lowMaxStaff}
                        onChange={(event) => setLowMaxStaff(event.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      {renderHelpLabel(t('shifts.affluence_medium_max_staff', 'Medium visitors up to'), 'mediumMaxStaff')}
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={mediumMaxStaff}
                        onChange={(event) => setMediumMaxStaff(event.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                      {renderHelpLabel(t('shifts.affluence_coverage_tolerance', 'Balanced gap margin'), 'coverageTolerance')}
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={coverageTolerance}
                        onChange={(event) => setCoverageTolerance(event.target.value)}
                        style={{ padding: '7px 9px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'rgba(46,86,122,0.06)', fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 4 }}>
                <strong style={{ color: '#2e567a' }}>{t('shifts.affluence_formula_title', 'How calculation works')}</strong>
                <div>{t('shifts.affluence_formula_line1', 'Estimated visitors per slot = weekday average visitors * slot weight.')}</div>
                <div>{t('shifts.affluence_formula_line2', 'Recommended staff = ceil(estimated visitors / visitors for 1 staff).')}</div>
                <div>{t('shifts.affluence_formula_line3', 'Gap = recommended staff - confirmed scheduled staff (average in selected date range).')}</div>
                <div>{t('shifts.affluence_formula_line4', 'Level tag per slot uses estimated visitors: Low <= low visitors, Medium <= medium visitors, High > medium visitors.')}</div>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: '#fff', fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gap: 8 }}>
                <strong style={{ color: '#2e567a' }}>{t('shifts.affluence_status_tags_title', 'Status Tags')}</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 88, padding: '4px 8px', borderRadius: 999, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5' }}>
                    {t('shifts.affluence_status_under', 'under')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 88, padding: '4px 8px', borderRadius: 999, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#166534', background: '#dcfce7', border: '1px solid #86efac' }}>
                    {t('shifts.affluence_status_balanced', 'balanced')}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 88, padding: '4px 8px', borderRadius: 999, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#1e40af', background: '#dbeafe', border: '1px solid #93c5fd' }}>
                    {t('shifts.affluence_status_over', 'over')}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {t('shifts.affluence_status_tags_hint', 'These tags are shown in the live table to quickly indicate if a slot has too few, balanced, or extra staff.')}
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>{t('common.close')}</button>
          <button className="btn btn-primary" onClick={() => { void handleSave(); }} disabled={loading || saving || !config}>
            {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
