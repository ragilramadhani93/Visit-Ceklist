import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Card from '../shared/Card';
import Button from '../shared/Button';
import { supabase } from '../../services/supabaseClient';

export interface EmailRecipient {
  id: string;
  email: string;
  name: string;
  created_at?: string;
}

const EmailConfigView: React.FC = () => {
  const [recipients, setRecipients] = useState<EmailRecipient[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [testEmailLoading, setTestEmailLoading] = useState(false);

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    const { data, error } = await supabase
      .from('email_recipients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      setErrorMessage(error.message);
    } else {
      setRecipients(data || []);
      setErrorMessage(null);
    }
  };

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    setErrorMessage(null);
    try {
      // Get current user email
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.email) {
         throw new Error("No authenticated user email found to send test to.");
      }
      
      // Send to the logged-in user AND all configured recipients for testing
      const recipientEmails = recipients.map(r => r.email);
      if (!recipientEmails.includes(user.email)) {
          recipientEmails.push(user.email);
      }

      const testPayload = {
        email: recipientEmails, 
        auditorName: "Test User",
        location: "Test Location",
        date: new Date().toISOString().split('T')[0],
        reportUrl: "https://example.com/test-report.pdf"
      };

      const { data, error } = await supabase.functions.invoke('send-audit-report', {
        body: testPayload
      });

      if (error) {
        throw error;
      }

      alert(`Test email sent successfully to ${recipientEmails.length} recipients (including YOU).\n\nRecipients:\n${recipientEmails.join('\n')}`);
    } catch (err: any) {
      console.error("Test email failed:", err);
      setErrorMessage(`Test email failed: ${err.message || JSON.stringify(err)}`);
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleAddRecipient = async () => {
    if (!newEmail) return;
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);
    if (!isValidEmail) {
      setErrorMessage('Format email tidak valid.');
      return;
    }
    
    setLoading(true);
    const { data, error } = await (supabase as any).rpc('add_email_recipient', {
      p_email: newEmail,
      p_name: newName || newEmail.split('@')[0],
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      await fetchRecipients();
      setNewEmail('');
      setNewName('');
      setErrorMessage(null);
    }
    setLoading(false);
  };

  const handleDeleteRecipient = async (id: string) => {
    if (!confirm('Are you sure you want to remove this recipient?')) return;

    const { error } = await supabase
      .from('email_recipients')
      .delete()
      .eq('id', id);

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
        <h2 className="text-2xl font-bold text-neutral">Report Email Configuration</h2>
        <Button 
            onClick={handleTestEmail} 
            disabled={testEmailLoading}
            variant="secondary"
            className="!py-2 !px-4 text-sm"
        >
            {testEmailLoading ? 'Sending...' : 'Send Test Email'}
        </Button>
      </div>

      <Card>
        <div className="mb-6">
          <h3 className="text-lg font-bold text-neutral mb-2">Add Recipient</h3>
          <p className="text-sm text-gray-500 mb-4">
            These email addresses will receive a copy of every audit report submitted.
          </p>
          {errorMessage && (
            <div className="alert alert-error mb-4">
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">
                <span className="label-text">Email Address</span>
              </label>
              <input
                type="email"
                className="input input-bordered w-full"
                placeholder="colleague@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
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
              disabled={loading || !newEmail}
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
                    <th>Email</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient) => (
                    <tr key={recipient.id}>
                      <td>{recipient.name}</td>
                      <td>{recipient.email}</td>
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

export default EmailConfigView;
