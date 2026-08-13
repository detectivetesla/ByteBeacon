import React from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const IconButton: React.FC<IconButtonProps> = ({
  'aria-label': ariaLabel,
  size = 'md',
  className = '',
  children,
  ...props
}) => {
  const buttonClass = `${styles.iconButton} ${styles[size]} ${className}`.trim();

  return (
    <button className={buttonClass} aria-label={ariaLabel} {...props}>
      {children}
    </button>
  );
};
