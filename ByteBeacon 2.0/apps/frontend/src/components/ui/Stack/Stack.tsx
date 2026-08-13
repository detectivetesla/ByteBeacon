import React from 'react';
import styles from './Stack.module.css';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'vertical' | 'horizontal';
  gap?: 1 | 2 | 3 | 4 | 6 | 8;
  align?: 'Start' | 'Center' | 'End' | 'Stretch';
  justify?: 'Start' | 'Center' | 'End' | 'Between';
  children: React.ReactNode;
}

export const Stack: React.FC<StackProps> = ({
  direction = 'vertical',
  gap = 4,
  align,
  justify,
  className = '',
  children,
  ...props
}) => {
  const dirClass = styles[direction];
  const gapClass = styles[`gap${gap}`];
  const alignClass = align ? styles[`align${align}`] : '';
  const justifyClass = justify ? styles[`justify${justify}`] : '';
  const stackClass = `${styles.stack} ${dirClass} ${gapClass} ${alignClass} ${justifyClass} ${className}`.trim();

  return (
    <div className={stackClass} {...props}>
      {children}
    </div>
  );
};
