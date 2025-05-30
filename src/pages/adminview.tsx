import React, { useState, useEffect } from 'react';
import { firestore, auth } from '@/firebase/firebase';
import { getDocs, collection, doc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useRouter } from 'next/router';

interface AppUser {
  uid: string;
  displayName?: string;
  email: string;
  role: 'admin' | 'profesor' | 'estudiante';
  teacherId?: string;
}

type Group = 'todos' | 'estudiantes' | 'profesores';

export default function AdminView() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [group, setGroup] = useState<Group>('todos');
  const [loading, setLoading] = useState(true);

  const [currentUser, authLoading] = useAuthState(auth);
  const router = useRouter();

  // Verificar acceso de admin y redirigir otros roles
  useEffect(() => {
    const checkAccess = async () => {
      if (!currentUser) return router.push('/auth');
      const userRef = doc(firestore, 'users', currentUser.uid);
      const snap = await getDoc(userRef);
      const role = (snap.data()?.role || '').toLowerCase();
      if (role !== 'admin') {
        if (role === 'profesor') return router.push('/teacherview');
        if (role === 'estudiante') return router.push('/home/studentview');
        return router.push('/auth');
      }
    };
    if (!authLoading) checkAccess();
  }, [currentUser, authLoading, router]);

  // Cargar todos los usuarios
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(firestore, 'users'));
        const list: AppUser[] = snapshot.docs.map(d => ({
          uid: d.id,
          displayName: d.data().displayName || d.data().name || 'Sin nombre',
          email: d.data().email,
          role: d.data().role,
          teacherId: d.data().teacherId,
        }));
        setUsers(list);
      } catch (e) {
        console.error('Error cargando usuarios:', e);
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  const filtered = users.filter(u => {
    if (group === 'todos') return true;
    if (group === 'estudiantes') return u.role === 'estudiante';
    if (group === 'profesores') return u.role === 'profesor';
    return true;
  });

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Panel de Administración</h1>
      <div className="flex gap-2 mb-6">
        <button className={`px-4 py-2 rounded ${group === 'todos' ? 'bg-green-600' : 'bg-gray-700'}`} onClick={() => setGroup('todos')}>Todos</button>
        <button className={`px-4 py-2 rounded ${group === 'estudiantes' ? 'bg-green-600' : 'bg-gray-700'}`} onClick={() => setGroup('estudiantes')}>Estudiantes</button>
        <button className={`px-4 py-2 rounded ${group === 'profesores' ? 'bg-green-600' : 'bg-gray-700'}`} onClick={() => setGroup('profesores')}>Profesores</button>
      </div>

      {loading ? (
        <p>Cargando usuarios...</p>
      ) : (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-800">
              <th className="border px-4 py-2">Nombre</th>
              <th className="border px-4 py-2">Email</th>
              <th className="border px-4 py-2">Rol</th>
              <th className="border px-4 py-2">Teacher ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.uid} className="hover:bg-gray-700">
                <td className="border px-4 py-2">{user.displayName}</td>
                <td className="border px-4 py-2">{user.email}</td>
                <td className="border px-4 py-2 capitalize">{user.role}</td>
                <td className="border px-4 py-2">{user.teacherId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
