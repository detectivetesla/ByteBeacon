import React from 'react';
import styles from './Card.module.css';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => {
  const cardClass = `${styles.card} ${styles[variant]} ${className}`.trim();

  return (
    <div className={cardClass} {...props}>
      {children}
    </div>
  );
};
