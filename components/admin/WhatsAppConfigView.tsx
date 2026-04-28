import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { turso } from '../../services/tursoClient';
import { useUser } from '@clerk/clerk-react';
import { sendWhatsAppMessage } from '../../services/whatsappClient';

export interface WhatsAppRecipient {
  id: string;
  phone_number: string;
  name: string;
  created_at?: string;
}

const WhatsAppConfigView: React.FC = () => {
  const { user: clerkUser } = useUser();
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');
  const [fonnteToken, setFonnteToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [testWSLoading, setTestWSLoading] = useState(false);

  useEffect(() => {
    fetchRecipients();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await turso.execute({
        sql: 'SELECT value FROM settings WHERE key = ?',
        args: ['fonnte_token']
      });
      if (res.rows.length > 0) {
        setFonnteToken(res.rows[0].value as string);
      }
    } catch (e) {
      console.error("Failed to fetch settings:", e);
    }
  };

  const handleSaveToken = async () => {
    setSavingToken(true);
    try {
      await turso.execute({
        sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        args: ['fonnte_token', fonnteToken]
      });
      alert('Fonnte token saved successfully!');
    } catch (e: any) {
      setErrorMessage(`Failed to save token: ${e.message}`);
    } finally {
      setSavingToken(false);
    }
  };

  const fetchRecipients = async () => {
    let data: any = null;
    let error: any = null;
    try {
      const res = await turso.execute('SELECT * FROM whatsapp_recipients ORDER BY created_at DESC');
      data = res.rows;
    } catch (e: any) { error = e; }

    if (error) {
      setErrorMessage(error.message);
    } else {
      setRecipients(data || []);
      setErrorMessage(null);
    }
  };

  const handleTestWhatsApp = async () => {
    setTestWSLoading(true);
    setErrorMessage(null);
    try {
      if (recipients.length === 0) {
        throw new Error("No configured WhatsApp numbers to send test to.");
      }

      const targets = recipients.map(r => r.phone_number);
      await sendWhatsAppMessage({
        targets,
        message: '👋 Halo! Ini adalah pesan uji coba dari sistem Field Ops Checklist Anda. Integrasi Fonnte WhatsApp berhasil!',
        token: fonnteToken
      });
      
      alert(`Test message successfully sent to ${targets.length} recipients!`);
    } catch (err: any) {
      console.error("Test message failed:", err);
      setErrorMessage(`Test message failed: ${err.message || JSON.stringify(err)}`);
    } finally {
      setTestWSLoading(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!newNumber) return;
    
    // basic phone number checking (digits and optionally leading +)
    const isValidPhone = /^\+?[0-9]{10,15}$/.test(newNumber);
    if (!isValidPhone) {
      setErrorMessage('Format nomor WhatsApp tidak valid. Contoh: 08123456789 atau 628123456789');
      return;
    }

    setLoading(true);
    let error: any = null;
    try {
      await turso.execute({
        sql: 'INSERT INTO whatsapp_recipients (id, phone_number, name) VALUES (?, ?, ?)',
        args: [crypto.randomUUID(), newNumber, newName || newNumber]
      });
    } catch (e: any) { error = e; }

    if (error) {
      setErrorMessage(error.message);
    } else {
      await fetchRecipients();
      setNewNumber('');
      setNewName('');
      setErrorMessage(null);
    }
    setLoading(false);
  };

  const handleDeleteRecipient = async (id: string) => {
    if (!confirm('Are you sure you want to remove this recipient?')) return;

    let error: any = null;
    try {
      await turso.execute({ sql: 'DELETE FROM whatsapp_recipients WHERE id = ?', args: [id] });
    } catch (e: any) { error = e; }

    if (error) {
      setErrorMessage(error.message);
    } else {
      setRecipients(recipients.filter(r => r.id !== id));
      setErrorMessage(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-neutral">WhatsApp Notification Config</h2>
        <Button
          onClick={handleTestWhatsApp}
          disabled={testWSLoading}
          variant="secondary"
          className="!py-2 !px-4 text-sm"
        >
          {testWSLoading ? 'Sending...' : 'Send Test WS'}
        </Button>
      </div>

      <Card>
        <div className="mb-4">
          <h3 className="text-lg font-bold text-neutral mb-2">Fonnte API Configuration</h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter your Fonnte API Token to enable WhatsApp notifications. Get it from <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">fonnte.com</a>.
          </p>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">
                <span className="label-text">Fonnte API Token</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="Enter your Fonnte token"
                value={fonnteToken}
                onChange={(e) => setFonnteToken(e.target.value)}
              />
            </div>
            <Button
              onClick={handleSaveToken}
              disabled={savingToken || !fonnteToken}
              className="mb-0"
            >
              {savingToken ? 'Saving...' : 'Save Token'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-6">
          <h3 className="text-lg font-bold text-neutral mb-2">Add WhatsApp Recipient</h3>
          <p className="text-sm text-gray-500 mb-4">
            These WhatsApp numbers will receive a notification every time an audit is submitted. (Format: 0812xxxx / 62812xxxx)
          </p>
          {errorMessage && (
            <div className="alert alert-error mb-4">
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">
                <span className="label-text">WhatsApp Number</span>
              </label>
              <input
                type="tel"
                className="input input-bordered w-full"
                placeholder="08123456789"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="label">
                <span className="label-text">Name (Optional)</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddRecipient}
              disabled={loading || !newNumber}
              className="mb-0"
            >
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        </div>

        <div className="divider"></div>

        <div>
          <h3 className="text-lg font-bold text-neutral mb-4">Current Recipients</h3>
          {recipients.length === 0 ? (
            <p className="text-gray-500 italic">No additional recipients configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>WhatsApp Number</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient) => (
                    <tr key={recipient.id}>
                      <td>{recipient.name}</td>
                      <td>{recipient.phone_number}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteRecipient(recipient.id)}
                          className="btn btn-ghost btn-xs text-error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default WhatsAppConfigView;
