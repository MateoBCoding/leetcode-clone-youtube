import React from 'react';

interface CategoryCircleProps {
  category: string;
  onClick: (category: string) => void;
}

const CategoryCircle: React.FC<CategoryCircleProps> = ({ category, onClick }) => {
  return (
    <button
      onClick={() => onClick(category)}
      style={{
        width: '100px',
        height: '100px',
        borderRadius: '50%',
        backgroundColor: '#4A90E2',
        color: 'white',
        fontWeight: 'bold',
        border: 'none',
        margin: '10px',
        cursor: 'pointer'
      }}
    >
      {category}
    </button>
  );
};

export default CategoryCircle;
