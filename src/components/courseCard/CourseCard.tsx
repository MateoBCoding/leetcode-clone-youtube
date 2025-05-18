import React from 'react';

interface CourseCardProps {
  title: string;
  description: string;
  category: string;
  onClick: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({
  title,
  description,
  category,
  onClick,
}) => {
  // Definir colores o patrones por categoría si quieres, por ahora algo básico:
  const headerColors: Record<string, string> = {
    Programación: 'bg-blue-500',
    Matemáticas: 'bg-yellow-500',
    Ciencia: 'bg-red-500',
    // default
    default: 'bg-gray-300',
  };

  const headerColor = headerColors[category] || headerColors.default;

  return (
    <div
      onClick={onClick}
      className="w-60 border border-gray-300 rounded shadow hover:scale-105 transition-transform cursor-pointer"
    >
      {/* Encabezado de color o patrón */}
      <div className={`h-24 ${headerColor} rounded-t`}></div>

      {/* Contenido */}
      <div className="p-4 flex flex-col justify-between h-56">
        <div className="text-center text-green-800 font-semibold text-lg leading-5 mb-4">
          {title}
        </div>
        <div className="text-sm text-white text-center mb-4">{description}</div>
        <div className="text-xs text-gray-500 text-center">
          Categoría: <span className="font-semibold">{category}</span>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
