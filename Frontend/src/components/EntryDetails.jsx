import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
export default function EntryDetails({ id, onClose }) {
  const [entry, setEntry] = useState(null); const [error, setError] = useState('');
  useEffect(() => { let live = true; api.entry(id).then(r => live && setEntry(r.data)).catch(e => live && setError(e.message)); return () => { live = false; }; }, [id]);
  return <div className="modal-backdrop" role="presentation" onClick={onClose}><section className="modal" role="dialog" aria-modal="true" aria-label="Journal entry details" onClick={e => e.stopPropagation()}>
    <div className="modal-heading"><h2>Journal entry details</h2><button className="icon-button" onClick={onClose} aria-label="Close details">×</button></div>
    {error && <div className="alert error">{error}</div>}{!entry && !error && <p>Loading entry…</p>}
    {entry && <><div className="detail-grid"><div><small>Entry number</small><strong>{entry.jeh_EntryNumber}</strong></div><div><small>Entry date</small><strong>{String(entry.jeh_EntryDate).slice(0,10)}</strong></div><div className="wide"><small>Description</small><strong>{entry.jeh_Description}</strong></div><div><small>Created by</small><strong>{entry.jeh_CreatedBy || '—'}</strong></div></div>
    <div className="table-wrap"><table><thead><tr><th>Account</th><th>Line description</th><th className="numeric">Debit</th><th className="numeric">Credit</th></tr></thead><tbody>{entry.lines.map(l => <tr key={l.jel_JournalEntryLineId}><td>{l.acc_AccountCode} — {l.acc_AccountName}</td><td>{l.jel_LineDescription || '—'}</td><td className="numeric">{money(l.jel_Debit)}</td><td className="numeric">{money(l.jel_Credit)}</td></tr>)}</tbody><tfoot><tr><th colSpan="2">Totals</th><th className="numeric">{money(entry.totals.debit)}</th><th className="numeric">{money(entry.totals.credit)}</th></tr></tfoot></table></div>
    <h3>Audit history</h3>
    {entry.auditLogs.length === 0 ? <p className="muted">No audit history is available for this entry.</p> : <div className="table-wrap"><table><thead><tr><th>Action</th><th>Details</th><th>Date and time</th><th>Created by</th></tr></thead><tbody>{entry.auditLogs.map(log => <tr key={log.aud_AuditLogId}><td>{log.aud_Action}</td><td>{log.aud_Details || '—'}</td><td>{log.aud_CreatedAt ? new Date(log.aud_CreatedAt).toLocaleString() : '—'}</td><td>{log.aud_CreatedBy || '—'}</td></tr>)}</tbody></table></div>}</>}
  </section></div>;
}
