import React, { useState, useCallback, useRef } from 'react';
import { Outlet, User } from '../../types';
import Card from '../shared/Card';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import { Plus, Edit, Trash2, Store, Download, Upload } from 'lucide-react';
import Papa from 'papaparse';
import Avatar from '../shared/Avatar';

interface OutletManagementViewProps {
  outlets: Outlet[];
  users: User[];
  onAddOutlet: (outlet: Omit<Outlet, 'id'>) => void;
  onUpdateOutlet: (outlet: Outlet) => void;
  onDeleteOutlet: (outletId: string) => void;
  onBulkUploadOutlets: (newOutlets: Omit<Outlet, 'id'>[], updatedOutlets: Outlet[]) => Promise<void>;
}

const CSV_HEADERS = ['Outlet Name', 'Address', 'Manager Name', 'WhatsApp Numbers', 'Latitude', 'Longitude', 'Radius'];

const OutletForm: React.FC<{ outlet?: Outlet | null; users: User[]; onSave: (outlet: any) => void; onCancel: () => void }> = ({ outlet, users, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: outlet?.name || '',
    address: outlet?.address || '',
    manager_id: outlet?.manager_id || '',
    whatsapp_number: Array.isArray(outlet?.whatsapp_number)
      ? outlet.whatsapp_number.join(', ')
      : (typeof outlet?.whatsapp_number === 'string' ? outlet.whatsapp_number : ''),
    latitude: outlet?.latitude?.toString() || '',
    longitude: outlet?.longitude?.toString() || '',
    radius: outlet?.radius?.toString() || '50', // Default 50m
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      manager_id: formData.manager_id || null,
      whatsapp_number: formData.whatsapp_number
        ? formData.whatsapp_number.split(',').map(num => num.trim()).filter(num => num !== '')
        : null,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      radius: formData.radius ? parseFloat(formData.radius) : null,
    };
    if (outlet) {
      onSave({ ...outlet, ...dataToSave });
    } else {
      onSave(dataToSave);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Outlet Name</label>
        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">Address</label>
        <textarea name="address" id="address" value={formData.address} onChange={handleChange} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">Latitude</label>
          <input type="number" step="any" name="latitude" id="latitude" value={formData.latitude} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" placeholder="e.g. -6.200000" />
        </div>
        <div>
          <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">Longitude</label>
          <input type="number" step="any" name="longitude" id="longitude" value={formData.longitude} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" placeholder="e.g. 106.816666" />
        </div>
      </div>
      <div>
        <label htmlFor="radius" className="block text-sm font-medium text-gray-700">Radius (Meters) - Default 50m</label>
        <input type="number" name="radius" id="radius" value={formData.radius} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
      </div>
      <div>
        <label htmlFor="manager_id" className="block text-sm font-medium text-gray-700">Assigned Manager</label>
        <select name="manager_id" id="manager_id" value={formData.manager_id} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
          <option value="">-- No Manager --</option>
          {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="whatsapp_number" className="block text-sm font-medium text-gray-700">WhatsApp Numbers (comma-separated, e.g., +62812...,+62813...)</label>
        <textarea name="whatsapp_number" id="whatsapp_number" value={formData.whatsapp_number} onChange={handleChange} rows={2} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" placeholder="e.g., +6281234567890, +6281345678901" />
      </div>
      <div className="flex justify-end pt-4 space-x-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary">Save Outlet</Button>
      </div>
    </form>
  )
}


const OutletManagementView: React.FC<OutletManagementViewProps> = ({ outlets, users, onAddOutlet, onUpdateOutlet, onDeleteOutlet, onBulkUploadOutlets }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const userMap = new Map<string, User>(users.map(user => [user.id, user]));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const newOutlets: Omit<Outlet, 'id'>[] = [];
          const updatedOutlets: Outlet[] = [];
          const errors: string[] = [];

          for (const row of results.data) {
            const outletData: Partial<Outlet> = {};
            let isValid = true;

            const mappedRow: Record<string, any> = {};
            for (const key in row) {
              const normalizedKey = key.trim();
              mappedRow[normalizedKey] = row[key];
            }

            outletData.name = mappedRow['Outlet Name']?.trim();
            outletData.address = mappedRow['Address']?.trim() || '';
            outletData.manager_id = mappedRow['Manager Name']?.trim() 
              ? users.find(u => u.name.toLowerCase() === mappedRow['Manager Name'].trim().toLowerCase())?.id || null
              : null;
            outletData.whatsapp_number = mappedRow['WhatsApp Numbers'] 
              ? mappedRow['WhatsApp Numbers'].split(';').map((num: string) => num.trim()).filter((num: string) => num !== '')
              : [];
            outletData.latitude = mappedRow['Latitude'] ? parseFloat(mappedRow['Latitude']) : null;
            outletData.longitude = mappedRow['Longitude'] ? parseFloat(mappedRow['Longitude']) : null;
            outletData.radius = mappedRow['Radius'] ? parseFloat(mappedRow['Radius']) : 50;

            if (!outletData.name) {
              errors.push(`Row with missing outlet name: ${JSON.stringify(row)}`);
              isValid = false;
            }

            if (isValid) {
              const existingOutlet = outlets.find(o => o.name === outletData.name);
              if (existingOutlet) {
                updatedOutlets.push({ ...existingOutlet, ...outletData as Outlet });
              } else {
                newOutlets.push(outletData as Omit<Outlet, 'id'>);
              }
            }
          }

          if (errors.length > 0) {
            alert(`Errors found during file parsing:\n${errors.join('\n')}`);
          }

          if (newOutlets.length > 0 || updatedOutlets.length > 0) {
            if (window.confirm(`Found ${newOutlets.length} new outlets and ${updatedOutlets.length} outlets to update. Proceed with bulk upload?`)) {
              try {
                await onBulkUploadOutlets(newOutlets, updatedOutlets);
                alert('Bulk upload completed successfully!');
              } catch (uploadError: any) {
                alert(`Bulk upload failed: ${uploadError.message}`);
              }
            }
          } else {
            alert('No valid outlets found in the uploaded file.');
          }
        },
        error: (err: any) => {
          alert(`Error parsing CSV file: ${err.message}`);
        }
      });
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [outlets, users, onBulkUploadOutlets]);

  const handleOpenModal = useCallback((outlet?: Outlet) => {
    setEditingOutlet(outlet || null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingOutlet(null);
  }, []);

  const handleSave = (outlet: Outlet | Omit<Outlet, 'id'>) => {
    if ('id' in outlet) {
      onUpdateOutlet(outlet);
    } else {
      onAddOutlet(outlet);
    }
    handleCloseModal();
  };

  const handleDownloadOutlets = useCallback(() => {
    const headers = CSV_HEADERS;
    const csvRows = outlets.map(outlet => {
      const manager = outlet.manager_id ? userMap.get(outlet.manager_id) : null;
      const whatsappNumbers = Array.isArray(outlet.whatsapp_number)
        ? outlet.whatsapp_number.join(';')
        : '';
      return [
        `"${outlet.name}"`,
        `"${outlet.address || ''}"`,
        `"${manager?.name || ''}"`,
        `"${whatsappNumbers}"`,
        `"${outlet.latitude || ''}"`,
        `"${outlet.longitude || ''}"`,
        `"${outlet.radius || '50'}"`,
      ].join(',');
    });

    const csvString = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'outlets.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [outlets, userMap]);

  return (
    <>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-neutral">Outlet Management</h2>
          <div className="flex space-x-2">
            <Button onClick={handleDownloadOutlets} variant="secondary"><Download size={16} className="mr-2" /> Download Outlets</Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary"><Upload size={16} className="mr-2" /> Bulk Upload</Button>
            <Button onClick={() => handleOpenModal()}><Plus size={16} className="mr-2" /> Add New Outlet</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-base-200">
                <th className="p-3">Outlet Name</th>
                <th className="p-3">Address</th>
                <th className="p-3 hidden md:table-cell">Geofence</th>
                <th className="p-3">Manager</th>
                <th className="p-3">WhatsApp</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {outlets.map(outlet => {
                const manager = outlet.manager_id ? userMap.get(outlet.manager_id) : null;
                return (
                  <tr key={outlet.id} className="border-b hover:bg-base-200">
                    <td className="p-3 font-semibold">
                      <div className="flex items-center">
                        <Store className="w-5 h-5 mr-3 text-primary" />
                        {outlet.name}
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">{outlet.address}</td>
                    <td className="p-3 hidden md:table-cell text-sm text-gray-500">
                      {outlet.latitude && outlet.longitude ? (
                        <span>{Math.round((outlet.radius || 50))}m radius</span>
                      ) : (
                        <span className="italic">Not Set</span>
                      )}
                    </td>
                    <td className="p-3">
                      {manager ? (
                        <div className="flex items-center">
                          <Avatar user={manager} className="w-8 h-8 mr-2" />
                          <div>
                            <div className="font-medium text-sm">{manager.name}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-sm">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600">
                      {Array.isArray(outlet.whatsapp_number) && outlet.whatsapp_number.length > 0
                        ? outlet.whatsapp_number.join(', ')
                        : 'N/A'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleOpenModal(outlet)} className="p-2 text-gray-500 hover:text-primary rounded-full hover:bg-blue-100"><Edit size={18} /></button>
                        <button onClick={() => onDeleteOutlet(outlet.id)} className="p-2 text-gray-500 hover:text-error rounded-full hover:bg-red-100"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingOutlet ? 'Edit Outlet' : 'Add New Outlet'}
      >
        <OutletForm outlet={editingOutlet} users={users} onSave={handleSave} onCancel={handleCloseModal} />
      </Modal>
    </>
  );
};

export default OutletManagementView;
