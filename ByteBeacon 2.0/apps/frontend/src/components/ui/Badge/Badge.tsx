import React from 'react';
import styles from './Badge.module.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'cyan' | 'lime' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  className = '',
  children,
  ...props
}) => {
  const badgeClass = `${styles.badge} ${styles[variant]} ${className}`.trim();

  return (
    <span className={badgeClass} {...props}>
      {children}
    </span>
  );
};
