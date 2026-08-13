import React from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label = 'Loading...',
  className = '',
  ...props
}) => {
  const spinnerClass = `${styles.spinner} ${styles[size]} ${className}`.trim();

  return (
    <span
      className={spinnerClass}
      role="status"
      aria-label={label}
      {...props}
    >
      <span style={{ display: 'none' }}>{label}</span>
    </span>
  );
};
