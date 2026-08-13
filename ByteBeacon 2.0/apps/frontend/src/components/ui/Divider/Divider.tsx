import React from 'react';
import styles from './Divider.module.css';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className = '',
  ...props
}) => {
  const dividerClass = `${styles[orientation]} ${className}`.trim();
  return <hr className={dividerClass} aria-orientation={orientation} {...props} />;
};
