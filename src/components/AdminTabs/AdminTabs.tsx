import React from 'react';

export type AdminView = 'students' | 'teachers';

interface AdminTabsProps {
  adminView: AdminView;
  onChange: (view: AdminView) => void;
}

const AdminTabs: React.FC<AdminTabsProps> = ({ adminView, onChange }) => (
  <div className="p-4 flex space-x-2 mb-4">
    <button
      className={`px-4 py-2 rounded ${adminView === 'students' ? 'bg-green-600' : 'bg-gray-700'}`}
      onClick={() => onChange('students')}
    >
      Por estudiantes
    </button>
    <button
      className={`px-4 py-2 rounded ${adminView === 'teachers' ? 'bg-green-600' : 'bg-gray-700'}`}
      onClick={() => onChange('teachers')}
    >
      Por profesores
    </button>
  </div>
);

export default AdminTabs;
