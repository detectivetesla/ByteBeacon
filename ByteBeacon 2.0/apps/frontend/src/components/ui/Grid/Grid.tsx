import React from 'react';
import styles from './Grid.module.css';

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 12;
  gap?: 2 | 4 | 6 | 8;
  children: React.ReactNode;
}

export const Grid: React.FC<GridProps> = ({
  cols = 3,
  gap = 6,
  className = '',
  children,
  ...props
}) => {
  const colsClass = styles[`cols${cols}`];
  const gapClass = styles[`gap${gap}`];
  const gridClass = `${styles.grid} ${colsClass} ${gapClass} ${className}`.trim();

  return (
    <div className={gridClass} {...props}>
      {children}
    </div>
  );
};
