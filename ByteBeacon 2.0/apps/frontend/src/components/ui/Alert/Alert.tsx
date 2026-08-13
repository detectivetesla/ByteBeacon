import React from 'react';
import styles from './Alert.module.css';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  className = '',
  children,
  ...props
}) => {
  const alertClass = `${styles.alert} ${styles[variant]} ${className}`.trim();

  return (
    <div className={alertClass} role="alert" {...props}>
      <div>
        {title && <div className={styles.title}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
};
