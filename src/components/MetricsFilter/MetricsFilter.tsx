import React from 'react';

export type Metric = 'completion' | 'attempts' | 'time' | 'points' | null;

interface MetricsFilterProps {
  selectedMetric: Metric;
  onToggle: (metric: Metric) => void;
}

const MetricsFilter: React.FC<MetricsFilterProps> = ({ selectedMetric, onToggle }) => (
  <div className="grid grid-cols-3 gap-4 mb-4">
    <button
      className={`border p-4 text-center font-medium ${
        selectedMetric === 'completion' ? 'bg-white text-green-600 font-bold' : ''
      }`}
      onClick={() => onToggle('completion')}
    >
      % completos
    </button>
    <button
      className={`border p-4 text-center font-medium ${
        selectedMetric === 'attempts' ? 'bg-white text-green-600 font-bold' : ''
      }`}
      onClick={() => onToggle('attempts')}
    >
      Intentos
    </button>
    <button
      className={`border p-4 text-center font-medium ${
        selectedMetric === 'time' ? 'bg-white text-green-600 font-bold' : ''
      }`}
      onClick={() => onToggle('time')}
    >
      Tiempo
    </button>

     <button
      className={`border p-4 text-center font-medium ${
        selectedMetric === 'points' ? 'bg-white text-green-600 font-bold' : ''
      }`}
      onClick={() => onToggle('points')}
    >
      Puntos
    </button>
  </div>
);

export default MetricsFilter;
