import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

interface RankingChartProps {
  data: Array<{
    name: string;
    totalPoints: number;
  }>;
}

const StudentRankingChart: React.FC<RankingChartProps> = ({ data }) => {
  const sortedData = [...data].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={sortedData}
       
        margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="name"
         
          height={80}
         
          angle={-45}
          textAnchor="end"
          tick={{ fill: '#ffffff', fontSize: 12 }}
          interval={0} 
          dy={10}
        />
        <YAxis
          tick={{ fill: '#ffffff', fontSize: 12 }}
          label={{ value: 'Puntos', angle: -90, position: 'insideLeft', fill: '#ffffff' }}
        />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
        <Bar dataKey="totalPoints" fill="#4ade80">
          <LabelList dataKey="totalPoints" position="top" fill="#ffffff" fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default StudentRankingChart;
