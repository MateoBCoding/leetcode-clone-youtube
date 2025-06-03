import React, { useCallback, useState, useEffect } from 'react';
import { FaDownload, FaTimes, FaUpload } from 'react-icons/fa';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth as getAuthSecondary,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { firestore, firebaseConfig } from '@/firebase/firebase';
import {
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';

interface BulkStudent {
  name: string;
  email: string;
  documentId: string;
}

interface BulkRegisterModalProps {
  onClose: () => void;
  currentTeacherUid: string;
}

const secondaryApp =
  getApps().find((app) => app.name === 'Secondary') ||
  initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuthSecondary(secondaryApp);

export const BulkRegisterModal: React.FC<BulkRegisterModalProps> = ({
  onClose,
  currentTeacherUid,
}) => {
  const [templateUrl, setTemplateUrl] = useState<string>('');
  const [parsing, setParsing] = useState<boolean>(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const headers = ['name', 'email', 'documentId'];
    const exampleRow = ['Juan Pérez', 'juan@example.com', '12345678'];
    const csvContent = headers.join(',') + '\r\n' + exampleRow.join(',') + '\r\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    setTemplateUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setUploadError(null);
      if (acceptedFiles.length === 0) {
        setUploadError('No se seleccionó ningún archivo válido.');
        return;
      }
      const file = acceptedFiles[0];
      setParsing(true);
      Papa.parse<BulkStudent>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data: BulkStudent[] = results.data;
          const errors = results.errors;
          if (errors.length) {
            setUploadError('Error al parsear el CSV: ' + errors[0].message);
            setParsing(false);
            return;
          }
          if (data.length === 0) {
            setUploadError('El archivo CSV está vacío o no tiene filas válidas.');
            setParsing(false);
            return;
          }

          const logs: string[] = [];
          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowIndex = i + 2; 
            if (
              !row.name?.trim() ||
              !row.email?.trim() ||
              !row.documentId?.trim()
            ) {
              logs.push(`Fila ${rowIndex}: campos vacíos (omitido).`);
              continue;
            }

            try {
              const password = Math.random().toString(36).slice(-8);
              const cred = await createUserWithEmailAndPassword(
                secondaryAuth,
                row.email.trim(),
                password
              );
              const uid = cred.user.uid;

              await setDoc(doc(firestore, 'users', uid), {
                uid,
                email: row.email.trim(),
                displayName: row.name.trim(),
                documentId: row.documentId.trim(),
                role: 'estudiante',
                teacherId: currentTeacherUid,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                solvedProblems: [],
                likedProblems: [],
                dislikedProblems: [],
                starredProblems: [],
                students: [],
              });

              await updateDoc(doc(firestore, 'users', currentTeacherUid), {
                students: arrayUnion(uid),
              });

              logs.push(
                `Fila ${rowIndex}: "${row.name}" creado. Contraseña: "${password}".`
              );
            } catch (e: any) {
              console.error(e);
              logs.push(
                `Fila ${rowIndex}: Error registrando "${row.name}": ${
                  e.message || e.code || 'desconocido'
                }`
              );
            }
          }

          setLogMessages(logs);
          setParsing(false);
        },
        error: (err) => {
          setUploadError('Error al leer el archivo: ' + err.message);
          setParsing(false);
        },
      });
    },
    [currentTeacherUid]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg text-black w-4/5 max-w-2xl p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Carga masiva de estudiantes</h2>
          <button onClick={onClose} title="Cerrar">
            <FaTimes className="text-gray-600 hover:text-gray-900" />
          </button>
        </div>

        {/* Enlace de descarga del template */}
        <div className="flex items-center space-x-2">
          <FaDownload />
          <a
            href={templateUrl}
            download="template_estudiantes.csv"
            className="text-blue-600 hover:underline"
          >
            Descargar plantilla (CSV)
          </a>
        </div>

        {/* Área de Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer ${
            isDragActive
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 bg-gray-100'
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-gray-700">Suelta el archivo aquí...</p>
          ) : (
            <p className="text-gray-700">
              Arrastra tu archivo CSV aquí, o haz clic para seleccionar.
              <br />
              <span className="text-sm text-gray-500">(Sólo archivos .csv)</span>
            </p>
          )}
        </div>

        {/* Mensajes de estado / errores */}
        {parsing && <p className="text-blue-600">Procesando archivo...</p>}
        {uploadError && <p className="text-red-600">{uploadError}</p>}

        {logMessages.length > 0 && (
          <div className="max-h-48 overflow-auto bg-gray-50 border border-gray-200 rounded p-3 text-sm">
            <ul className="list-disc list-inside space-y-1">
              {logMessages.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
